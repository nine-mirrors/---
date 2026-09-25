// 单餐营养合计纯函数：从 nutrition.ts 拆出，专门供 mock/recipes 顶层调用，
// 避免 recipes.ts ↔ nutrition.ts 循环依赖导致的 NUTRIENT_KEYS TDZ 报错。
// 本模块只依赖 foods 数据与类型，不依赖 recipes / stores，确保无环。
//
// R2.3：移除 gl（血糖负荷）计算；钠仍按 Na（大写）输出，评分层统一使用。

import { FOOD_MAP } from '@/mock/foods'
import type { MealItem, NutrientTotals } from '@/types'

type NutrientKey = 'energyKCal' | 'protein' | 'fat' | 'CHO' | 'dietaryFiber' | 'K' | 'Na'

const NUTRIENT_KEYS: NutrientKey[] = [
  'energyKCal',
  'protein',
  'fat',
  'CHO',
  'dietaryFiber',
  'K',
  'Na',
]

// 可计入"蔬菜量"的天然食材（含菌菇；土豆等薯类归主食，不计蔬菜达标）
export const VEGETABLE_IDS = new Set<string>([
  '045217', // 西兰花
  '045301', // 菠菜
  '043119', // 番茄
  '045125', // 油菜
  'bok_choy', // 青菜（小白菜）
  '045331', // 芹菜
  '043101x', // 茄子
  '043221', // 冬瓜
  '051014', // 木耳(水发)
  '051019', // 香菇(鲜)
])

// 家常菜按蔬菜占比折算蔬菜克数（配料经验估算，待后端核对）
const DISH_VEG_RATIO: Record<string, number> = {
  boiled_greens: 0.6, // 白灼油菜约六成是菜
  spinach_stir: 0.6, // 清炒菠菜约六成是菜
  broccoli_shrimp: 0.6, // 西兰花炒虾仁约六成是菜
}

function round1(v: unknown): number {
  return Math.round((Number(v) || 0) * 10) / 10
}

function num(v: unknown): number {
  return v == null ? 0 : Number(v) || 0
}

/**
 * 合计一餐营养
 * @param items kind 字段可忽略，id 即 FOOD_MAP 键
 */
export function computeTotals(items: MealItem[] = []): NutrientTotals {
  const totals: Record<NutrientKey, number> = {
    energyKCal: 0,
    protein: 0,
    fat: 0,
    CHO: 0,
    dietaryFiber: 0,
    K: 0,
    Na: 0,
  }
  let vegWeight = 0
  let highSatWeightG = 0
  const highSatNames = new Set<string>()
  const cholNames = new Set<string>()

  for (const item of items || []) {
    const food = FOOD_MAP[item.id]
    if (!food) continue
    const weight = Number(item.weightG) || 0
    const ratio = weight / 100
    for (const key of NUTRIENT_KEYS) {
      totals[key] += num(food[key]) * ratio
    }
    if (VEGETABLE_IDS.has(food.id)) {
      vegWeight += weight
    } else if (DISH_VEG_RATIO[food.id]) {
      vegWeight += weight * DISH_VEG_RATIO[food.id]
    }
    // 脂肪/胆固醇定性旗标（鸡蛋等无旗标食材天然不触发）
    if (food.fatFlag === 'high-sat') {
      highSatNames.add(food.name)
      highSatWeightG += weight
    } else if (food.fatFlag === 'chol-occasional') {
      cholNames.add(food.name)
    }
  }

  const result: NutrientTotals = {
    vegWeight: round1(vegWeight),
    highSatItems: [...highSatNames],
    highSatWeightG: round1(highSatWeightG),
    cholItems: [...cholNames],
  } as NutrientTotals
  for (const key of NUTRIENT_KEYS) result[key] = round1(totals[key])
  return result
}

/**
 * 是否为"另放的含钠调味品"（食盐、生抽等）：
 * 分类为"调味"且本身含钠。用于区分钠来自食材本身还是做饭另放的调料。
 */
export function isAddedSeasoningId(id: string): boolean {
  const food = FOOD_MAP[id]
  return !!food && food.category === '调味' && food.Na > 0
}
