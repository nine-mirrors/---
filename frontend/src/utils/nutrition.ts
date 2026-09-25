// 营养计算纯函数层：不依赖 DOM / pinia，可在 node 中直接断言
// R2.3：移除全部血糖负荷（GL）/血糖曲线逻辑，聚焦高血压 DASH 营养评分
// 所有数值口径：每 100g 食物营养 × 摄入克重；null 缺失按 0 参与加和

import {
  NA_MEAL,
  NA_MEAL_WARN_MG,
  K_PI,
  K_AI,
  K_MEAL_GOOD,
  K_MEAL_LOW,
  BP_THRESHOLDS,
  PROTEIN_PER_KG,
  VEG_MEAL,
  VEG_DAY,
  FIBER_DAY,
  FIBER_MEAL,
  HIGH_SAT_RED_G,
  SCORE_YELLOW,
  SCORE_GREEN,
  SODIUM_PER_SALT_G,
  LS_KEYS,
} from '@/constants/dict'
import { RED_FLAG_SYMPTOMS } from '@/constants/clinical'
import { FOOD_MAP } from '@/mock/foods'
import { RECIPES } from '@/mock/recipes'
import { recentDates } from '@/utils/date'
import { nsRead } from '@/utils/storage'
import { computeTotals, isAddedSeasoningId } from '@/utils/totals'
import {
  energyBudget,
  energyDayStatus,
  energyMealStatus,
  fiberDayStatus,
  fiberMealStatus,
} from '@/utils/dietTargets'

export { computeTotals }

import type {
  BpLevel,
  BpRecord,
  DashDimension,
  DashProgress,
  EvaluateResult,
  Meal,
  MealItem,
  NutrientTotals,
  Profile,
  Recipe,
  Rule,
  RuleReason,
  StatusLevel,
  Substitution,
  WeeklyBpResult,
} from '@/types'

