<script setup lang="ts">
import { computed } from 'vue'
import { Close, Printer } from '@element-plus/icons-vue'
import { BP_THRESHOLDS } from '@/constants/dict'
import { formatRelTime, recentDates } from '@/utils/date'
import type { BpRecord, Profile, WeeklyBpResult } from '@/types'

// 家庭自测阈值统一来自 dict，禁止本组件硬编码 135/85
const HOME_SYS = BP_THRESHOLDS.home.sys
const HOME_DIA = BP_THRESHOLDS.home.dia

const props = withDefaults(
  defineProps<{
    visible?: boolean
    bp: WeeklyBpResult
    records?: BpRecord[]
    profile?: Partial<Profile>
    medicationDays?: number
  }>(),
  { visible: false, records: () => [], profile: () => ({}), medicationDays: 0 },
)

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

// 演示模式（含未配置环境变量）：页眉必须挂红框横幅，打印时也可见
const showDemoBanner = import.meta.env.VITE_USE_MOCK !== 'false'

const dateRange = computed(() => {
  const dates = recentDates(7)
  const from = dates[0]
  const to = dates[dates.length - 1]
  const toMD = (d: string) => {
    const [, m, day] = d.split('-')
    return `${Number(m)}月${Number(day)}日`
  }
  return `${toMD(from)} - ${toMD(to)}`
})

const userName = computed(() => props.profile?.name || '未填写')
const userAge = computed(() => (props.profile?.age ? `${props.profile.age} 岁` : '未填写'))

function fmtBp(value: { sys: number; dia: number } | null): string {
  if (!value) return '— / —'
  return `${Math.round(value.sys)} / ${Math.round(value.dia)}`
}

// 每日明细：按日期分组，每条记录一行（晨起/睡前）
const detailRows = computed(() => {
  const rows: {
    date: string
    period: 'morning' | 'evening'
    time: string
    bp: string
    hr: string
    arm: string
    symptoms: string
    source: string
  }[] = []
  const sorted = [...props.records].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
  for (const r of sorted) {
    rows.push({
      date: r.date,
      period: r.period,
      time: formatRelTime(r.measuredAt, r.period),
      bp: `${r.sys} / ${r.dia}`,
      hr: r.hr ? String(r.hr) : '—',
      arm: r.arm === 'left' ? '左' : r.arm === 'right' ? '右' : '—',
      symptoms: r.symptoms ? r.symptoms : '—',
      source: r.source === 'manual' ? '手动记录' : '设备同步',
    })
  }
  return rows
})

// 本周存在脉搏不整齐记录：结论区提醒做心电图
const hasIrregularPulse = computed(() => props.records.some((r) => r.pulseRegular === false))

function closePrint() {
  emit('update:visible', false)
}

function doPrint() {
  window.print()
}
</script>

