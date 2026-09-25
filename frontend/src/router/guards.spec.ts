// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// 路由组件全部替换为极简桩：本文件只测守卫重定向，不加载真实页面（含 ECharts/EP 的重链路）
vi.mock('@/views/Login.vue', () => ({ default: { template: '<div>login</div>' } }))
vi.mock('@/views/Onboarding.vue', () => ({ default: { template: '<div>onboarding</div>' } }))
vi.mock('@/views/Home.vue', () => ({ default: { template: '<div>home</div>' } }))
vi.mock('@/views/Result.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/views/Health.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/views/Weekly.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/views/Recipes.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/views/Profile.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/views/Devices.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/views/ai/AiChatPage.vue', () => ({ default: { template: '<div />' } }))

const SESSION = {
  uid: 'u-g',
  phone: '13800000000',
  name: '赵奶奶',
  token: 't',
  loginAt: '2025-01-01',
}

/** 重新加载 router 模块（authRestored 是模块级状态，用例间必须重置） */
async function freshRouter() {
  vi.resetModules()
  setActivePinia(createPinia())
  const mod = await import('@/router')
  return mod.default
}

describe('全局路由守卫', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('未登录访问受保护页 → 重定向 /login', async () => {
    const router = await freshRouter()
    await router.push('/health')
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('未登录直接访问 /login → 放行', async () => {
    const router = await freshRouter()
    await router.push('/login')
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('已登录但未完成引导 → 重定向 /onboarding', async () => {
    window.localStorage.setItem('ndh_auth_v1', JSON.stringify(SESSION))
    const router = await freshRouter()
    await router.push('/health')
    expect(router.currentRoute.value.path).toBe('/onboarding')
  })

  it('已登录且已完成引导访问受保护页 → 放行', async () => {
    window.localStorage.setItem('ndh_auth_v1', JSON.stringify(SESSION))
    window.localStorage.setItem(
      'ndh_profile_v1:u-g',
      JSON.stringify({ onboarded: true, name: '赵奶奶' }),
    )
    const router = await freshRouter()
    await router.push('/health')
    expect(router.currentRoute.value.path).toBe('/health')
  })

  it('已登录访问 /login → 重定向首页；已引导访问 /onboarding → 重定向首页', async () => {
    window.localStorage.setItem('ndh_auth_v1', JSON.stringify(SESSION))
    window.localStorage.setItem(
      'ndh_profile_v1:u-g',
      JSON.stringify({ onboarded: true, name: '赵奶奶' }),
    )
    const router = await freshRouter()
    await router.push('/login')
    expect(router.currentRoute.value.path).toBe('/')

    await router.push('/onboarding')
    expect(router.currentRoute.value.path).toBe('/')
  })
})
