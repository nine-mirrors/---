<script setup lang="ts">
import { computed } from 'vue'
import { useEcharts } from '@/composables/useEcharts'
import DemoBadge from '@/components/common/DemoBadge.vue'
import {
  NA_MEAL,
  NA_MEAL_WARN_MG,
  NA_DAY,
  K_MEAL_LOW,
  K_MEAL_GOOD,
  K_MEAL_AXIS_MAX,
  SODIUM_PER_SALT_G,
} from '@/constants/dict'
import { CHART_FONT } from '@/utils/chartFont'
import { RENAL_UNKNOWN_K_TEXT } from '@/utils/nutrition'
import type { NutrientTotals } from '@/types'

const props = withDefaults(
  defineProps<{
    /** evaluate().totals：含 Na / K（本餐口径） */
    totals?: NutrientTotals | null
    /** 肾功能三态：true 需控钾 / false 明确正常 / null 未知（钾条中性展示） */
    renalKRestriction?: boolean | null
  }>(),
  { totals: null, renalKRestriction: null },
)

const na = computed(() => Math.round(Number(props.totals?.Na) || 0))
const k = computed(() => Math.round(Number(props.totals?.K) || 0))
const renal = computed(() => props.renalKRestriction === true)
// 肾功能未知：钾不评级、不引导补钾
const renalUnknown = computed(() => props.renalKRestriction == null)

/* —— 图表内是 canvas 渲染，吃不到 CSS 变量；hex 与 tokens.css 同值并在此注明 —— */
// 柱体/参考线本身允许使用状态色（数据编码）
const BAR_RED = '#d93025'
const BAR_YELLOW = '#f59e0b'
const BAR_GREEN = '#1e8e3e'
const BAR_NEUTRAL = '#9aa0a6'
// 文字色一律用适老对比度 token 对应 hex（#b3261e=--color-danger-text 等）
const TEXT_DANGER = '#b3261e'
const TEXT_WARNING = '#8a4b08'
const TEXT_SECONDARY = '#6b675e' // = --color-text-secondary，轴名/轴标签统一中性色，不随数值变色
const TEXT_MAIN = '#2b2a26'
const SPLIT_LINE = '#eee7d8'
const AXIS_LINE = '#e5ddcd'

// 本餐钠柱颜色：>800 红 / >600 黄 / 其余绿（轴标签不变色，只有柱体变色）
const naColor = computed(() => {
  if (na.value > NA_MEAL) return BAR_RED
  if (na.value > NA_MEAL_WARN_MG) return BAR_YELLOW
  return BAR_GREEN
})

// 占全天 2000mg 预算的百分比（摘要区口径：只讲这餐占全天预算多少，不与图上本餐判级混用）
const naPercent = computed(() => Math.min(100, Math.round((na.value / NA_DAY) * 100)))

// 食盐当量：钠 mg ÷ 400 ≈ 盐 g
const saltG = computed(() => {
  const g = na.value / SODIUM_PER_SALT_G
  return Math.round(g * 10) / 10
})

// 本餐钾柱颜色：控钾/未知用中性灰，否则按单餐 1000/800 判色
const kColor = computed(() => {
  if (renal.value || renalUnknown.value) return BAR_NEUTRAL
  if (k.value >= K_MEAL_GOOD) return BAR_GREEN
  if (k.value >= K_MEAL_LOW) return BAR_YELLOW
  return BAR_RED
})

const kStatusText = computed(() => {
  if (renal.value) return '按您的情况，富钾食物和低钠盐都要控制，按大夫交代的吃'
  if (renalUnknown.value) return RENAL_UNKNOWN_K_TEXT
  if (k.value >= K_MEAL_GOOD) return '这餐钾摄入充足，对血压友好'
  if (k.value >= K_MEAL_LOW) return '富钾食物还能再多一点，菠菜、土豆、香蕉都行'
  return '这餐富钾食物偏少，肾功能正常的前提下可以多吃点'
})

// 钠轴上限：至少容下 800 参考线并给柱顶标签留空，实际值更高时按 100 取整放宽
const naAxisMax = computed(() => Math.max(1000, Math.ceil(na.value / 100) * 100))

