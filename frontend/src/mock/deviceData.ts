// 设备数据 Mock：mulberry32 确定性种子生成 7 天体征 + 30 天体重
// R2.3：移除全部血糖曲线；家庭血压基线 120–132/76–84；
// 就餐联动：①近 3 天高钠 → 后续血压缓升 ②健康餐 → 次日改善（带地板值）；
// 所有读写走 storage ns* 命名空间（按当前 uid 隔离）。

import { LS_KEYS } from '@/constants/dict'
import { nsRead, nsWrite, nsRemove } from '@/utils/storage'
import { dateStr, addDays } from '@/utils/date'
import type { DeviceData, DeviceDay, ManualMetric, ManualMetricInput, Meal, Profile } from '@/types'

// 类型定义在 @/types（api 层与视图共用），此处再导出以兼容现有 mock 引用
export type { ManualMetric, ManualMetricInput }

const BASE_SEED = 20240923
const MOOD_CYCLE = ['平静', '平静', '平静', '疲惫', '焦虑', '烦躁']

type Rng = () => number

// mulberry32 伪随机数发生器（确定性）
function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function round1(v: unknown): number {
  return Math.round((Number(v) || 0) * 10) / 10
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

// 家庭血压基线：收缩压 120–132，舒张压 76–84（非高血压人群）
// 高血压人群基线抬高至 132–144 / 84–92
function genDay(_dateKey: string, profile: Partial<Profile> = {}, seed = BASE_SEED): DeviceDay {
  const rng = mulberry32(seed)
  const htn = ['confirmed', 'mild_risk', 'high_risk'].includes(profile.htnStatus ?? '')
  const bpSysBase = htn ? 132 + rng() * 12 : 120 + rng() * 12
  const bpDiaBase = htn ? 84 + rng() * 8 : 76 + rng() * 8
  const activity = profile.activity || 'low'
  const stepsRange: [number, number] =
    activity === 'mid' ? [5500, 6800] : activity === 'high' ? [6800, 7800] : [4200, 5500]

  return {
    bpMorning: [round1(bpSysBase + (rng() - 0.5) * 4), round1(bpDiaBase + (rng() - 0.5) * 3)],
    bpEvening: [round1(bpSysBase + (rng() - 0.5) * 5), round1(bpDiaBase + (rng() - 0.5) * 3)],
    hr: round1(68 + rng() * 14), // 68~82
    mood: MOOD_CYCLE[Math.floor(rng() * MOOD_CYCLE.length)] || '平静',
    steps: Math.round(stepsRange[0] + rng() * (stepsRange[1] - stepsRange[0])),
    sleep: {
      total: round1(6.2 + rng() * 1.6), // 6.2~7.8h
      deepRatio: round1(0.15 + rng() * 0.1), // 0.15~0.25
    },
    weight: round1((Number(profile.weightKg) || 65) + (rng() - 0.5) * 0.8),
  }
}

function buildInitialState(profile: Partial<Profile> = {}): DeviceData {
  const days: Record<string, DeviceDay> = {}
  const today = new Date()
  const baseWeight = Number(profile.weightKg) || 65

  // 往前 30 天体重（轻微下行趋势 + 波动）
  for (let offset = 29; offset >= 1; offset -= 1) {
    const key = dateStr(addDays(today, -offset))
    const rng = mulberry32(BASE_SEED + offset * 7919)
    days[key] = { weight: round1(baseWeight + 0.4 - offset * 0.012 + (rng() - 0.5) * 0.6) }
  }

  // 往前 7 天完整体征
  for (let offset = 6; offset >= 0; offset -= 1) {
    const key = dateStr(addDays(today, -offset))
    days[key] = genDay(key, profile, BASE_SEED + offset * 104729)
  }

  return { initializedAt: new Date().toISOString(), days }
}

function loadProfile(): Partial<Profile> {
  return nsRead<Partial<Profile>>(LS_KEYS.profile) ?? {}
}

/**
 * 持久化设备模拟数据：这是主操作（记餐/记指标）的副作用，
 * 存储满时不能让主操作整体失败——本次内存态仍返回，仅留证。
 */
function persistDeviceState(state: DeviceData): void {
  try {
    nsWrite<DeviceData>(LS_KEYS.deviceData, state)
  } catch (err) {
    console.warn('[deviceData] 设备数据未持久化（不影响本次保存）', err)
  }
}

// 无数据则按画像生成并持久化；返回最新状态
export function ensureDeviceData(profile: Partial<Profile> = loadProfile()): DeviceData {
  const existing = nsRead<DeviceData>(LS_KEYS.deviceData)
  if (existing && existing.days) return existing
  const state = buildInitialState(profile || {})
  persistDeviceState(state)
  return state
}

export function getDeviceData(): DeviceData {
  return ensureDeviceData()
}

// （ManualMetric / ManualMetricInput 类型见 @/types，文件头已再导出）

// 合法有限数值（拒绝 NaN/Infinity/null/undefined）；steps 允许 0，其余需 > 0
function validMetricValue(metric: ManualMetric, v: unknown): v is number {
  const n = Number(v)
  if (!Number.isFinite(n)) return false
  if (metric === 'steps') return n >= 0
  return n > 0
}

/**
 * 手动记录某一天的体征指标（心率/步数/睡眠/体重）。
 * - dateKey 为 null 时记今天；该天不存在则建空对象（不调 genDay 补假数据）；
 * - 只写入 input 中提供且合法的字段，小数经 round1 保留 1 位，非法值忽略；
 * - 睡眠只给 total 时，deepRatio 沿用已有手环值；没有则置 0（卡片据此隐藏深浅睡比例，不编造）；
 * - 写入后在 day.manual 对应指标置 true 并持久化，返回最新 state。
 */
export function saveManualMetric(dateKey: string | null, input: ManualMetricInput): DeviceData {
  const state = ensureDeviceData()
  const key = dateKey ?? dateStr(new Date())
  // 无数据的日子给空对象即可：手动记录不应触发生成假体征
  const day: DeviceDay = state.days[key] ?? {}
  state.days[key] = day
  if (!day.manual) day.manual = {}

  if (input.hr !== undefined && validMetricValue('hr', input.hr)) {
    day.hr = round1(input.hr)
    day.manual.hr = true
  }
  if (input.steps !== undefined && validMetricValue('steps', input.steps)) {
    day.steps = round1(input.steps)
    day.manual.steps = true
  }
  if (input.sleep !== undefined && validMetricValue('sleep', input.sleep)) {
    day.sleep = {
      total: round1(input.sleep),
      deepRatio: day.sleep?.deepRatio || 0,
    }
    day.manual.sleep = true
  }
  if (input.weight !== undefined && validMetricValue('weight', input.weight)) {
    day.weight = round1(input.weight)
    day.manual.weight = true
  }

  persistDeviceState(state)
  return state
}

function ensureDay(state: DeviceData, key: string, profile: Partial<Profile>): DeviceDay {
  if (!state.days[key]) {
    state.days[key] = genDay(key, profile, hashSeed(key) ^ BASE_SEED)
  }
  return state.days[key]
}

// 近 3 天滚动平均钠（含本餐，读 ns 中已存餐次）
function rollingNa(dateKey: string, currentMeal: { na?: number }): number {
  const meals = nsRead<Meal[]>(LS_KEYS.meals) || []
  const naByDate: Record<string, number> = {}
  for (const m of meals) {
    if (m && m.date) naByDate[m.date] = (naByDate[m.date] || 0) + (Number(m.totals?.Na) || 0)
  }
  const today = new Date(dateKey)
  naByDate[dateKey] = (naByDate[dateKey] || 0) + (Number(currentMeal.na) || 0)
  let sum = 0
  let count = 0
  for (let offset = 2; offset >= 0; offset -= 1) {
    const key = dateStr(addDays(today, -offset))
    if (naByDate[key] > 0) {
      sum += naByDate[key]
      count += 1
    }
  }
  return count ? sum / count : 0
}

// 血压缓升：每天约 +1.5/1.0，封顶 160/100
function bumpBp(day: DeviceDay): void {
  day.bpMorning = [
    round1(clamp((day.bpMorning?.[0] || 120) + 1.5, 0, 160)),
    round1(clamp((day.bpMorning?.[1] || 80) + 1, 0, 100)),
  ]
  day.bpEvening = [
    round1(clamp((day.bpEvening?.[0] || 120) + 1.5, 0, 160)),
    round1(clamp((day.bpEvening?.[1] || 80) + 1, 0, 100)),
  ]
}

// 次日血压回落 0.8/0.5，地板值 110/70（不会降得过低）
function improveNextDay(day: DeviceDay): void {
  day.bpMorning = [
    round1(Math.max(110, (day.bpMorning?.[0] || 120) - 0.8)),
    round1(Math.max(70, (day.bpMorning?.[1] || 80) - 0.5)),
  ]
  day.bpEvening = [
    round1(Math.max(110, (day.bpEvening?.[0] || 120) - 0.8)),
    round1(Math.max(70, (day.bpEvening?.[1] || 80) - 0.5)),
  ]
}

/** 联动一餐的入参（na 单位 mg） */
export interface ApplyMealInput {
  dateTime?: string
  date?: string
  na?: number
}

/**
 * 记录一餐对设备数据的影响
 * R2.3：仅钠→血压、健康餐→改善两个方向；无血糖联动
 */
export function applyMeal(
  meal: ApplyMealInput = {},
  { adoptedHealthy = false }: { adoptedHealthy?: boolean } = {},
): DeviceData {
  const profile = loadProfile()
  const state = ensureDeviceData(profile)
  const dateKey = meal.dateTime ? dateStr(meal.dateTime) : meal.date || dateStr(new Date())
  ensureDay(state, dateKey, profile)
  const na = Number(meal.na) || 0

  // ① 近 3 天滚动平均钠 >800 → 后续 3 天血压逐步抬高
  if (rollingNa(dateKey, meal) > 800) {
    for (let offset = 1; offset <= 3; offset += 1) {
      const key = dateStr(addDays(new Date(dateKey), offset))
      bumpBp(ensureDay(state, key, profile))
    }
  }

  // ② 采纳健康建议或本餐低钠 → 次日血压回落（带地板值）
  if (adoptedHealthy || na <= 600) {
    const nextKey = dateStr(addDays(new Date(dateKey), 1))
    improveNextDay(ensureDay(state, nextKey, profile))
  }

  persistDeviceState(state)
  return state
}

// 清空并按画像重新生成
export function resetDeviceData(profile: Partial<Profile> = loadProfile()): DeviceData {
  nsRemove(LS_KEYS.deviceData)
  return ensureDeviceData(profile || {})
}