function round1(v: unknown): number {
  return Math.round((Number(v) || 0) * 10) / 10
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

function isHtnRisk(profile: Partial<Profile> = {}): boolean {
  return ['confirmed', 'mild_risk', 'high_risk'].includes(profile.htnStatus ?? '')
}

// 肾功能三态：true=需控钾（肾病/低钠盐）/ false=明确正常 / null|undefined=未知
function isRenalRestricted(profile: Partial<Profile> = {}): boolean {
  return profile.renalKRestriction === true
}

function isRenalUnknown(profile: Partial<Profile> = {}): boolean {
  return profile.renalKRestriction == null
}

/**
 * 肾功能未知时钾维度统一中性文案（评分卡、结果页图表共用，禁止各写一版）
 */
export const RENAL_UNKNOWN_K_TEXT =
  '肾功能不确定时，含钾食物适量吃就好；别用低钠盐（氯化钾盐），也别自行吃补钾片，建议体检查个肾功能。'

function proteinTargetMeal(profile: Partial<Profile> = {}): number {
  const w = Number(profile.weightKg) || 60
  return round1((w * PROTEIN_PER_KG) / 3)
}

// 单项指标红黄绿判定（R2.3：无 gl）
export function statusOf(
  metric: string,
  value: number,
  profile: Partial<Profile> = {},
): StatusLevel {
  const v = Number(value) || 0
  switch (metric) {
    case 'na':
      if (v > NA_MEAL) return 'red'
      if (v > NA_MEAL_WARN_MG) return 'yellow'
      return 'green'
    case 'protein': {
      if (isRenalRestricted(profile)) return 'green' // CKD 蛋白量遵医嘱，不判高低
      const target = proteinTargetMeal(profile)
      if (v < target * 0.7) return 'red'
      if (v < target) return 'yellow'
      return 'green'
    }
    case 'veg':
      if (v < 80) return 'red'
      if (v < VEG_MEAL) return 'yellow'
      return 'green'
    case 'fiber':
      return fiberMealStatus(v)
    case 'energy':
      return energyMealStatus(v, profile)
    case 'K':
      // 仅肾功能明确正常才判钾不足；控钾/未知都不判（单餐口径：K_MEAL_LOW/K_MEAL_GOOD）
      if (profile.renalKRestriction !== false) return 'green'
      if (v < K_MEAL_LOW) return 'red'
      if (v < K_MEAL_GOOD) return 'yellow'
      return 'green'
    default:
      return 'green'
  }
}

/**
 * 餐食评分：100 起扣，clamp 0~100，<60 红 / 60~79 黄 / ≥80 绿
 * R2.3：五维——钠/钾/蛋白/蔬菜/DASH（DASH 用蔬菜+蛋白+低钠综合体现，不再单列 GL）
 */
export function scoreMeal(
  totals: NutrientTotals,
  profile: Partial<Profile> = {},
): { score: number; level: StatusLevel; reasons: RuleReason[] } {
  let score = 100
  const reasons: RuleReason[] = []

  // —— 钠 ——
  if (totals.Na > NA_MEAL) {
    score -= 18
    reasons.push({ metric: 'na', status: 'red', text: '这顿偏咸，钠含量明显超标，血压容易往上走' })
  } else if (totals.Na > NA_MEAL_WARN_MG) {
    score -= 8
    reasons.push({ metric: 'na', status: 'yellow', text: '这顿口味略重，还能再淡一点' })
  }

  // —— 热量（个性化预算，只扣超标；偏低不扣，营养不足由蛋白质等维度兜底） ——
  const energyStatus = energyMealStatus(totals.energyKCal, profile)
  if (energyStatus === 'red') {
    score -= 10
    reasons.push({
      metric: 'energy',
      status: 'red',
      text: '这顿热量超标不少，下顿少一口主食、少点油水',
    })
  } else if (energyStatus === 'yellow') {
    score -= 5
    reasons.push({
      metric: 'energy',
      status: 'yellow',
      text: '这顿热量略高，再少一口、七分饱刚刚好',
    })
  }

  // —— 蛋白质（控钾/CKD 画像转中性，不扣分，吃多少听医生的） ——
  const target = proteinTargetMeal(profile)
  if (!isRenalRestricted(profile)) {
    if (totals.protein < target * 0.7) {
      score -= 12
      reasons.push({ metric: 'protein', status: 'red', text: '蛋白质不太够，鱼虾蛋豆腐要常吃' })
    } else if (totals.protein < target) {
      score -= 6
      reasons.push({
        metric: 'protein',
        status: 'yellow',
        text: '蛋白质差一点，加个蛋或一杯奶更好',
      })
    }
  }

  // —— 蔬菜 ——
  if (totals.vegWeight < 80) {
    score -= 10
    reasons.push({ metric: 'veg', status: 'red', text: '蔬菜明显不够，先来一盘菜再吃饭' })
  } else if (totals.vegWeight < VEG_MEAL) {
    score -= 5
    reasons.push({ metric: 'veg', status: 'yellow', text: '蔬菜再多半拳就更好' })
  }

  // —— 膳食纤维：<5g 红 −8、5–8g 黄 −4（目标 25g/天） ——
  const fiberStatus = fiberMealStatus(totals.dietaryFiber)
  if (fiberStatus === 'red') {
    score -= 8
    reasons.push({
      metric: 'fiber',
      status: 'red',
      text: '膳食纤维不太够，燕麦杂豆、蔬菜和带皮水果多吃点',
    })
  } else if (fiberStatus === 'yellow') {
    score -= 4
    reasons.push({
      metric: 'fiber',
      status: 'yellow',
      text: '纤维还差一点，主食换点燕麦杂粮就补上了',
    })
  }

  // —— 钾：仅肾功能明确正常才评分；控钾/未知均不扣分（单餐口径 K_MEAL_LOW）——
  if (profile.renalKRestriction === false) {
    if (totals.K < K_MEAL_LOW) {
      score -= 8
      reasons.push({ metric: 'K', status: 'red', text: '富钾食物偏少，多吃菠菜、土豆、香蕉' })
    } else if (totals.K < K_MEAL_GOOD) {
      score -= 4
      reasons.push({ metric: 'K', status: 'yellow', text: '含钾蔬果还能再多一点' })
    }
  }

  // —— DASH 综合：蔬菜+蛋白达标且钠不高，给予小额鼓励（不加分，但钠高已扣分）——
  // 此处 DASH 通过钠/蔬菜/蛋白三维共同体现，无需单独扣分

  score = clamp(Math.round(score), 0, 100)
  const level: StatusLevel =
    score >= SCORE_GREEN ? 'green' : score >= SCORE_YELLOW ? 'yellow' : 'red'
  return { score, level, reasons }
}

function makeCard(
  id: string,
  severity: StatusLevel | 'neutral',
  title: string,
  metric: string | null,
  value: number | null,
  threshold: number | null,
  evidence: string,
  text: string,
  recipeTags: string[] = [],
): Rule {
  return { id, severity, title, metric, value, threshold, evidence, text, recipeTags }
}

/**
 * 生成建议卡片（红/黄干预卡 + 绿色鼓励卡）
 * R2.3：无 GL 规则；htnStatus 个性化；renalKRestriction=true 剔除一切补钾/高钾规则
 */
export function buildRules(totals: NutrientTotals, profile: Partial<Profile> = {}): Rule[] {
  const rules: Rule[] = []
  const htnRisk = isHtnRisk(profile)
  const renal = isRenalRestricted(profile)
  const bpSentence = htnRisk ? '最近每天早晚各测一次血压，吃饭再淡一点。' : ''

  // —— 钠 / 血压 ——
  const naStatus = statusOf('na', totals.Na)
  if (naStatus !== 'green') {
    const saltG = round1(totals.Na / SODIUM_PER_SALT_G)
    let text: string
    if (naStatus === 'red') {
      text = !htnRisk
        ? `这餐钠约 ${totals.Na}mg，相当于 ${saltG}g 盐，超过一餐 ${NA_MEAL}mg 的建议量。现在血压正常也要保持清淡、注意预防，做菜盐量控制在一啤酒盖以内，酱油、咸菜也算盐。`
        : `这餐钠约 ${totals.Na}mg，相当于 ${saltG}g 盐，超过一餐 ${NA_MEAL}mg 的建议量。${bpSentence}腌菜、酱料和外卖汤汁尽量少碰。`
    } else {
      text = `这餐钠约 ${totals.Na}mg，相当于 ${saltG}g 盐，口味还能再淡一点，少放盐和酱料${
        profile.renalKRestriction === false ? '，多吃含钾的蔬菜水果' : ''
      }。${bpSentence}`
    }
    rules.push(
      makeCard(
        'HTN_Sodium_High',
        naStatus,
        naStatus === 'red' ? '这顿偏咸，钠超标' : '口味略重',
        'na',
        totals.Na,
        NA_MEAL,
        '《成人高血压食养指南（2023）》',
        text,
        ['低钠'],
      ),
    )
  }

  // —— 热量（个性化预算，只红/黄超标，偏低不出卡） ——
  const mealBudget = energyBudget(profile)
  const energyStatus = statusOf('energy', totals.energyKCal, profile)
  if (energyStatus !== 'green') {
    const text =
      energyStatus === 'red'
        ? `这餐约 ${totals.energyKCal} 千卡，比给您算的每顿约 ${mealBudget.mealKcal} 千卡多了不少。下顿少一口主食、少点油水，七八分饱刚好，饭后再散步20分钟。`
        : `这餐约 ${totals.energyKCal} 千卡，比每顿约 ${mealBudget.mealKcal} 千卡的参考略高一点，再少一口主食就好。`
    rules.push(
      makeCard(
        'Energy_High',
        energyStatus,
        energyStatus === 'red' ? '这顿热量超标' : '热量略高',
        'energy',
        totals.energyKCal,
        mealBudget.mealKcal,
        '《成人高血压食养指南（2023年版）》体重管理能量 25–30 kcal/kg/天',
        text,
        [],
      ),
    )
  }

  // —— 蛋白质（控钾/CKD 画像转中性：不推高蛋白，保留"听医生的"） ——
  const pTarget = proteinTargetMeal(profile)
  const pStatus = statusOf('protein', totals.protein, profile)
  if (renal) {
    rules.push(
      makeCard(
        'Protein_Renal_Neutral',
        'neutral',
        '蛋白质吃多少听医生的',
        'protein',
        totals.protein,
        null,
        '慢性肾病患者蛋白质摄入需个体化，应遵医嘱调整',
        '您勾选了肾不好/需控钾，蛋白质吃多少、吃哪些要听医生或营养师的，别自己大量吃蛋白粉或补品。',
        [],
      ),
    )
  } else if (pStatus !== 'green') {
    const text =
      pStatus === 'red'
        ? `这餐蛋白质只有 ${totals.protein}g，离每餐约 ${pTarget}g 的目标差不少。鱼虾、鸡蛋、豆腐、牛奶都是优质蛋白，每顿配一手掌大小的鱼或肉，或者一块豆腐。`
        : `这餐蛋白质 ${totals.protein}g，比每餐约 ${pTarget}g 的目标略少，加个鸡蛋、一杯酸奶或几块豆腐就够了。`
    rules.push(
      makeCard(
        'Protein_Low',
        pStatus,
        '蛋白质不太够',
        'protein',
        totals.protein,
        pTarget,
        '《中国居民膳食营养素参考摄入量（2023版）》建议蛋白质 1.2–1.5 g/kg 体重/天',
        text,
        ['高蛋白'],
      ),
    )
  }

  // —— 蔬菜 ——
  const vegStatus = statusOf('veg', totals.vegWeight)
  if (vegStatus !== 'green') {
    const text =
      vegStatus === 'red'
        ? `这餐蔬菜只有约 ${totals.vegWeight}g，明显不够。每天争取吃够 ${VEG_DAY}g 蔬菜，午餐晚餐各来一盘，深色叶菜占一半。`
        : `这餐蔬菜约 ${totals.vegWeight}g，再多半拳就更好，吃饭顺序上先吃菜、再吃肉和主食。`
    rules.push(
      makeCard(
        'Veg_Short',
        vegStatus,
        '蔬菜量不够',
        'veg',
        totals.vegWeight,
        VEG_MEAL,
        '《高血压营养和运动指导原则（2024年版）》建议蔬菜≥500g/天',
        text,
        [],
      ),
    )
  }

  // —— 膳食纤维（单餐 <5g 红、5–8g 黄；≥8g 不出卡） ——
  const fiberStatus = statusOf('fiber', totals.dietaryFiber)
  if (fiberStatus !== 'green') {
    const text =
      fiberStatus === 'red'
        ? `这餐纤维只有约 ${totals.dietaryFiber}g，明显不够。燕麦、杂豆、绿叶菜和带皮水果都是纤维好手，主食换掉一半白米白面效果最好。`
        : `这餐纤维约 ${totals.dietaryFiber}g，还差一点，主食掺点燕麦杂粮、饭后加个水果就够了。`
    rules.push(
      makeCard(
        'Fiber_Low',
        fiberStatus,
        fiberStatus === 'red' ? '膳食纤维不太够' : '纤维还差一点',
        'fiber',
        totals.dietaryFiber,
        FIBER_MEAL,
        '《成人高血压食养指南（2023年版）》膳食纤维 25–30g/天',
        text,
        [],
      ),
    )
  }

  // —— 饱和脂肪/胆固醇（定性卡，不精算毫克、不进评分） ——
  if (totals.highSatItems.length > 0) {
    const fatRed = totals.highSatWeightG >= HIGH_SAT_RED_G
    const names = totals.highSatItems.join('、')
    rules.push(
      makeCard(
        'Fat_HighSat',
        fatRed ? 'red' : 'yellow',
        fatRed ? '高脂食材吃多了' : '高脂食材偶尔解馋',
        'fat',
        totals.highSatWeightG,
        HIGH_SAT_RED_G,
        '《成人高血压食养指南（2023年版）》减少饱和脂肪摄入',
        `${names}${fatRed ? `这顿吃了约 ${totals.highSatWeightG}g，量有点多，` : '饱和脂肪高、通常盐也重，'}偶尔解馋行，平时换成鱼虾、鸡胸、豆腐这类少油的优质蛋白。`,
        [],
      ),
    )
  }
  if (totals.cholItems.length > 0) {
    rules.push(
      makeCard(
        'Fat_Chol_Occasional',
        'neutral',
        '动物内脏偶尔少量吃',
        'fat',
        null,
        null,
        '现代膳食口径：膳食胆固醇不必严格忌口，控制饱和脂肪更关键',
        `${totals.cholItems.join('、')}这类内脏胆固醇较高，偶尔少量吃一次可以，不用完全戒；鸡蛋黄每天吃1个没问题，不用丢黄。`,
        [],
      ),
    )
  }

  // —— 钾（三态：明确正常才推补钾；控钾提醒限制；未知给中性提示） ——
  if (profile.renalKRestriction === false) {
    const kStatus = statusOf('K', totals.K, profile)
    if (kStatus !== 'green') {
      const text = `这餐钾约 ${totals.K}mg，富钾食物偏少。菠菜、油菜、土豆、香蕉、豆类都是补钾好手，肾功能正常的前提下可以多吃点。`
      rules.push(
        makeCard(
          'K_Low',
          kStatus,
          '富钾食物偏少',
          'K',
          totals.K,
          K_MEAL_GOOD,
          '《中国居民膳食营养素参考摄入量（2023）》钾 PI 3600mg/天',
          text,
          ['高钾'],
        ),
      )
    }
  } else if (renal) {
    // 控钾人群：不推补钾，但提醒控钾
    rules.push(
      makeCard(
        'K_Renal_Restrict',
        'neutral',
        '按您的情况，富钾食物和低钠盐要控制',
        'K',
        totals.K,
        null,
        '慢性肾病/需控钾人群应遵医嘱限制钾摄入',
        '您勾选了肾不好/需控钾，富钾食物（菠菜、土豆、香蕉、低钠盐）别自己多吃，具体量请咨询医生或营养师。',
        [],
      ),
    )
  } else {
    // 肾功能未知：不扣分、不推高钾，给统一中性提示
    rules.push(
      makeCard(
        'K_Renal_Unknown',
        'neutral',
        '肾功能不确定，钾适量就好',
        'K',
        totals.K,
        null,
        '肾功能不明时不建议自行补钾或使用氯化钾低钠盐',
        RENAL_UNKNOWN_K_TEXT,
        [],
      ),
    )
  }

  // —— 绿色鼓励卡（同类最多一张） ——
  if (
    !rules.some((r) => r.severity === 'red') &&
    rules.filter((r) => r.severity === 'yellow').length <= 1
  ) {
    rules.push(
      makeCard(
        'Good_Balance',
        'green',
        '这顿搭配得不错',
        'score',
        null,
        null,
        '《中国居民膳食指南（2022）》平衡膳食准则',
        '主食、优质蛋白和蔬菜搭配得比较均衡，继续保持这个吃法，每顿七八分饱、细嚼慢咽。',
        [],
      ),
    )
  }

  return rules
}

/** 判断是否高钠菜品/主食（用于减盐替换建议） */
function isHighSodiumItem(id: string): boolean {
  const food = FOOD_MAP[id]
  if (!food) return false
  // 每 100g 钠 >300mg 视为高钠（腌制品、酱料、部分加工菜品）
  return food.Na > 300
}

/**
 * 减盐 DASH 替换建议；控钾画像不推高钾替换项
 * R2.3：原高 GI 主食替换改为减盐替换
 */
export function buildSubstitutions(
  items: MealItem[] = [],
  profile: Partial<Profile> = {},
): Substitution[] {
  const result: Substitution[] = []
  const seen = new Set<string>()

  for (const item of items || []) {
    const food = FOOD_MAP[item.id]
    if (!food) continue
    // 盐/生抽等调味品本身就是"少放"对象，不给"换清蒸做法"的替换卡
    if (isAddedSeasoningId(item.id)) continue
    if (isHighSodiumItem(item.id) && !seen.has(food.id)) {
      seen.add(food.id)
      // 仅肾功能明确正常才配富钾食材；控钾/未知只给清淡做法
      const to =
        profile.renalKRestriction === false
          ? '清蒸配菠菜或土豆，少盐少酱'
          : '清蒸/白灼做法，少盐少酱'
      result.push({
        from: `${food.name}（钠 ${food.Na}mg/100g）`,
        to,
        tip: '换清淡做法，盐和酱油减半',
      })
    }
  }
  return result
}

/**
 * 按营养缺口标签挑选 3 道推荐食谱（牙口不好时优先易咀嚼）
 * R2.3：无 lowGL；控钾人群不推高钾标签
 */
export function pickRecipes(totals: NutrientTotals, profile: Partial<Profile> = {}): Recipe[] {
  const need: string[] = []
  if (profile.dental && profile.dental !== '好') need.push('易咀嚼')
  if (totals.Na > NA_MEAL_WARN_MG) need.push('低钠')
  // 控钾/CKD 画像不推"高蛋白"；未知与明确正常维持老年 1.2g/kg 口径
  if (!isRenalRestricted(profile) && totals.protein < proteinTargetMeal(profile)) {
    need.push('高蛋白')
  }
  // "高钾"标签仅在肾功能明确正常时推；控钾/未知都不打
  if (
    profile.renalKRestriction === false &&
    (totals.vegWeight < VEG_MEAL || totals.K < K_MEAL_GOOD)
  ) {
    need.push('高钾')
  }

  const preferSoft = profile.dental && profile.dental !== '好'
  const scored = RECIPES.map((recipe) => {
    const hit = recipe.tags.filter((tag) => need.includes(tag)).length
    const softBonus = preferSoft && recipe.tags.includes('易咀嚼') ? 0.5 : 0
    return { recipe, score: hit + softBonus }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 3).map((s) => ({ ...s.recipe }))
}

/**
 * 一餐综合评估
 * R2.3：无 glucose；suggestedItems 为减盐 DASH 搭配
 */
export function evaluate({
  items = [],
  profile = {},
}: {
  items?: MealItem[]
  profile?: Partial<Profile>
} = {}): EvaluateResult {
  const totals = computeTotals(items)
  const substitutions = buildSubstitutions(items, profile)

  // 采纳减盐搭配：高钠项替换为清蒸/白灼做法（用低钠同类食材近似）
  const suggestedItems: MealItem[] = items.map((item) => {
    if (!isHighSodiumItem(item.id)) return { ...item }
    return {
      ...item,
      // 减盐搭配：克重 ×0.85 模拟清淡做法（少盐少酱），id 不变仅降钠效果通过 suggestedTotals 体现
      weightG: round1((Number(item.weightG) || 0) * 0.85),
    }
  })
  const suggestedTotals = computeTotals(suggestedItems)

  const { score, level, reasons } = scoreMeal(totals, profile)
  const rules = buildRules(totals, profile)
  const recipes = pickRecipes(totals, profile)

  return {
    score,
    level,
    reasons,
    totals,
    suggestedItems,
    suggestedTotals,
    rules,
    substitutions,
    recipes,
  }
}

function categoryGroup(category = ''): string {
  return String(category).split('-')[0]
}

/** 周报单日聚合（无餐日为 null） */
export interface WeeklyDay {
  date: string
  count: number
  score: number
  na: number
  protein: number
  vegWeight: number
  categories: string[]
  items: MealItem[]
}

export interface WeeklyResult {
  days: (WeeklyDay | null)[]
  avgScore: number
  dietScores: { insufficient: number; excess: number; diversity: number }
  advice: string
}

/**
 * 周报告：补齐最近 7 天（无餐日为 null），输出评分与三维饮食分
 * R2.3：无 GL，三维为摄入不足/过量/多样性
 * @param profile 可选画像（取体重算蛋白目标）；不传时读当前会话本地画像，仍无则按演示口径 60kg
 */
export function buildWeekly(meals: Meal[] = [], profile: Partial<Profile> = {}): WeeklyResult {
  // 调用方（store/api）未传画像时，用项目现成 nsRead 手段补体重；node/无会话时安全返回 null
  const profileWithWeight =
    Number(profile.weightKg) > 0 ? profile : (nsRead<Profile>(LS_KEYS.profile) ?? {})
  const weightKg = Number(profileWithWeight.weightKg) || 60
  const dates = recentDates(7)
  const byDate: Record<string, Meal[]> = {}
  for (const meal of meals || []) {
    if (!meal || !meal.date) continue
    ;(byDate[meal.date] ||= []).push(meal)
  }

  const days: (WeeklyDay | null)[] = dates.map((date) => {
    const list = byDate[date]
    if (!list || !list.length) return null
    let vegWeight = 0
    const groups = new Set<string>()
    const itemsAll: MealItem[] = []
    for (const meal of list) {
      if (Array.isArray(meal.items)) {
        for (const item of meal.items) {
          itemsAll.push(item)
          const food = FOOD_MAP[item.id]
          if (food) groups.add(categoryGroup(food.category))
        }
        vegWeight += computeTotals(meal.items).vegWeight
      }
    }
    return {
      date,
      count: list.length,
      score: round1(list.reduce((s, m) => s + (Number(m.score) || 0), 0) / list.length),
      na: round1(list.reduce((s, m) => s + (Number(m.totals?.Na) || 0), 0)),
      protein: round1(list.reduce((s, m) => s + (Number(m.totals?.protein) || 0), 0)),
      vegWeight: round1(vegWeight),
      categories: [...groups],
      items: itemsAll,
    }
  })

  const activeDays = days.filter((d): d is WeeklyDay => d !== null)
  const allMeals: Meal[] = meals || []
  const avgScore = activeDays.length
    ? round1(activeDays.reduce((s, d) => s + d.score, 0) / activeDays.length)
    : 0

  // —— 不足维度：蛋白质 / 蔬菜 / 达标餐比例 ——
  const avgProteinPerMeal =
    allMeals.length > 0
      ? allMeals.reduce((s, m) => s + (Number(m.totals?.protein) || 0), 0) / allMeals.length
      : 0
  const avgVegPerMeal =
    allMeals.length > 0
      ? allMeals.reduce((s, m) => {
          if (!Array.isArray(m.items)) return s
          return s + computeTotals(m.items).vegWeight
        }, 0) / allMeals.length
      : 0
  const goodMealRatio =
    allMeals.length > 0 ? allMeals.filter((m) => Number(m.score) >= 80).length / allMeals.length : 0
  const proteinScore = clamp((avgProteinPerMeal / ((weightKg * PROTEIN_PER_KG) / 3)) * 100, 0, 100)
  const vegScore = clamp((avgVegPerMeal / VEG_MEAL) * 100, 0, 100)
  const insufficient = Math.round(proteinScore * 0.4 + vegScore * 0.3 + goodMealRatio * 100 * 0.3)

  // —— 过量维度：高钠餐 + 热量超标餐占比越多越低（钠是主因 50、热量 30）——
  const highNaRatio =
    allMeals.length > 0
      ? allMeals.filter((m) => Number(m.totals?.Na) > NA_MEAL).length / allMeals.length
      : 0
  const highEnergyRatio =
    allMeals.length > 0
      ? allMeals.filter(
          (m) => energyMealStatus(Number(m.totals?.energyKCal) || 0, profileWithWeight) === 'red',
        ).length / allMeals.length
      : 0
  const excess = Math.round(clamp(100 - highNaRatio * 50 - highEnergyRatio * 30, 0, 100))

  // —— 纤维维度（仅用于挑最弱的一条周报建议，不改变"不足"综合分）——
  const avgFiberPerMeal =
    allMeals.length > 0
      ? allMeals.reduce((s, m) => s + (Number(m.totals?.dietaryFiber) || 0), 0) / allMeals.length
      : 0
  const fiberScore = clamp((avgFiberPerMeal / FIBER_MEAL) * 100, 0, 100)

  // —— 多样性：食材大类去重数（≥6 类满分） ——
  const allGroups = new Set<string>()
  activeDays.forEach((d) => d.categories.forEach((c) => allGroups.add(c)))
  const diversity = Math.round(clamp((allGroups.size / 6) * 100, 0, 100))

  const dietScores = {
    insufficient: clamp(insufficient, 0, 100),
    excess,
    diversity,
  }

  const dims: { score: number; text: string }[] = [
    {
      score: dietScores.insufficient,
      text: '这周优质蛋白和蔬菜有点跟不上，每天一杯奶一个蛋，午晚餐各来一盘青菜。',
    },
    {
      score: dietScores.excess,
      text: '这周口味偏重或热量偏高，下周少盐少油、七分饱，腌菜酱料、肥肉加工肉和外卖汤汁少碰。',
    },
    {
      score: dietScores.diversity,
      text: '这周吃来吃去就那几样，食材种类再丰富些，鸡鸭鱼、豆制品和各色蔬菜换着吃。',
    },
    {
      score: fiberScore,
      text: '这周膳食纤维偏少，主食掺点燕麦杂豆，多吃蔬菜、豆类和带皮水果。',
    },
  ]
  dims.sort((a, b) => a.score - b.score)
  const advice = activeDays.length
    ? dims[0].text
    : '这周还没有记录，从下一餐开始拍一拍，慢慢就能看出饮食规律了。'

  return { days, avgScore, dietScores, advice }
}

/**
 * DASH 六维进度（低盐 / 热量 / 蔬菜 / 纤维 / 蛋白 / 富钾）
 * 肾功能三态：true=富钾/蛋白维度中性遵医嘱；false=积极补钾+1.2g/kg 蛋白；
 * null/未知=富钾维度中性（不评分、不推补钾），蛋白仍按老年口径
 * 脂肪/胆固醇、烟酒为环外提示（fatNote 与生活方式卡），不进进度环
 * @param dayMeals 当天所有餐次
 */
export function buildDashProgress(
  dayMeals: Meal[] = [],
  profile: Partial<Profile> = {},
): DashProgress {
  const meals = dayMeals || []
  const allItems = meals.flatMap((m) => m.items || [])
  const totals = computeTotals(allItems)
  const mealTotalsList = meals.map((m) => computeTotals(m.items || []))
  const renal = isRenalRestricted(profile)
  const renalUnknown = isRenalUnknown(profile)
  const weightKg = Number(profile.weightKg) || 60

  // 当天是否记录过另放的含钠调味品（食盐、生抽等）
  const hasSeasoning = allItems.some((it) => isAddedSeasoningId(it.id))

  // DASH 维度状态：红黄绿 + restricted（控钾）+ neutral（不评成功/失败的中性态）
  type DimStatus = DashDimension['status']

  // 1. 低盐：钠 ÷ 400 = 盐当量（g），目标 ≤5g/天
  const saltG = round1(totals.Na / SODIUM_PER_SALT_G)
  // 没有任何调味品记录时，绿色"达标"是假的（盐根本没记全）：降中性，不给成功态
  const rawSaltStatus: StatusLevel = saltG > 5 ? 'red' : saltG > 3 ? 'yellow' : 'green'
  const saltStatus: DimStatus =
    !hasSeasoning && rawSaltStatus === 'green' ? 'neutral' : rawSaltStatus
  const saltNote = (tail: string) =>
    `按食材估算，盐约 ${saltG}g（${
      hasSeasoning
        ? '含已记录的盐、酱油，可能还有没记的'
        : '这只算了饭菜本身的钠，不含做菜另放的盐和酱油'
    }），${tail}`

  // 2. 热量：个性化全天预算；只对超标亮灯，记录不足2餐且未到红线为 neutral
  const budget = energyBudget(profile)
  const energyStatusAll: DimStatus = energyDayStatus(totals.energyKCal, meals.length, profile)
  const energyText =
    energyStatusAll === 'red'
      ? `今天已约 ${totals.energyKCal} 千卡，超过一天约 ${budget.dayKcal} 千卡的预算，下顿少吃点主食和油水。`
      : energyStatusAll === 'yellow'
        ? `今天约 ${totals.energyKCal} 千卡，预算约 ${budget.dayKcal} 千卡，七八分饱刚好。`
        : energyStatusAll === 'neutral'
          ? `今天已记 ${totals.energyKCal} 千卡，一天预算约 ${budget.dayKcal} 千卡，记全三餐再评。`
          : `今天约 ${totals.energyKCal} 千卡，在一天约 ${budget.dayKcal} 千卡的预算内，继续保持。`

  // 3. 蔬菜：目标 500g/天
  const vegStatus: StatusLevel =
    totals.vegWeight < 250 ? 'red' : totals.vegWeight < VEG_DAY ? 'yellow' : 'green'

  // 4. 膳食纤维：目标 25g/天（<17 红、17–25 黄）
  const fiberStatusAll: StatusLevel = fiberDayStatus(totals.dietaryFiber)
  const fiberText =
    fiberStatusAll === 'green'
      ? `纤维约 ${totals.dietaryFiber}g，达到 25g 目标。`
      : fiberStatusAll === 'yellow'
        ? `纤维约 ${totals.dietaryFiber}g，目标 ${FIBER_DAY}g，燕麦杂豆、带皮水果再加点。`
        : `纤维只有约 ${totals.dietaryFiber}g，目标 ${FIBER_DAY}g，主食换杂粮、多吃蔬菜豆类。`

  // 5. 蛋白：目标 1.2g/kg/天；控钾/CKD 画像不判高低，提示听医生的
  const proteinTarget = round1(weightKg * PROTEIN_PER_KG)
  const proteinStatus: StatusLevel = renal
    ? 'green'
    : totals.protein < proteinTarget * 0.7
      ? 'red'
      : totals.protein < proteinTarget
        ? 'yellow'
        : 'green'
  const proteinText = renal
    ? '您的蛋白质吃多少、吃哪些要听医生或营养师的，别自己大量补蛋白粉。'
    : proteinStatus === 'green'
      ? `蛋白质约 ${round1(totals.protein)}g，达到目标。`
      : `蛋白质约 ${round1(totals.protein)}g，目标 ${proteinTarget}g，加个蛋或一块豆腐。`

  // 6. 富钾：明确正常才按 PI 3600/AI 2000 评级；
  //    控钾=true 输出 restricted（"都要控制"）；未知=null 输出 neutral（"适量就好"），两态文案互不混用
  let kStatus: DimStatus
  let kText: string
  let kTarget: number
  if (renal) {
    kStatus = 'restricted'
    kTarget = 0
    kText = '按您的情况，富钾食物和低钠盐都要控制，具体请遵医嘱。'
  } else if (renalUnknown) {
    kStatus = 'neutral'
    kTarget = 0
    kText = RENAL_UNKNOWN_K_TEXT
  } else {
    kTarget = K_PI
    kStatus = totals.K < K_AI ? 'red' : totals.K < K_PI ? 'yellow' : 'green'
    kText =
      kStatus === 'green'
        ? `钾约 ${totals.K}mg，达到建议量，继续保持。`
        : `钾约 ${totals.K}mg，还可以多吃菠菜、土豆、香蕉等富钾食物。`
  }

  const dimensions: DashDimension[] = [
    {
      key: 'salt',
      label: '低盐',
      value: saltG,
      target: 5,
      status: saltStatus,
      text:
        saltStatus === 'green'
          ? saltNote('在 5g 以内，不错。')
          : saltStatus === 'neutral'
            ? saltNote('食材本身的盐没超，做饭记得少放盐、少放酱油。')
            : saltStatus === 'yellow'
              ? saltNote('接近上限，再淡一点更好。')
              : saltNote('超过 5g 了，腌菜酱料少放。'),
    },
    {
      key: 'energy',
      label: '热量',
      value: round1(totals.energyKCal),
      target: budget.dayKcal,
      status: energyStatusAll,
      text: energyText,
    },
    {
      key: 'veg',
      label: '蔬菜',
      value: round1(totals.vegWeight),
      target: VEG_DAY,
      status: vegStatus,
      text:
        vegStatus === 'green'
          ? `蔬菜约 ${round1(totals.vegWeight)}g，吃够 500g 了。`
          : `蔬菜约 ${round1(totals.vegWeight)}g，目标 500g，再来一盘。`,
    },
    {
      key: 'fiber',
      label: '纤维',
      value: round1(totals.dietaryFiber),
      target: FIBER_DAY,
      status: fiberStatusAll,
      text: fiberText,
    },
    {
      key: 'protein',
      label: '蛋白',
      value: round1(totals.protein),
      target: renal ? 0 : proteinTarget,
      status: proteinStatus,
      text: proteinText,
    },
    {
      key: 'k',
      label: '富钾',
      value: round1(totals.K),
      target: kTarget,
      status: kStatus,
      text: kText,
    },
  ]

  // 环外脂肪提示：当天逐餐收集（不进评分、不进进度环）
  const satNames = new Set<string>()
  const cholNames = new Set<string>()
  for (const t of mealTotalsList) {
    t.highSatItems.forEach((n) => satNames.add(n))
    t.cholItems.forEach((n) => cholNames.add(n))
  }
  const satMeals = mealTotalsList.filter((t) => t.highSatItems.length > 0).length
  const fatParts: string[] = []
  if (satNames.size > 0) {
    fatParts.push(
      `今天有 ${satMeals} 餐吃了${[...satNames].join('、')}这类高脂食材，偶尔解馋行，平时多换鱼虾、鸡胸、豆腐`,
    )
  }
  if (cholNames.size > 0) {
    fatParts.push(`${[...cholNames].join('、')}这类内脏偶尔少量吃就好，鸡蛋黄每天1个不用丢`)
  }
  const fatNote = fatParts.length ? fatParts.join('；') + '。' : null

  return { dimensions, fatNote }
}

/** 周维度聚合状态（比单日多一档 neutral：不夸达标、只给限定语） */
export type WeeklyDimStatus = StatusLevel | 'restricted' | 'neutral'

export interface WeeklySaltSummary {
  /** 有餐日平均盐当量 g */
  avgSaltG: number
  status: WeeklyDimStatus
  text: string
}

/**
 * 周报盐维度聚合（纯函数，便于 node 断言）：
 * - 红/黄按日均盐当量 5g/3g 判；
 * - 绿色"本周盐量大多在 5g 以内"只有在"记录了调味品的天数占多数"时才给；
 *   否则降 neutral，并带限定语"只算了饭菜本身的钠，不含另放的盐和酱油"，
 *   避免老人没记调料却被夸"盐量达标"。
 */
export function buildWeeklySaltSummary(dayItemsList: MealItem[][] = []): WeeklySaltSummary {
  const active = dayItemsList.filter((items) => items.length > 0)
  if (!active.length) {
    return { avgSaltG: 0, status: 'green', text: '本周还没有记录' }
  }
  const saltGs = active.map((items) => computeTotals(items).Na / SODIUM_PER_SALT_G)
  const avgSaltG = round1(saltGs.reduce((s, v) => s + v, 0) / saltGs.length)
  const withSeasoning = active.filter((items) =>
    items.some((it) => isAddedSeasoningId(it.id)),
  ).length
  const reds = saltGs.filter((g) => g > 5).length
  const yellows = saltGs.filter((g) => g > 3 && g <= 5).length
  const seasoningMajority = withSeasoning * 2 > active.length

  if (reds > active.length / 2) {
    return { avgSaltG, status: 'red', text: '本周盐量偏多，腌菜酱料少放。' }
  }
  if (reds > 0 || yellows > active.length / 2) {
    return { avgSaltG, status: 'yellow', text: '本周盐量接近上限，再淡一点更好。' }
  }
  if (!seasoningMajority) {
    return {
      avgSaltG,
      status: 'neutral',
      text: '按饭菜本身算盐量不高，但多数日子没记做菜另放的盐和酱油，实际上限可能更高，记得少放。',
    }
  }
  return { avgSaltG, status: 'green', text: '本周盐量大多在 5g 以内，继续保持。' }
}

/**
 * 仅舒张压低而收缩压正常（老年单纯舒张压低常见口径）：
 * SBP 在 90–134（家庭口径不高）且 DBP<60。此时不做"低血压"告警，给中性提示。
 */
export function isIsolatedLowDiastolic(sys: number, dia: number): boolean {
  const s = Number(sys) || 0
  const d = Number(dia) || 0
  return s >= BP_THRESHOLDS.low.sys && s < BP_THRESHOLDS.home.sys && d < BP_THRESHOLDS.low.dia
}

/** 单纯舒张压低（高压正常）的统一中性提示文案 */
export const BP_ISOLATED_LOW_DIA_TEXT =
  '低压偏低但高压正常，年纪大血管硬化较常见，别自行停药，下次就诊问问医生。'

/**
 * 血压五级判定（家庭自测口径）
 * normal: <135/85；high: ≥135/85；urgent: ≥160/100；emergency: ≥180/120；low: <90/60
 * 收缩压/舒张压任一达标即取更高等级
 * 例外：SBP 正常（<135 且 ≥90）伴仅 DBP<60（老年血管硬化常见）归 normal，不做 low 告警；
 *      SBP≥135 伴 DBP<60 仍为 low（压差过大需警示）。
 */
export function classifyBp(sys: number, dia: number): BpLevel {
  const s = Number(sys) || 0
  const d = Number(dia) || 0
  const t = BP_THRESHOLDS
  if (s >= t.emergency.sys || d >= t.emergency.dia) return 'emergency'
  if (s >= t.urgent.sys || d >= t.urgent.dia) return 'urgent'
  if (s < t.low.sys || (d < t.low.dia && s >= t.home.sys)) return 'low'
  if (s >= t.home.sys || d >= t.home.dia) return 'high'
  return 'normal'
}

/**
 * 近 7 天血压汇总
 * R2.3：measureFreqAdvice 两分支——
 *   未稳（偏高天数>2 或 max≥160/100）→ 连续 7 天早晚测量
 *   平稳 → 每周 1–2 天
 */
export function buildWeeklyBp(records: BpRecord[] = []): WeeklyBpResult {
  // 阈值统一取 dict.BP_THRESHOLDS，禁止在本文件再写 135/85/160/100/180/120
  const homeHighSys = BP_THRESHOLDS.home.sys
  const homeHighDia = BP_THRESHOLDS.home.dia

  const morningRecords = records.filter((r) => r.period === 'morning')
  const eveningRecords = records.filter((r) => r.period === 'evening')

  const avg = (list: BpRecord[]) => {
    if (!list.length) return null
    const sys = list.reduce((s, r) => s + r.sys, 0) / list.length
    const dia = list.reduce((s, r) => s + r.dia, 0) / list.length
    return { sys: round1(sys), dia: round1(dia) }
  }

  const avgMorning = avg(morningRecords)
  const avgEvening = avg(eveningRecords)

  const morningAvgFlag: StatusLevel = avgMorning
    ? avgMorning.sys >= homeHighSys || avgMorning.dia >= homeHighDia
      ? 'red'
      : 'green'
    : 'green'

  let maxSys = 0
  let maxDia = 0
  let homeHighDays = 0
  let manualCount = 0
  let emergencyHit = false
  let isolatedLowDiaHit = false

  const dayMap = new Map<string, boolean>()
  for (const r of records) {
    if (r.sys > maxSys) maxSys = r.sys
    if (r.dia > maxDia) maxDia = r.dia
    if (r.source === 'manual') manualCount += 1
    if (r.sys >= BP_THRESHOLDS.emergency.sys || r.dia >= BP_THRESHOLDS.emergency.dia) {
      emergencyHit = true
    }
    if (isIsolatedLowDiastolic(r.sys, r.dia)) isolatedLowDiaHit = true
    if (r.sys >= homeHighSys || r.dia >= homeHighDia) {
      dayMap.set(r.date, true)
    }
  }
  homeHighDays = dayMap.size

  // 急症红旗症状名一律取共享常量，周报不出现清单外的症状简称
  const emergencySymptomText = ['chest_pain', 'weak_side', 'headache']
    .map((id) => RED_FLAG_SYMPTOMS.find((s) => s.id === id)?.label)
    .filter(Boolean)
    .join('、')

  let adviceLevel: 'stable' | 'high' | 'emergency'
  let adviceText: string
  if (emergencyHit) {
    adviceLevel = 'emergency'
    adviceText = `本周出现过 ≥180/120 的血压，如有${emergencySymptomText}，请立即拨打 120。`
  } else if (
    homeHighDays > 2 ||
    maxSys >= BP_THRESHOLDS.urgent.sys ||
    maxDia >= BP_THRESHOLDS.urgent.dia
  ) {
    adviceLevel = 'high'
    adviceText = '本周血压偏高的天数较多，建议尽快联系医生，别自己加药或停药。'
  } else {
    adviceLevel = 'stable'
    adviceText = isolatedLowDiaHit
      ? `本周血压整体平稳，继续保持清淡饮食和规律测量。${BP_ISOLATED_LOW_DIA_TEXT}`
      : '本周血压整体平稳，继续保持清淡饮食和规律测量。'
  }

  // 测量频率建议
  const measureFreqAdvice =
    adviceLevel !== 'stable'
      ? '血压还没稳住，建议连续 7 天早晚各测一次并记录。'
      : '血压比较平稳，每周测 1–2 天早晚就可以，记下来方便复诊时给医生看。'

  return {
    avgMorning,
    avgEvening,
    morningAvgFlag,
    maxSys,
    maxDia,
    homeHighDays,
    manualCount,
    emergencyHit,
    adviceLevel,
    adviceText,
    measureFreqAdvice,
  }
}