const option = computed(() => {
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: Array<{ name: string }>) => {
        if (!Array.isArray(params) || !params.length) return ''
        const p = params[0]
        if (String(p.name).includes('钠')) {
          return `本餐钠约 ${na.value} mg<br/>偏咸参考 ${NA_MEAL_WARN_MG} mg、单餐上限 ${NA_MEAL} mg<br/>（全天预算 ${NA_DAY} mg）`
        }
        return `本餐钾约 ${k.value} mg<br/>充足参考 ${K_MEAL_GOOD} mg、偏少线 ${K_MEAL_LOW} mg`
      },
    },
    grid: { left: 56, right: 72, top: 24, bottom: 40 },
    xAxis: {
      type: 'category',
      data: ['本餐钠（mg）', '本餐钾（mg）'],
      axisTick: { show: false },
      axisLine: { lineStyle: { color: AXIS_LINE } },
      // 轴标签禁用状态色：钠钾无论高低都用统一中性文字色
      axisLabel: { color: TEXT_SECONDARY, fontSize: CHART_FONT.axis, fontWeight: 600 },
    },
    // 双 y 轴均为本餐口径：左钠（上限随本餐钠放宽）、右钾 0–1500；
    // 轴名/刻度统一中性色，不随钠钾值变色（只有柱体变色）
    yAxis: [
      {
        type: 'value',
        min: 0,
        max: naAxisMax.value,
        name: '本餐钠（mg）',
        nameTextStyle: { color: TEXT_SECONDARY, fontSize: CHART_FONT.axis, padding: [0, 0, 0, 24] },
        splitLine: { lineStyle: { color: SPLIT_LINE } },
        axisLabel: { color: TEXT_SECONDARY, fontSize: CHART_FONT.axis },
      },
      {
        type: 'value',
        min: 0,
        max: K_MEAL_AXIS_MAX,
        name: '本餐钾（mg）',
        nameTextStyle: { color: TEXT_SECONDARY, fontSize: CHART_FONT.axis, padding: [0, 24, 0, 0] },
        splitLine: { show: false },
        axisLabel: { color: TEXT_SECONDARY, fontSize: CHART_FONT.axis },
      },
    ],
    series: [
      {
        name: '钠',
        type: 'bar',
        yAxisIndex: 0,
        barWidth: '46%',
        data: [
          {
            value: na.value,
            itemStyle: { color: naColor.value, borderRadius: [8, 8, 0, 0] },
          },
          null,
        ],
        label: {
          show: true,
          position: 'top',
          formatter: () => `约 ${na.value}`,
          color: TEXT_MAIN,
          fontSize: CHART_FONT.title,
          fontWeight: 700,
        },
        markLine: {
          silent: true,
          symbol: 'none',
          // 直角坐标系两点线段必须用 [{coord:[x,y]},{coord:[x,y]}] 形式；
          // 线段收在钠柱区间内侧（柱中心0、半宽0.23；起点 -0.1 避开左轴刻度遮挡文字），
          // 红线绝不横跨到右侧“钾”柱。注意：标签挂在哪个点对象就锚在哪一端。
          data: [
            [
              {
                coord: [-0.1, NA_MEAL],
                lineStyle: { color: BAR_RED, type: 'dashed', width: 1.5 },
              },
              {
                coord: [0.23, NA_MEAL],
                // 标签必须挂在线段终点对象上，才能锚在右端（挂起点+end 位会被 ECharts 甩到画布边缘）
                label: {
                  show: true,
                  position: 'insideStartTop',
                  formatter: `本餐上限 ${NA_MEAL}mg`,
                  color: TEXT_DANGER,
                  fontSize: CHART_FONT.axis,
                  fontWeight: 600,
                },
              },
            ],
            [
              {
                coord: [-0.1, NA_MEAL_WARN_MG],
                lineStyle: { color: BAR_YELLOW, type: 'dashed', width: 1.5 },
                label: {
                  show: true,
                  position: 'insideStartTop',
                  formatter: `偏咸 ${NA_MEAL_WARN_MG}mg`,
                  color: TEXT_WARNING,
                  fontSize: CHART_FONT.small,
                  fontWeight: 600,
                },
              },
              { coord: [0.23, NA_MEAL_WARN_MG] },
            ],
          ],
        },
      },
      {
        name: '钾',
        type: 'bar',
        yAxisIndex: 1,
        barWidth: '46%',
        data: [
          null,
          {
            value: k.value,
            itemStyle: { color: kColor.value, borderRadius: [8, 8, 0, 0] },
          },
        ],
        label: {
          show: true,
          position: 'top',
          formatter: () => `${k.value}`,
          color: TEXT_MAIN,
          fontSize: CHART_FONT.title,
          fontWeight: 700,
        },
      },
    ],
  }
})

const { el } = useEcharts(option)
</script>

