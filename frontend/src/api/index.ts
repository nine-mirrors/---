// API 层：Mock / 真实后端两套实现，函数签名与返回结构保持一致
// VITE_USE_MOCK !== 'false' 时默认走 Mock（含未配置环境变量的情况）
//
// R2.3：
// - 所有 mock 读写走 storage ns* 命名空间（按 uid 隔离），禁止裸 localStorage；
// - recognize 真实分支以 multipart/form-data 上传 image 字段并带 Bearer，422 抛 ApiError；
// - bp/medication/devices 支持 {from,to} 区间查询；
// - http 实例与 ApiError/isApiError 由 12a 的 api/http.ts 提供。

import http, { ApiError } from './http'
import { LS_KEYS } from '@/constants/dict'
import { FOODS } from '@/mock/foods'
import { nextScenario } from '@/mock/scenarios'
import { RECIPES } from '@/mock/recipes'
import { evaluate, buildWeekly } from '@/utils/nutrition'
import type { WeeklyResult } from '@/utils/nutrition'
import { normalizeBpRecords } from '@/utils/bpRecord'
import { nsRead, nsWrite } from '@/utils/storage'
import type {
  BpRecord,
  DateRange,
  DeviceData,
  EvaluateResult,
  Food,
  Meal,
  MealItem,
  ManualMetricInput,
  MedicationRecord,
  Profile,
  Recipe,
  RecognizeScenario,
} from '@/types'

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

const delay = (ms = 500): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

function inRange(date: string, range: DateRange = {}): boolean {
  if (range.from && date < range.from) return false
  if (range.to && date > range.to) return false
  return true
}

// ————— 拍照识别 —————

/**
 * 拍照识别
 * @param file 压缩后的图片 Blob（prepareMealImage 输出）
 * @returns 场景对象；真实分支 422 抛 ApiError（识别失败）
 */
export async function recognizeImage(file: File | Blob): Promise<RecognizeScenario> {
  if (USE_MOCK) {
    await delay(600)
    return nextScenario()
  }
  const formData = new FormData()
  formData.append('image', file)
  // 注意：不要手动设置 Content-Type，浏览器会自动生成带 boundary 的
  // multipart/form-data 头；手动设置会丢失 boundary，后端 UploadFile 解析失败。
  // 图片识别耗时可能较长，单独放宽超时到 30s（全局实例默认 10s）。
  return http.post<RecognizeScenario>('/api/recognize', formData, { timeout: 30000 })
}

// ————— 食物搜索 —————

/**
 * 食物搜索：隐藏项（调味品）不参与，最多返回 20 条
 */
export async function searchFoods(q: string): Promise<Food[]> {
  if (USE_MOCK) {
    await delay(300)
    const keyword = String(q ?? '').trim()
    const visible = FOODS.filter((item) => item.hidden !== true)
    const matched = keyword ? visible.filter((item) => item.name.includes(keyword)) : visible
    return matched.slice(0, 20)
  }
  return http.get<Food[]>('/api/foods/search', { params: { q } })
}

// ————— 一餐评估 —————

export interface EvaluatePayload {
  items?: MealItem[]
  profile?: Partial<Profile>
}

export async function evaluateApi(payload: EvaluatePayload): Promise<EvaluateResult> {
  if (USE_MOCK) {
    await delay(500)
    return evaluate(payload)
  }
  return http.post<EvaluateResult>('/api/evaluate', payload)
}

// ————— 画像 —————

export async function getProfile(): Promise<Profile | null> {
  if (USE_MOCK) {
    return nsRead<Profile>(LS_KEYS.profile)
  }
  return http.get<Profile | null>('/api/profile')
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  if (USE_MOCK) {
    nsWrite<Profile>(LS_KEYS.profile, profile)
    return profile
  }
  return http.put<Profile>('/api/profile', profile)
}

// ————— 食谱 —————

export async function getRecipes(tag?: string | null): Promise<Recipe[]> {
  if (USE_MOCK) {
    await delay(200)
    if (!tag || tag === '全部') return RECIPES
    return RECIPES.filter((recipe) => recipe.tags.includes(tag))
  }
  return http.get<Recipe[]>('/api/recipes', { params: { tag } })
}

