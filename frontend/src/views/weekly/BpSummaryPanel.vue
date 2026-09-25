<script setup lang="ts">
import { computed } from 'vue'
import { Printer } from '@element-plus/icons-vue'
import DemoBadge from '@/components/common/DemoBadge.vue'
import { BP_THRESHOLDS } from '@/constants/dict'
import { RED_FLAG_SYMPTOMS } from '@/constants/clinical'
import type { WeeklyBpResult } from '@/types'

const props = withDefaults(
  defineProps<{
    bp: WeeklyBpResult
    /** 近 7 天日均钠摄入（mg），用于钠联动文案 */
    avgDailyNa?: number
  }>(),
  { avgDailyNa: 0 },
)

const emit = defineEmits<{
  print: []
}>()

// 家庭自测口径阈值（mmHg），统一来自 dict，禁止本组件硬编码
const HOME_SYS = BP_THRESHOLDS.home.sys
const HOME_DIA = BP_THRESHOLDS.home.dia

function fmtBp(value: { sys: number; dia: number } | null): string {
  if (!value) return '— / —'
  return `${Math.round(value.sys)} / ${Math.round(value.dia)}`
}

const morningText = computed(() => fmtBp(props.bp.avgMorning))
const eveningText = computed(() => fmtBp(props.bp.avgEvening))
const maxText = computed(() => `${props.bp.maxSys || 0} / ${props.bp.maxDia || 0}`)

// 晨峰标注：晨起均值 ≥ 家庭阈值时高亮提醒
const morningHigh = computed(
  () =>
    props.bp.avgMorning !== null &&
    (props.bp.avgMorning.sys >= HOME_SYS || props.bp.avgMorning.dia >= HOME_DIA),
)

// 钠与血压：统一长期科普口径，不做“吃咸了第二天升高”式个人归因
const sodiumLink = computed(() => {
  if (props.bp.adviceLevel === 'emergency') return ''
  if (props.bp.adviceLevel === 'stable') {
    return '这周血压挺稳，继续保持清淡和散步。'
  }
  return '长期少吃盐，有助于血压平稳。'
})

// 急症症状名一律从 clinical 常量派生，禁止在组件里硬编码症状简称
const emergencySymptomText = computed(() =>
  ['chest_pain', 'weak_side', 'headache']
    .map((id) => RED_FLAG_SYMPTOMS.find((s) => s.id === id)?.label)
    .filter(Boolean)
    .join('、'),
)

// 结论等级对应的样式与文案
const verdict = computed(() => {
  switch (props.bp.adviceLevel) {
    case 'emergency':
      return {
        tone: 'emergency',
        title: '本周出现过很高的血压',
        action: `如有${emergencySymptomText.value}，请立即拨打 120`,
      }
    case 'high':
      return {
        tone: 'high',
        title: '本周血压偏高',
        action: '建议带着这份记录找医生确认，别自己加药或停药',
      }
    default:
      return {
        tone: 'stable',
        title: '本周血压整体平稳',
        action: '继续保持清淡饮食和规律测量',
      }
  }
})
</script>

