<script setup lang="ts">
import { computed } from 'vue'
import MetricCard from '@/components/common/MetricCard.vue'
import { RENAL_UNKNOWN_K_TEXT } from '@/utils/nutrition'
import { energyBudget, energyMealStatus, fiberMealStatus } from '@/utils/dietTargets'
import { NA_MEAL, NA_MEAL_WARN_MG, K_MEAL_LOW, K_MEAL_GOOD, PROTEIN_PER_KG } from '@/constants/dict'
import type { NutrientTotals, StatusLevel } from '@/types'

const props = withDefaults(
  defineProps<{
    /** evaluate().totals：energyKCal/Na/protein/K/dietaryFiber ... */
    totals?: NutrientTotals | null
    /** 体重 kg，用于计算单餐蛋白质目标；缺省按演示口径 60kg */
    weightKg?: number
    /** 身高 cm，与体重/活动量一起算个性化热量预算；缺失走兜底口径 */
    heightCm?: number | null
    /** 日常活动量 low/mid/high，参与热量预算 */
    activity?: string
    /** 肾功能三态：true 需控钾 / false 明确正常 / null 未知（钾与蛋白卡中性展示） */
    renalKRestriction?: boolean | null
  }>(),
  { totals: null, weightKg: 0, heightCm: null, activity: 'mid', renalKRestriction: null },
)

// 单餐蛋白质目标 = 体重 × 1.2g/kg/天 / 3（三餐均分；老年口径取 dict.PROTEIN_PER_KG）
const proteinTarget = computed(() => {
  const weight = Number(props.weightKg) || 60
  return Math.round(weight * PROTEIN_PER_KG * 10) / 10 / 3
})

const renal = computed(() => props.renalKRestriction === true)
const renalUnknown = computed(() => props.renalKRestriction == null)

// 热量预算画像（身高/体重/活动量），与 dietTargets.energyBudget 同一口径
const energyProfile = computed(() => ({
  weightKg: Number(props.weightKg) || null,
  heightCm: Number(props.heightCm) || null,
  activity: props.activity,
}))

const mealBudget = computed(() => energyBudget(energyProfile.value).mealKcal)

function energyStatus(v: number): StatusLevel {
  return energyMealStatus(v, energyProfile.value)
}

function naStatus(v: number): StatusLevel {
  if (v > NA_MEAL) return 'red'
  if (v > NA_MEAL_WARN_MG) return 'yellow'
  return 'green'
}

function proteinStatus(v: number): StatusLevel {
  if (v < proteinTarget.value * 0.7) return 'red'
  if (v < proteinTarget.value) return 'yellow'
  return 'green'
}

function kStatus(v: number): StatusLevel {
  // 单餐富钾口径：<800 偏少（红），800–1000 还可以（黄），≥1000 充足（绿）
  if (v < K_MEAL_LOW) return 'red'
  if (v < K_MEAL_GOOD) return 'yellow'
  return 'green'
}

function displayNum(v: unknown, digits = 0): number {
  const n = Number(v) || 0
  return digits === 0 ? Math.round(n) : Math.round(n * 10 ** digits) / 10 ** digits
}

// 白话热量类比：1 碗米饭约 230 千卡，按 0.5 碗步进；不足 0.25 碗不显示
function riceBowlHint(kcal: number): string {
  const bowls = Math.round((kcal / 230) * 2) / 2
  if (bowls < 0.25) return ''
  const text = Number.isInteger(bowls) ? String(bowls) : bowls.toFixed(1)
  return `约合 ${text} 碗米饭（1碗约230千卡）。`
}

function energyHint(status: StatusLevel): string {
  const tail = `（给您算的每顿约 ${mealBudget.value} 千卡）`
  if (status === 'red') return `这餐热量偏高，下顿少口主食、少点油水，七分饱${tail}`
  if (status === 'yellow') return `热量略高，再少一口刚刚好${tail}`
  return `热量合适，继续保持${tail}`
}

const FIBER_HINTS: Record<StatusLevel, string> = {
  red: '纤维不太够，燕麦杂豆、绿叶菜和带皮水果多吃点',
  yellow: '纤维还差一点，主食掺点燕麦杂粮、饭后加个水果',
  green: '纤维充足，对血压和肠道都好，继续保持',
}