// ————— 餐次 —————

/** 保存一餐的回显结构（Mock 分支落库） */
export interface SaveMealResult {
  ok: boolean
  meal: Meal
}

/**
 * 保存一餐；Mock 分支直接落库到 ns meals，真实分支 POST /api/meals
 */
export async function saveMeal(meal: Meal): Promise<SaveMealResult> {
  if (USE_MOCK) {
    await delay(300)
    const list = nsRead<Meal[]>(LS_KEYS.meals) || []
    list.push(meal)
    nsWrite<Meal[]>(LS_KEYS.meals, list)
    return { ok: true, meal }
  }
  return http.post<SaveMealResult>('/api/meals', meal)
}

/** 删除一餐 */
export async function deleteMeal(id: string): Promise<boolean> {
  if (USE_MOCK) {
    const list = nsRead<Meal[]>(LS_KEYS.meals) || []
    const next = list.filter((m) => m.id !== id)
    nsWrite<Meal[]>(LS_KEYS.meals, next)
    return true
  }
  return http.delete<boolean>(`/api/meals/${id}`)
}

/**
 * 列出餐次，支持 {from,to}（按 date 过滤），按 dateTime 倒序。
 * 真实模式 GET /api/meals；首页"最近常吃"与今日 DASH 均依赖本接口返回的数据。
 */
export async function listMeals(range: DateRange = {}): Promise<Meal[]> {
  if (USE_MOCK) {
    await delay(200)
    const list = nsRead<Meal[]>(LS_KEYS.meals) || []
    return list
      .filter((m) => inRange(m.date, range))
      .sort((a, b) => b.dateTime.localeCompare(a.dateTime))
  }
  return http.get<Meal[]>('/api/meals', { params: range })
}

// ————— 周报 —————

export async function getWeekly(): Promise<WeeklyResult> {
  if (USE_MOCK) {
    const meals = nsRead<Meal[]>(LS_KEYS.meals) || []
    return buildWeekly(meals)
  }
  return http.get<WeeklyResult>('/api/weekly')
}

// ————— 血压记录（FR-40） —————

/** 列出血压记录，支持 {from,to} 区间 */
export async function listBpLogs(range: DateRange = {}): Promise<BpRecord[]> {
  if (USE_MOCK) {
    // 归一化：旧版本/损坏的本地记录（如缺 readings）在此修复，避免页面渲染崩溃
    const list = normalizeBpRecords(nsRead<unknown[]>(LS_KEYS.bpLog))
    return list
      .filter((r) => inRange(r.date, range))
      .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
  }
  // 真实后端同样可能返回旧格式，统一过一遍归一化
  const rows = await http.get<unknown[]>('/api/bp-logs', { params: range })
  return normalizeBpRecords(rows)
}

/**
 * 新增血压记录
 * 契约：请求体 Omit<BpRecord,'id'|'createdAt'>，id/createdAt 一律由服务端生成；
 * 真实分支只 POST 客户端字段，以服务端返回的完整记录为准；
 * mock 分支自行补 id/createdAt 后落 ns 存储并返回完整记录。
 */
