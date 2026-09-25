/**
 * Auth Store（Task 12a 重写）
 *
 * 钉死导出：session、user、ready、login/register/loginBySms/sendSmsCode/demoLogin/logout/restore
 * - 会话持久化到全局键 ndh_auth_v1（含 uid/phone/name/token/loginAt）；
 * - restore() 从 localStorage 恢复会话并设 ready=true；
 * - logout 清会话跳登录（不清业务数据）；
 * - 演示账号 uid=DEMO_UID，只写会话不建账号行。
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { AUTH_SESSION_KEY, DEMO_UID, genMockToken } from '@/utils/account'
import { readGlobal, removeGlobal, writeGlobal } from '@/utils/storage'
import * as authApi from '@/api/auth'
import type { AuthRequest, Session, SmsLoginRequest, SmsSendRequest } from '@/types/auth'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const ready = ref(false)

  /** 当前登录用户（从会话派生） */
  const user = computed(() => {
    if (!session.value) return null
    return { uid: session.value.uid, phone: session.value.phone, name: session.value.name }
  })

  /** 持久化会话到全局键 */
  function persist(): void {
    if (session.value) {
      writeGlobal(AUTH_SESSION_KEY, session.value)
    } else {
      removeGlobal(AUTH_SESSION_KEY)
    }
  }

  /** 从 localStorage 恢复会话（应用启动时调用） */
  function restore(): void {
    const saved = readGlobal<Session>(AUTH_SESSION_KEY)
    if (saved && saved.uid && saved.token) {
      session.value = saved
    } else {
      session.value = null
    }
    ready.value = true
  }

  /** 写入会话并持久化 */
  function setSession(data: {
    token: string
    user: { uid: string; phone: string; name: string }
  }): void {
    session.value = {
      uid: data.user.uid,
      phone: data.user.phone,
      name: data.user.name,
      token: data.token,
      loginAt: new Date().toISOString(),
    }
    persist()
  }

  /** 密码登录 */
  async function login(req: AuthRequest): Promise<void> {
    const res = await authApi.login(req)
    setSession(res)
  }

  /** 注册（成功后自动登录） */
  async function register(req: AuthRequest): Promise<void> {
    const res = await authApi.register(req)
    setSession(res)
  }

  /** 发送验证码 */
  async function sendSmsCode(req: SmsSendRequest): Promise<void> {
    await authApi.sendSmsCode(req)
  }

  /** 验证码登录（未注册自动建号） */
  async function loginBySms(req: SmsLoginRequest): Promise<void> {
    const res = await authApi.loginBySms(req)
    setSession(res)
  }

  /** 一键体验（demo 账号，不建账号行） */
  function demoLogin(): void {
    session.value = {
      uid: DEMO_UID,
      phone: '13800000000',
      name: '王阿姨',
      token: genMockToken(),
      loginAt: new Date().toISOString(),
    }
    persist()
  }

  /** 仅清理本地会话（内存+localStorage），不请求后端、不跳转：供 401 拦截器/跨标签同步使用 */
  function clearSessionLocal(): void {
    session.value = null
    removeGlobal(AUTH_SESSION_KEY)
  }

  /** 退出登录：清会话跳登录，不清业务数据 */
  async function logout(): Promise<void> {
    // 通知后端（mock 直接成功；失败不阻断本地登出）
    try {
      await authApi.logout()
    } catch {
      /* 忽略服务端登出错误，本地仍清理 */
    }
    clearSessionLocal()
    // 跳登录页（动态 import router 避免循环依赖）
    try {
      const router = (await import('@/router')).default
      if (router.currentRoute.value.path !== '/login') {
        router.push('/login')
      }
    } catch {
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
  }

  return {
    session,
    user,
    ready,
    login,
    register,
    loginBySms,
    sendSmsCode,
    demoLogin,
    logout,
    clearSessionLocal,
    restore,
  }
})

/**
 * 跨标签页同步：另一标签退出或换号（storage 事件只在其他标签修改时触发），
 * 本标签内存态必须立刻失效并跳登录，避免沿用旧账号数据继续写入。
 */
type StorageListenerMarker = typeof globalThis & { __ndhAuthStorageBound?: boolean }
if (typeof window !== 'undefined' && !(globalThis as StorageListenerMarker).__ndhAuthStorageBound) {
  ;(globalThis as StorageListenerMarker).__ndhAuthStorageBound = true
  window.addEventListener('storage', (event) => {
    if (event.key !== AUTH_SESSION_KEY) return
    try {
      const auth = useAuthStore()
      // 本标签本身已退出（无会话）时不响应其他标签的登录/写入：
      // 否则 A 标签新登录会被 B（已退出）标签误判为“换号”而清掉，造成互相注销
      if (!auth.session) return
      const next = readGlobal<Session>(AUTH_SESSION_KEY)
      if (!next || next.uid !== auth.session.uid) {
        auth.clearSessionLocal()
        if (window.location.pathname !== '/login') {
          window.location.assign('/login')
        }
      }
    } catch (err) {
      console.warn('[auth] 跨标签会话同步失败', err)
    }
  })
}
