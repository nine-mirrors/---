// 餐次记录：待评估内容仅内存态；已确认餐次经 api.saveMeal 落库（mock 落 ns / 真实走后端）
// mock 下落库后联动 src/mock/deviceData.ts 更新设备体征数据
// 真实模式：经 api.listMeals 从服务端拉取（首页 onMounted 触发），最近常吃由已加载餐次聚合

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { LS_KEYS } from '@/constants/dict'
import { nsRead } from '@/utils/storage'
import {
  saveMeal as apiSaveMeal,
  deleteMeal as apiDeleteMeal,
  listMeals as apiListMeals,
  ensureDeviceData,
  applyDeviceMeal,
} from '@/api'
import { todayStr } from '@/utils/date'
import type { DateRange, Meal, MealItem } from '@/types'

/** 拍照后、评估前的临时数据（含图片与餐前状态），不持久化 */
export interface PendingEvaluation {
  items?: MealItem[]
  photo?: string | null
  premeal?: unknown
}

function loadMeals(): Meal[] {
  const saved = nsRead<Meal[]>(LS_KEYS.meals)
  return Array.isArray(saved) ? saved : []
}

/** 最近常吃：从给定餐次中统计出现频次最高的食物（前 5） */
function aggregateFavorites(list: Meal[], limit: number): MealItem[] {
  const countMap = new Map<string, { item: MealItem; count: number }>()
  for (const meal of list) {
    if (!Array.isArray(meal.items)) continue
    for (const item of meal.items) {
      const existing = countMap.get(item.id)
      if (existing) {
        existing.count += 1
      } else {
        countMap.set(item.id, { item, count: 1 })
      }
    }
  }
  return [...countMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((entry) => entry.item)
}

export const useMealsStore = defineStore('meals', () => {
  const pendingEvaluation = ref<PendingEvaluation | null>(null)
  // 首帧同步读本地缓存（真实模式仅作离线缓存），随后由 load() 拉服务端
  const meals = ref<Meal[]>(loadMeals())
  /** 是否已从 api 层加载过（避免首页重复拉取）；重置后置回 false */
  const loaded = ref(false)

  function setPending(payload: PendingEvaluation = {}): void {
    pendingEvaluation.value = {
      items: payload.items,
      photo: payload.photo,
      premeal: payload.premeal,
    }
  }

  function clearPending(): void {
    pendingEvaluation.value = null
  }

  /** 拉取餐次列表（mock 读 ns，真实 GET /api/meals），按 dateTime 倒序覆盖内存态 */
  async function load(range: DateRange = {}): Promise<Meal[]> {
    const list = await apiListMeals(range)
    meals.value = list
    loaded.value = true
    return list
  }

  /**
   * 确认并保存一餐（收口走 api.saveMeal，不再直接写 localStorage）
   * @param mealData 至少含 { score, totals, items }
   * @param options adoptedHealthy 是否采纳推荐搭配
   */
  async function addMeal(
    mealData: Partial<Meal> = {},
    { adoptedHealthy = false }: { adoptedHealthy?: boolean } = {},
  ): Promise<Meal> {
    const meal: Meal = {
      id: `m_${Date.now()}`,
      dateTime: new Date().toISOString(),
      date: todayStr(),
      adoptedHealthy,
      ...mealData,
    } as Meal

    // 经 api 层落库（mock 写 ns，真实走后端）
    const result = await apiSaveMeal(meal)
    meals.value.unshift(result.meal)

    // 联动设备数据：mock 下钠→血压缓升 / 健康餐→改善；真实模式 no-op（体征由服务端维护）
    await ensureDeviceData()
    await applyDeviceMeal(
      {
        dateTime: meal.dateTime,
        date: meal.date,
        na: mealData.totals?.Na,
      },
      { adoptedHealthy },
    )

    return result.meal
  }

  /** 删除一餐 */
  async function removeMeal(id: string): Promise<void> {
    await apiDeleteMeal(id)
    meals.value = meals.value.filter((m) => m.id !== id)
  }

  /** 最近常吃（前 5）：基于已加载到内存的餐次聚合 */
  function recentFavorites(): MealItem[] {
    return aggregateFavorites(meals.value, 5)
  }

  // 仅清空餐次；设备数据是否重置由调用方决定
  function resetAllMeals(): void {
    meals.value = []
    loaded.value = false
  }

  return {
    pendingEvaluation,
    meals,
    loaded,
    setPending,
    clearPending,
    load,
    addMeal,
    removeMeal,
    recentFavorites,
    resetAllMeals,
  }
})
