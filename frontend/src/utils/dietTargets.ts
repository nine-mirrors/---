// 热量个性化预算与热量/纤维评级纯函数层：不依赖 DOM / pinia，可在 node 中断言。
// 阈值全部取自 constants/dict.ts（《成人高血压食养指南（2023年版）》等），禁止自创。

import {
  ENERGY_BUDGET_MAX,
  ENERGY_BUDGET_MIN,
  ENERGY_DAY_RED_RATIO,
  ENERGY_DAY_WARN_RATIO,
  ENERGY_FALLBACK_DAY,
  ENERGY_KCAL_PER_KG,
  ENERGY_MEAL_RED_RATIO,
  ENERGY_MEAL_WARN_RATIO,
  ENERGY_OVERWEIGHT_RATIO,
  ENERGY_UNDERWEIGHT_FACTOR,
  ENERGY_UNDERWEIGHT_RATIO,
  FIBER_DAY,
  FIBER_DAY_WARN,
  FIBER_MEAL,
  FIBER_MEAL_WARN,
  MEALS_PER_DAY,
} from '@/constants/dict'
import type { Profile, StatusLevel } from '@/types'

export interface EnergyBudget {
  /** 全天热量预算 kcal（个性化；画像不全为兜底值） */
  dayKcal: number
  /** 单餐参考 kcal（全天/3） */
  mealKcal: number
  /** true=画像缺身高/体重，使用 ENERGY_FALLBACK_DAY 兜底 */
  fallback: boolean
  /** 理想体重 IBW=身高−105；兜底时为 null */
  ibw: number | null
}

function round0(v: number): number {
  return Math.round(v)
}

function activityFactor(activity: string | undefined): number {
  if (activity === 'high') return ENERGY_KCAL_PER_KG.high
  if (activity === 'low') return ENERGY_KCAL_PER_KG.low
  return ENERGY_KCAL_PER_KG.mid
}

/**
 * 个性化全天热量预算：
 * IBW = 身高cm − 105；
 * - 超重（实际体重 > IBW×1.1）：按 IBW 给预算，不放大；
 * - 偏瘦（实际体重 < IBW×0.9）：按实际体重 ×30 给足，防肌少症，不压低；
 * - 正常：实际体重 × 活动系数（少25/中30/多35）；
 * - clamp 1200–2400 kcal；身高或体重缺失退回兜底 1800。
 */
export function energyBudget(profile: Partial<Profile> = {}): EnergyBudget {
  const height = Number(profile.heightCm)
  const weight = Number(profile.weightKg)
  if (!height || !weight) {
    return {
      dayKcal: ENERGY_FALLBACK_DAY,
      mealKcal: round0(ENERGY_FALLBACK_DAY / MEALS_PER_DAY),
      fallback: true,
      ibw: null,
    }
  }
  const ibw = height - 105
  let kcal: number
  if (weight > ibw * ENERGY_OVERWEIGHT_RATIO) {
    kcal = ibw * activityFactor(profile.activity)
  } else if (weight < ibw * ENERGY_UNDERWEIGHT_RATIO) {
    kcal = weight * ENERGY_UNDERWEIGHT_FACTOR
  } else {
    kcal = weight * activityFactor(profile.activity)
  }
  const dayKcal = Math.min(ENERGY_BUDGET_MAX, Math.max(ENERGY_BUDGET_MIN, round0(kcal)))
  return { dayKcal, mealKcal: round0(dayKcal / MEALS_PER_DAY), fallback: false, ibw }
}

/**
 * 单餐热量评级（只对超标亮灯，偏低不警告——营养不足由蛋白质等维度兜底）：
 * 红 > 单餐参考×1.3；黄 > ×1.15；否则绿。
 */
export function energyMealStatus(kcal: number, profile: Partial<Profile> = {}): StatusLevel {
  const v = Number(kcal) || 0
  const { mealKcal } = energyBudget(profile)
  if (v > mealKcal * ENERGY_MEAL_RED_RATIO) return 'red'
  if (v > mealKcal * ENERGY_MEAL_WARN_RATIO) return 'yellow'
  return 'green'
}

/**
 * 全天累计热量评级：
 * 红 > 全天预算×1.1（无论记了几餐，严重超标都提示）；
 * 黄 仅在记录 ≥2 餐且 > 全天预算×1.0 时给；
 * 绿 记录 ≥2 餐且未超预算；
 * neutral 记录不足 2 餐且未到红线——"还没记全"，不夸达标也不吓唬。
 */
export function energyDayStatus(
  kcal: number,
  mealCount: number,
  profile: Partial<Profile> = {},
): StatusLevel | 'neutral' {
  const v = Number(kcal) || 0
  const { dayKcal } = energyBudget(profile)
  if (v > dayKcal * ENERGY_DAY_RED_RATIO) return 'red'
  if (mealCount < MEALS_PER_DAY - 1) return 'neutral'
  if (v > dayKcal * ENERGY_DAY_WARN_RATIO) return 'yellow'
  return 'green'
}

/** 单餐膳食纤维评级：<5g 红、5–8g 黄、≥8g 绿 */
export function fiberMealStatus(g: number): StatusLevel {
  const v = Number(g) || 0
  if (v < FIBER_MEAL_WARN) return 'red'
  if (v < FIBER_MEAL) return 'yellow'
  return 'green'
}

/** 全天膳食纤维评级：<17g 红、17–25g 黄、≥25g 绿 */
export function fiberDayStatus(g: number): StatusLevel {
  const v = Number(g) || 0
  if (v < FIBER_DAY_WARN) return 'red'
  if (v < FIBER_DAY) return 'yellow'
  return 'green'
}