<template>
  <section class="bp-summary nd-card">
    <header class="bp-summary__head">
      <div class="bp-summary__title-row">
        <h2 class="bp-summary__title">本周血压</h2>
        <DemoBadge text="演示数据" />
      </div>
      <p class="bp-summary__note">家庭自测口径，家里量 {{ HOME_SYS }}/{{ HOME_DIA }} 以上要留意</p>
    </header>

    <!-- 五数字 -->
    <div class="bp-stats">
      <div class="bp-stat">
        <p class="bp-stat__label">晨起 7 天均值</p>
        <p class="bp-stat__value" :class="{ 'is-high': morningHigh }">{{ morningText }}</p>
        <p v-if="morningHigh" class="bp-stat__flag">晨起偏高，留意清晨高血压</p>
      </div>
      <div class="bp-stat">
        <p class="bp-stat__label">晚间 7 天均值</p>
        <p class="bp-stat__value">{{ eveningText }}</p>
      </div>
      <div class="bp-stat">
        <p class="bp-stat__label">本周最高</p>
        <p class="bp-stat__value">{{ maxText }}</p>
      </div>
      <div class="bp-stat">
        <p class="bp-stat__label">≥{{ HOME_SYS }}/{{ HOME_DIA }} 天数</p>
        <p class="bp-stat__value">{{ bp.homeHighDays }}<span class="bp-stat__unit">天</span></p>
        <p class="bp-stat__flag">家庭口径，仅记录不下诊断</p>
      </div>
      <div class="bp-stat">
        <p class="bp-stat__label">手动记录</p>
        <p class="bp-stat__value">{{ bp.manualCount }}<span class="bp-stat__unit">次</span></p>
      </div>
    </div>

    <!-- 结论 -->
    <div class="bp-verdict" :class="`bp-verdict--${verdict.tone}`">
      <h3 class="bp-verdict__title">{{ verdict.title }}</h3>
      <p class="bp-verdict__text">{{ bp.adviceText }}</p>
      <p v-if="verdict.tone === 'emergency'" class="bp-verdict__action">{{ verdict.action }}</p>
    </div>

    <!-- 钠联动 -->
    <p v-if="sodiumLink" class="bp-sodium-link">{{ sodiumLink }}</p>

    <!-- 测量频率建议 -->
    <div class="bp-freq">
      <p class="bp-freq__label">测量频率建议</p>
      <p class="bp-freq__text">{{ bp.measureFreqAdvice }}</p>
    </div>

    <!-- 打印按钮 -->
    <button type="button" class="bp-print-btn" @click="emit('print')">
      <el-icon class="bp-print-btn__icon" aria-hidden="true"><Printer /></el-icon>
      <span>打印 / 存成 PDF 给医生看</span>
    </button>
  </section>
</template>

<style scoped>
.bp-summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.bp-summary__head {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.bp-summary__title-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.bp-summary__title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-text);
}

.bp-summary__note {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* 五数字网格 */
.bp-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-md);
}

.bp-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-md);
  background-color: var(--color-bg-warm);
  border-radius: var(--radius-md);
}

.bp-stat__label {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.bp-stat__value {
  margin: 0;
  font-size: 1.9rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-text);
}

.bp-stat__value.is-high {
  color: var(--color-danger);
}

.bp-stat__unit {
  margin-left: 4px;
  font-size: var(--font-size-base);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.bp-stat__flag {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-warning-text);
}

/* 结论 */
.bp-verdict {
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-md);
  border-left: 5px solid var(--color-success);
  background-color: color-mix(in srgb, var(--color-success) 8%, var(--color-bg-card));
}

.bp-verdict--high {
  border-left-color: var(--color-warning);
  background-color: color-mix(in srgb, var(--color-warning) 10%, var(--color-bg-card));
}

.bp-verdict--emergency {
  border-left-color: var(--color-danger);
  background-color: color-mix(in srgb, var(--color-danger) 10%, var(--color-bg-card));
}

.bp-verdict__title {
  margin: 0 0 var(--space-xs);
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--color-text);
}

.bp-verdict__text {
  margin: 0;
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  color: var(--color-text);
}

.bp-verdict__action {
  margin: var(--space-sm) 0 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-danger);
}

/* 钠联动 */
.bp-sodium-link {
  margin: 0;
  padding: var(--space-sm) var(--space-md);
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  color: var(--color-text);
  background-color: var(--color-bg-warm);
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius-sm);
}

/* 测量频率建议 */
.bp-freq {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bp-freq__label {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.bp-freq__text {
  margin: 0;
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  color: var(--color-text);
}

/* 打印按钮 */
.bp-print-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  min-height: 56px;
  padding: 12px 28px;
  font-family: inherit;
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--color-text-inverse);
  cursor: pointer;
  background-color: var(--color-primary);
  border: none;
  border-radius: var(--radius-lg);
  transition:
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

.bp-print-btn:hover {
  background-color: var(--color-primary-dark, #0a5f4a);
  box-shadow: var(--shadow-md);
}

.bp-print-btn:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 2px;
}

.bp-print-btn__icon {
  font-size: 1.3em;
}

@media (max-width: 767px) {
  .bp-print-btn {
    width: 100%;
  }
}
</style>