<template>
  <section class="nd-card na-budget-card">
    <div class="na-budget-card__head">
      <div class="na-budget-card__titles">
        <h2 class="result-section-title">这餐钠占全天预算</h2>
        <p class="na-budget-card__subtitle">
          柱图按本餐估算：钠看 600/800mg 本餐线、钾看 800/1000mg 本餐线；800mg
          是参考线，不是医学限值
        </p>
      </div>
      <DemoBadge text="演示数据" />
    </div>

    <!-- 百分比 + 盐当量（百分比为"这餐占全天预算"口径，与柱图本餐判级分开表述） -->
    <div class="na-budget-card__summary">
      <div class="na-budget-card__percent">
        <span class="na-budget-card__percent-num">{{ naPercent }}</span>
        <span class="na-budget-card__percent-unit">%</span>
        <span class="na-budget-card__percent-label">这餐占全天 {{ NA_DAY }}mg 预算</span>
      </div>
      <div class="na-budget-card__salt">
        <p class="na-budget-card__salt-line">
          约 <strong>{{ na }}</strong> mg 钠 ≈ <strong>{{ saltG }}</strong> g 盐
        </p>
        <p class="na-budget-card__salt-hint">一天食盐不超过 5g（约一啤酒瓶盖）</p>
      </div>
    </div>

    <div
      ref="el"
      class="na-budget-card__chart"
      role="img"
      :aria-label="`本餐钠约${na}毫克，钾约${k}毫克`"
    />

    <!-- 钾条说明 + 安全提示 -->
    <div class="na-budget-card__k-note">
      <p
        class="na-budget-card__k-status"
        :class="{
          'na-budget-card__k-status--renal': renal,
          'na-budget-card__k-status--unknown': renalUnknown,
        }"
      >
        {{ kStatusText }}
      </p>
      <p
        v-if="!renalUnknown"
        class="na-budget-card__safety"
        :class="{ 'na-budget-card__safety--renal': renal }"
      >
        <template v-if="renal">
          按您的情况，富钾食物和低钠盐都要控制，具体量请咨询医生或营养师。
        </template>
        <template v-else>
          肾不好或正在吃普利/沙坦类降压药，补钾先问医生；别自己吃补钾片，低钠盐（氯化钾代盐）也要先问大夫。
        </template>
      </p>
    </div>
  </section>
</template>

<style scoped>
.na-budget-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.na-budget-card__titles {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.na-budget-card__subtitle {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* 百分比 + 盐当量摘要区 */
.na-budget-card__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
  margin-bottom: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  background-color: var(--color-bg-warm);
  border-radius: var(--radius-md);
}

.na-budget-card__percent {
  display: flex;
  align-items: baseline;
  gap: 2px;
  flex-wrap: wrap;
}

.na-budget-card__percent-num {
  font-size: 2.5rem;
  font-weight: 800;
  line-height: 1;
  color: var(--color-text);
}

.na-budget-card__percent-unit {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
}

.na-budget-card__percent-label {
  flex-basis: 100%;
  margin-top: var(--space-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.na-budget-card__salt {
  text-align: right;
}

.na-budget-card__salt-line {
  margin: 0;
  font-size: var(--font-size-base);
  color: var(--color-text);
}

.na-budget-card__salt-line strong {
  font-weight: 700;
  color: var(--color-primary);
}

.na-budget-card__salt-hint {
  margin: var(--space-xs) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.na-budget-card__chart {
  width: 100%;
  height: 260px;
}

/* 钾说明 + 安全提示 */
.na-budget-card__k-note {
  margin-top: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.na-budget-card__k-status {
  margin: 0;
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  color: var(--color-text);
}

/* 控钾提示文字用深色危险 token（暖底上对比度达标），不用亮红 #d93025 */
.na-budget-card__k-status--renal {
  font-weight: 700;
  color: var(--color-danger-text);
}

/* 肾功能未知：钾提示为中性提醒色（不用醒目的红/黄） */
.na-budget-card__k-status--unknown {
  color: var(--color-warning-text);
}

.na-budget-card__safety {
  margin: 0;
  padding: var(--space-sm) var(--space-md);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  color: var(--color-text-secondary);
  background-color: var(--color-bg-warm);
  border-left: 3px solid var(--color-warning);
  border-radius: var(--radius-sm);
}

.na-budget-card__safety--renal {
  border-left-color: var(--color-danger);
  color: var(--color-danger-text);
  font-weight: 600;
}

@media (max-width: 767px) {
  .na-budget-card__summary {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-sm);
  }

  .na-budget-card__salt {
    text-align: left;
  }

  .na-budget-card__chart {
    height: 220px;
  }
}
</style>
