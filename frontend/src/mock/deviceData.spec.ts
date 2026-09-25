// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureDeviceData, getDeviceData, saveManualMetric } from '@/mock/deviceData'
import { LS_KEYS } from '@/constants/dict'
import { AUTH_SESSION_KEY } from '@/utils/account'
import { dateStr, addDays } from '@/utils/date'

/** 内存版 localStorage（与 aiChat.spec.ts / storage.spec.ts 同一套路） */
class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  clear(): void {
    this.store.clear()
  }
}

const TEST_UID = 't1'
let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
  vi.stubGlobal('window', { localStorage: storage })
  // nsRead/nsWrite 需要登录会话才会按 uid 命名空间读写
  storage.setItem(
    AUTH_SESSION_KEY,
    JSON.stringify({
      uid: TEST_UID,
      phone: '13800000000',
      name: '测试老人',
      token: 'tok',
      loginAt: '',
    }),
  )
})

afterEach(() => {
  storage.clear()
  vi.unstubAllGlobals()
})

describe('saveManualMetric 手动体征录入', () => {
  it('dateKey=null 记今天：写入 steps 并标记 manual.steps，且持久化可读回', () => {
    ensureDeviceData()
    const todayKey = dateStr(new Date())

    saveManualMetric(null, { steps: 5200 })

    const today = getDeviceData().days[todayKey]
    expect(today).toBeDefined()
    expect(today.steps).toBe(5200)
    expect(today.manual?.steps).toBe(true)
  })

  it('睡眠手动保留已有 deepRatio，只更新 total', () => {
    const todayKey = dateStr(new Date())
    const before = ensureDeviceData().days[todayKey]
    const oldDeepRatio = before.sleep?.deepRatio as number
    expect(oldDeepRatio).toBeGreaterThan(0)

    saveManualMetric(todayKey, { sleep: 7.5 })

    const today = getDeviceData().days[todayKey]
    expect(today.sleep?.total).toBe(7.5)
    expect(today.sleep?.deepRatio).toBe(oldDeepRatio)
    expect(today.manual?.sleep).toBe(true)
  })

  it('原本没有数据的日子只建空对象：睡眠 deepRatio 置 0（不编造深浅睡），不补任何假体征', () => {
    const tomorrowKey = dateStr(addDays(new Date(), 1))
    expect(getDeviceData().days[tomorrowKey]).toBeUndefined()

    saveManualMetric(tomorrowKey, { sleep: 8 })

    const day = getDeviceData().days[tomorrowKey]
    expect(day).toEqual({
      sleep: { total: 8, deepRatio: 0 },
      manual: { sleep: true },
    })
  })

  it('体重小数 round1 保留一位：70.26 → 70.3，手动保存的点进入当天序列', () => {
    const todayKey = dateStr(new Date())
    ensureDeviceData()

    saveManualMetric(todayKey, { weight: 70.26 })

    const today = getDeviceData().days[todayKey]
    expect(today.weight).toBe(70.3)
    expect(today.manual?.weight).toBe(true)
  })

  it('非法值忽略：NaN/负数/非数字字符串不写入也不打标记', () => {
    const futureKey = dateStr(addDays(new Date(), 3))

    saveManualMetric(futureKey, {
      hr: Number.NaN,
      weight: -5,
      steps: 'abc' as unknown as number,
    })

    const day = getDeviceData().days[futureKey]
    expect(day.hr).toBeUndefined()
    expect(day.weight).toBeUndefined()
    expect(day.steps).toBeUndefined()
    expect(day.manual?.hr).toBeUndefined()
    expect(day.manual?.weight).toBeUndefined()
    expect(day.manual?.steps).toBeUndefined()
  })

  it('步数 0 是合法值，可以手动记录', () => {
    const todayKey = dateStr(new Date())
    ensureDeviceData()

    saveManualMetric(todayKey, { steps: 0 })

    expect(getDeviceData().days[todayKey].steps).toBe(0)
    expect(getDeviceData().days[todayKey].manual?.steps).toBe(true)
  })

  it('心率小数经 round1 处理：69.34 → 69.3', () => {
    const todayKey = dateStr(new Date())
    ensureDeviceData()

    saveManualMetric(todayKey, { hr: 69.34 })

    expect(getDeviceData().days[todayKey].hr).toBe(69.3)
    expect(getDeviceData().days[todayKey].manual?.hr).toBe(true)
  })

  it('数据确实落盘到 ns 命名空间键 ndh_device_data_v1:<uid>', () => {
    saveManualMetric(null, { weight: 72 })

    const raw = storage.getItem(`${LS_KEYS.deviceData}:${TEST_UID}`)
    expect(raw).toBeTruthy()
    const persisted = JSON.parse(raw as string)
    expect(persisted.days[dateStr(new Date())].weight).toBe(72)
  })
})