<template>
  <div v-if="visible" class="bp-print-overlay">
    <div class="bp-print-toolbar">
      <div class="bp-print-toolbar__inner">
        <button type="button" class="bp-print-close" aria-label="关闭打印视图" @click="closePrint">
          <el-icon aria-hidden="true"><Close /></el-icon>
          <span>返回</span>
        </button>
        <button type="button" class="bp-print-do" @click="doPrint">
          <el-icon aria-hidden="true"><Printer /></el-icon>
          <span>打印 / 另存为 PDF</span>
        </button>
      </div>
    </div>

    <div class="bp-print-page">
      <!-- 演示数据横幅：屏幕与打印都必须可见 -->
      <div v-if="showDemoBanner" class="bp-print-demo-banner">演示数据 · 禁止用于诊疗</div>

      <!-- 打印三步走：只在屏幕上引导长辈，打印时隐藏 -->
      <section class="bp-print-guide" aria-label="打印三步走">
        <h2 class="bp-print-guide__title">打印就三步</h2>
        <ol class="bp-print-guide__steps">
          <li>点页面左上角的“打印 / 另存为 PDF”按钮</li>
          <li>在弹出的框里选打印机，或选“另存为 PDF”</li>
          <li>打出来（或存好）拿给家人或医生看</li>
        </ol>
      </section>

      <header class="bp-print-header">
        <h1 class="bp-print-header__title">家庭血压自测记录</h1>
        <p class="bp-print-header__sub">近 7 天 · 家庭自测口径（{{ HOME_SYS }}/{{ HOME_DIA }}）</p>
      </header>

      <section class="bp-print-meta">
        <div class="bp-print-meta__item">
          <span class="bp-print-meta__label">姓名</span>
          <span class="bp-print-meta__value">{{ userName }}</span>
        </div>
        <div class="bp-print-meta__item">
          <span class="bp-print-meta__label">年龄</span>
          <span class="bp-print-meta__value">{{ userAge }}</span>
        </div>
        <div class="bp-print-meta__item">
          <span class="bp-print-meta__label">统计区间</span>
          <span class="bp-print-meta__value">{{ dateRange }}</span>
        </div>
      </section>

      <section class="bp-print-summary">
        <h2 class="bp-print-section__title">血压汇总</h2>
        <div class="bp-print-summary__grid">
          <div class="bp-print-cell">
            <p class="bp-print-cell__label">晨起均值</p>
            <p class="bp-print-cell__value">{{ fmtBp(bp.avgMorning) }}</p>
          </div>
          <div class="bp-print-cell">
            <p class="bp-print-cell__label">晚间均值</p>
            <p class="bp-print-cell__value">{{ fmtBp(bp.avgEvening) }}</p>
          </div>
          <div class="bp-print-cell">
            <p class="bp-print-cell__label">本周最高</p>
            <p class="bp-print-cell__value">{{ bp.maxSys }} / {{ bp.maxDia }}</p>
          </div>
          <div class="bp-print-cell">
            <p class="bp-print-cell__label">≥{{ HOME_SYS }}/{{ HOME_DIA }} 天数</p>
            <p class="bp-print-cell__value">{{ bp.homeHighDays }} 天</p>
          </div>
          <div class="bp-print-cell">
            <p class="bp-print-cell__label">手动记录</p>
            <p class="bp-print-cell__value">{{ bp.manualCount }} 次</p>
          </div>
          <div class="bp-print-cell">
            <p class="bp-print-cell__label">服药打卡</p>
            <p class="bp-print-cell__value">{{ medicationDays }} 天</p>
          </div>
        </div>
        <p class="bp-print-advice">{{ bp.adviceText }}</p>
        <p v-if="hasIrregularPulse" class="bp-print-pulse-note">本周有脉搏不齐记录，建议做心电图</p>
      </section>

      <section class="bp-print-detail">
        <h2 class="bp-print-section__title">每日明细</h2>
        <!-- 小屏兜底：7 列明细表横向滚动，不挤爆 390px 屏 -->
        <div class="bp-print-table-wrap">
          <table class="bp-print-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>时段</th>
                <th>血压（收缩/舒张）</th>
                <th>心率</th>
                <th>臂别</th>
                <th>症状</th>
                <th>来源</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in detailRows" :key="idx">
                <td>{{ row.date }}</td>
                <td>{{ row.time }}</td>
                <td>{{ row.bp }}</td>
                <td>{{ row.hr }}</td>
                <td>{{ row.arm }}</td>
                <td>{{ row.symptoms }}</td>
                <td>{{ row.source }}</td>
              </tr>
              <tr v-if="!detailRows.length">
                <td colspan="7">本周暂无血压记录</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <footer class="bp-print-footer">
        <p>家庭自测记录，供医生参考，不代替诊室测量。</p>
      </footer>
    </div>
  </div>
</template>

<style>
/* 非 scoped：@media print 需要全局生效，隐藏 app 壳仅显示打印页 */
@media print {
  body * {
    visibility: hidden;
  }
  .bp-print-overlay,
  .bp-print-overlay * {
    visibility: visible;
  }
  .bp-print-overlay {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
  }
  .bp-print-toolbar {
    display: none !important;
  }
  /* 打印三步走只在屏幕上引导长辈，纸质/PDF 不出现 */
  .bp-print-guide {
    display: none !important;
  }
  .bp-print-page {
    box-shadow: none !important;
    margin: 0 !important;
    max-width: none !important;
  }
}
</style>

<style scoped>
.bp-print-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background-color: #f5f5f5;
  overflow-y: auto;
}

.bp-print-toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  justify-content: center;
  padding: 12px 16px;
  background-color: #fff;
  border-bottom: 1px solid #e5ddcd;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.bp-print-toolbar__inner {
  display: flex;
  gap: 12px;
  width: 100%;
  max-width: 720px;
}

