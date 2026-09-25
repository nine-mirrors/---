// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AxiosAdapter } from 'axios'
import http, { ApiError } from './http'
import { AUTH_SESSION_KEY } from '@/utils/account'

// 注入自定义 adapter：按用例返回指定 HTTP 状态，不发真实网络请求
function setMockAdapter(status: number, url: string): void {
  const target = http as unknown as { defaults: { adapter: AxiosAdapter } }
  target.defaults.adapter = (async (config) => {
    const err = new Error(`Request failed with status code ${status}`) as Error & {
      config?: unknown
      response?: unknown
      isAxiosError?: boolean
    }
    err.isAxiosError = true
    err.config = { ...config, url }
    err.response = {
      status,
      statusText: status === 401 ? 'Unauthorized' : 'Error',
      headers: {},
      config: { ...config, url },
      data: { message: '原始错误' },
    }
    throw err
  }) as AxiosAdapter
}

describe('http 401 拦截（二轮 P1：单飞 + 不递归 + 硬刷新）', () => {
  let assignMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setActivePinia(createPinia())
    window.localStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({ uid: 'u1', phone: '1', name: 'n', token: 't', loginAt: 'x' }),
    )
    assignMock = vi.fn()
    // jsdom 下替换 location（本文件用例独立环境，无需恢复真实跳转）
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/health', assign: assignMock },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('并发 3 个非 auth 请求同时 401：只清一次会话、只跳一次登录，且均 reject ApiError', async () => {
    setMockAdapter(401, '/api/bp-logs')
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem')

    const results = await Promise.allSettled([
      http.get('/api/bp-logs'),
      http.get('/api/meals'),
      http.get('/api/profile'),
    ])

    // 三个请求都拿到统一的 401 ApiError，不静默吞掉
    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    for (const r of results) {
      if (r.status === 'rejected') {
        expect(r.reason).toBeInstanceOf(ApiError)
        expect(r.reason.code).toBe(401)
      }
    }

    // 单飞：等微任务跑完 handleUnauthorized 后，assign 只发生 1 次；
    // 会话清理（http 内 removeItem + clearSessionLocal 内 removeGlobal）至少执行过
    await Promise.resolve()
    await Promise.resolve()
    const sessionRemoves = removeSpy.mock.calls.filter(([key]) => key === AUTH_SESSION_KEY)
    expect(sessionRemoves.length).toBeGreaterThanOrEqual(1)
    expect(assignMock).toHaveBeenCalledTimes(1)
    expect(assignMock).toHaveBeenCalledWith('/login')

    // 单飞锁完成后再来一个 401：复用同一处理承诺，不重复跳转（真实页面此时已硬刷新）
    await expect(http.get('/api/again')).rejects.toBeInstanceOf(ApiError)
    await Promise.resolve()
    await Promise.resolve()
    expect(assignMock).toHaveBeenCalledTimes(1)
  })

  it('/api/auth/* 端点自身的 401 按业务错误处理，不触发清会话/跳转', async () => {
    setMockAdapter(401, '/api/auth/login')
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem')

    await expect(
      http.post('/api/auth/login', { phone: '1', password: 'x' }),
    ).rejects.toBeInstanceOf(ApiError)
    await Promise.resolve()
    await Promise.resolve()

    expect(removeSpy).not.toHaveBeenCalled()
    expect(assignMock).not.toHaveBeenCalled()
    // 会话键原样保留（本轮 beforeEach 写入）
    expect(window.localStorage.getItem(AUTH_SESSION_KEY)).not.toBeNull()
  })
})