export async function createBpLog(record: Omit<BpRecord, 'id' | 'createdAt'>): Promise<BpRecord> {
  if (USE_MOCK) {
    const full: BpRecord = {
      ...record,
      id: `bp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    }
    const list = nsRead<BpRecord[]>(LS_KEYS.bpLog) || []
    list.push(full)
    nsWrite<BpRecord[]>(LS_KEYS.bpLog, list)
    return full
  }
  return http.post<BpRecord>('/api/bp-logs', record)
}

/** 删除血压记录 */
export async function deleteBpLog(id: string): Promise<boolean> {
  if (USE_MOCK) {
    const list = nsRead<BpRecord[]>(LS_KEYS.bpLog) || []
    nsWrite<BpRecord[]>(
      LS_KEYS.bpLog,
      list.filter((r) => r.id !== id),
    )
    return true
  }
  return http.delete<boolean>(`/api/bp-logs/${id}`)
}

// ————— 服药记录 —————

/** 列出服药记录，支持 {from,to} 区间 */
export async function listMedications(range: DateRange = {}): Promise<MedicationRecord[]> {
  if (USE_MOCK) {
    const list = nsRead<MedicationRecord[]>(LS_KEYS.meds) || []
    return list
      .filter((r) => inRange(r.date, range))
      .sort((a, b) => b.takenAt.localeCompare(a.takenAt))
  }
  return http.get<MedicationRecord[]>('/api/medications', { params: range })
}

/**
 * 打卡服药
 * 契约：请求体 Omit<MedicationRecord,'id'>（不含客户端生成的 id），
 * 真实分支以服务端返回为准；mock 分支自行补 id 后落 ns 存储。
 */
export async function createMedication(
  record: Omit<MedicationRecord, 'id'>,
): Promise<MedicationRecord> {
  if (USE_MOCK) {
    const full: MedicationRecord = {
      ...record,
      id: `med_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    }
    const list = nsRead<MedicationRecord[]>(LS_KEYS.meds) || []
    list.push(full)
    nsWrite<MedicationRecord[]>(LS_KEYS.meds, list)
    return full
  }
  return http.post<MedicationRecord>('/api/medications', record)
}

/** 撤销服药打卡 */
export async function deleteMedication(id: string): Promise<boolean> {
  if (USE_MOCK) {
    const list = nsRead<MedicationRecord[]>(LS_KEYS.meds) || []
    nsWrite<MedicationRecord[]>(
      LS_KEYS.meds,
      list.filter((r) => r.id !== id),
    )
    return true
  }
  return http.delete<boolean>(`/api/medications/${id}`)
}

// ————— 设备数据 —————

/** 获取设备模拟数据，支持 {from,to} 区间 */
export async function getDeviceData(range: DateRange = {}): Promise<DeviceData> {
  if (USE_MOCK) {
    // 动态导入避免循环依赖（deviceData 依赖 storage ns*）
    const { getDeviceData: getMockDeviceData } = await import('@/mock/deviceData')
    const data = getMockDeviceData()
    if (range.from || range.to) {
      const filtered: DeviceData = { ...data, days: {} }
      for (const [key, day] of Object.entries(data.days)) {
        if (inRange(key, range)) filtered.days[key] = day
      }
      return filtered
    }
    return data
  }
  return http.get<DeviceData>('/api/device-data', { params: range })
}

/**
 * 设备模拟数据的写入侧（播种 / 餐后联动 / 重置 / 手动体征）。
 * 这些是 mock 演示机制：mock 分支转调 @/mock/deviceData 落本地 ns；
 * 真实分支 no-op 或抛 NOT_IMPLEMENTED——体征数据由服务端对接硬件后维护，
 * 如需前端回传手动体征，请后端提供 POST /api/device-data/manual（见 docs/api/_s02-business.md）。
 */
export async function ensureDeviceData(profile?: Partial<Profile>): Promise<void> {
  if (!USE_MOCK) return
  const { ensureDeviceData: mockEnsure } = await import('@/mock/deviceData')
  mockEnsure(profile)
}

export async function applyDeviceMeal(
  meal: { dateTime?: string; date?: string; na?: number } = {},
  options: { adoptedHealthy?: boolean } = {},
): Promise<void> {
  if (!USE_MOCK) return
  const { applyMeal: mockApplyMeal } = await import('@/mock/deviceData')
  mockApplyMeal(meal, options)
}

export async function resetDeviceData(profile?: Partial<Profile>): Promise<void> {
  if (!USE_MOCK) return
  const { resetDeviceData: mockReset } = await import('@/mock/deviceData')
  mockReset(profile)
}

/** 手动体征录入（心率/步数/睡眠/体重）。真实端点未就绪时抛错，由 UI 提示而非假装保存成功 */
export async function saveManualMetric(
  dateKey: string | null,
  input: ManualMetricInput,
): Promise<DeviceData> {
  if (USE_MOCK) {
    const { saveManualMetric: mockSave } = await import('@/mock/deviceData')
    return mockSave(dateKey, input)
  }
  throw new ApiError('NOT_IMPLEMENTED', '手动体征记录的接口还没就绪，请先使用血压记录或等设备同步')
}

// 导出 ApiError 供 UI 层判断识别 422 等错误
export { ApiError }