.bp-print-close,
.bp-print-do {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 48px;
  padding: 8px 20px;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 8px;
  border: 2px solid var(--color-border);
  background-color: #fff;
  color: var(--color-text);
}

.bp-print-do {
  flex: 1;
  color: #fff;
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

.bp-print-page {
  width: 100%;
  max-width: 720px;
  margin: 24px auto;
  padding: 32px;
  background-color: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.bp-print-header {
  text-align: center;
  margin-bottom: 24px;
}

.bp-print-header__title {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  color: #2b2a26;
}

.bp-print-header__sub {
  margin: 6px 0 0;
  font-size: 0.95rem;
  color: #6b675e;
}

.bp-print-section__title {
  margin: 24px 0 12px;
  font-size: 1.15rem;
  font-weight: 700;
  color: #2b2a26;
  border-bottom: 2px solid #e5ddcd;
  padding-bottom: 6px;
}

.bp-print-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 16px;
  background-color: #faf7f0;
  border-radius: 8px;
  margin-bottom: 8px;
}

.bp-print-meta__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bp-print-meta__label {
  font-size: 0.85rem;
  color: #6b675e;
}

.bp-print-meta__value {
  font-size: 1.05rem;
  font-weight: 600;
  color: #2b2a26;
}

.bp-print-summary__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.bp-print-cell {
  padding: 12px;
  background-color: #faf7f0;
  border-radius: 6px;
  text-align: center;
}

.bp-print-cell__label {
  margin: 0;
  font-size: 0.85rem;
  color: #6b675e;
}

.bp-print-cell__value {
  margin: 4px 0 0;
  font-size: 1.3rem;
  font-weight: 700;
  color: #2b2a26;
}

.bp-print-advice {
  margin: 12px 0 0;
  padding: 10px 14px;
  font-size: 0.95rem;
  line-height: 1.6;
  color: #2b2a26;
  background-color: #faf7f0;
  border-left: 3px solid var(--color-primary);
  border-radius: 4px;
}

/* 演示数据红框横幅：大号、屏幕与打印均可见 */
.bp-print-demo-banner {
  margin-bottom: 16px;
  padding: 12px 16px;
  font-size: 1.25rem;
  font-weight: 700;
  text-align: center;
  color: #b3261e;
  background-color: #fef2f2;
  border: 3px solid #d93025;
  border-radius: 8px;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}

.bp-print-pulse-note {
  margin: 8px 0 0;
  padding: 10px 14px;
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.6;
  color: var(--color-warning-text, #8a4b08);
  background-color: var(--color-warning-bg, #fff8e6);
  border-left: 3px solid #d97706;
  border-radius: 4px;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}

@media print {
  .bp-print-demo-banner,
  .bp-print-pulse-note {
    visibility: visible;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}

/* 屏幕可见的“打印三步走”白话指引（@media print 下由全局块隐藏） */
.bp-print-guide {
  margin-bottom: 20px;
  padding: 16px;
  background-color: #faf7f0;
  border: 2px solid var(--color-primary);
  border-radius: 8px;
}

.bp-print-guide__title {
  margin: 0 0 8px;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-primary-dark, #0a5f4a);
}

.bp-print-guide__steps {
  margin: 0;
  padding-left: 1.4em;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 1rem;
  line-height: 1.6;
  color: #2b2a26;
}

/* 7 列明细表小屏横向滚动兜底 */
.bp-print-table-wrap {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.bp-print-table {
  width: 100%;
  min-width: 560px;
  border-collapse: collapse;
  font-size: 0.95rem;
}

.bp-print-table th,
.bp-print-table td {
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid #e5ddcd;
}

.bp-print-table th {
  font-weight: 600;
  color: #6b675e;
  background-color: #faf7f0;
}

.bp-print-footer {
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid #e5ddcd;
}

.bp-print-footer p {
  margin: 0;
  font-size: 0.85rem;
  color: #6b675e;
  text-align: center;
}

@media (max-width: 767px) {
  .bp-print-page {
    padding: 20px 16px;
    margin: 12px auto;
  }

  .bp-print-summary__grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .bp-print-table {
    font-size: 0.85rem;
  }

  .bp-print-table th,
  .bp-print-table td {
    padding: 6px 4px;
  }
}
</style>