const NA_HINTS: Record<StatusLevel, string> = {
  red: '吃盐多容易让血压高，腌菜、酱料和外卖汤汁少碰',
  yellow: '口味略重，还能再淡一点',
  green: '咸淡合适，继续保持清淡',
}

const K_HINTS: Record<StatusLevel, string> = {
  red: '蔬菜水果里钾多，对血压好，这餐富钾食物偏少',
  yellow: '富钾蔬果还能再多一点，菠菜土豆都行',
  green: '钾摄入充足，对血压友好',
}

const cards = computed(() => {
  const t: Partial<NutrientTotals> = props.totals || {}
  const energyKcal = Number(t.energyKCal) || 0
  const pStatus = proteinStatus(Number(t.protein) || 0)
  const proteinHints = {
    red: `蛋白质不太够（每顿约需 ${proteinTarget.value}g），鱼虾、蛋、豆腐要常吃`,
    yellow: `差一点到每顿约 ${proteinTarget.value}g 的目标，加个蛋或一杯奶`,
    green: '蛋白质达标，搭配得不错',
  }
  // 钾卡三态：控钾/未知不评级，用中性色与中性文案
  const kValue = Number(t.K) || 0
  const kCardStatus = renal.value || renalUnknown.value ? 'neutral' : kStatus(kValue)
  const kCardHint = renal.value
    ? '按您的情况，富钾食物和低钠盐要控制，具体听医生或营养师的'
    : renalUnknown.value
      ? RENAL_UNKNOWN_K_TEXT
      : K_HINTS[kStatus(kValue)]
  const eStatus = energyStatus(energyKcal)
  const fiberValue = Number(t.dietaryFiber) || 0
  const fStatus = fiberMealStatus(fiberValue)
  return [
    {
      key: 'energy',
      title: '热量',
      value: displayNum(t.energyKCal),
      unit: '千卡',
      status: eStatus,
      icon: 'Lightning',
      hint: `${riceBowlHint(energyKcal)}${energyHint(eStatus)}`,
      highlight: false,
    },
    {
      key: 'na',
      title: '钠（重点）',
      value: displayNum(t.Na),
      unit: '毫克',
      status: naStatus(Number(t.Na) || 0),
      icon: 'FirstAidKit',
      hint: NA_HINTS[naStatus(Number(t.Na) || 0)],
      highlight: true,
    },
    {
      key: 'fiber',
      title: '膳食纤维',
      value: displayNum(t.dietaryFiber, 1),
      unit: '克',
      status: fStatus,
      icon: 'Dish',
      hint: FIBER_HINTS[fStatus],
      highlight: false,
    },
    {
      key: 'protein',
      title: '蛋白质',
      value: displayNum(t.protein, 1),
      unit: '克',
      status: renal.value ? 'neutral' : pStatus,
      icon: 'Food',
      hint: renal.value
        ? '蛋白质吃多少听医生或营养师的，别自己大量补蛋白粉'
        : proteinHints[pStatus],
      highlight: false,
    },
    {
      key: 'k',
      title: '钾',
      value: displayNum(t.K),
      unit: '毫克',
      status: kCardStatus,
      icon: 'Apple',
      hint: kCardHint,
      highlight: false,
    },
  ]
})
</script>

<template>
  <section class="metrics-panel">
    <h2 class="result-section-title">这餐营养怎么样</h2>
    <div class="metrics-grid">
      <MetricCard
        v-for="card in cards"
        :key="card.key"
        :class="{ 'metrics-grid__card--highlight': card.highlight }"
        :title="card.title"
        :value="card.value"
        :unit="card.unit"
        :status="card.status"
        :icon="card.icon"
        :hint="card.hint"
      />
    </div>
  </section>
</template>

<style scoped>
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-lg);
}

/* 钠卡为本页重点卡：跨两列、视觉权重最高 */
.metrics-grid__card--highlight {
  grid-column: span 2;
}

@media (max-width: 767px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .metrics-grid__card--highlight {
    grid-column: span 1;
  }
}
</style>
