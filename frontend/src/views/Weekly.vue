<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ReadingLamp } from '@element-plus/icons-vue'
import { useBpLogStore } from '@/stores/bpLog'
import { useMedicationStore } from '@/stores/medication'
import { useDevicesStore } from '@/stores/devices'
import { useProfileStore } from '@/stores/profile'
import { getDeviceData, ensureDeviceData, getWeekly } from '@/api'
import { buildWeeklyBp, buildWeekly } from '@/utils/nutrition'
import { recentDates } from '@/utils/date'
import EmptyState from '@/components/common/EmptyState.vue'
import DemoBadge from '@/components/common/DemoBadge.vue'
import NaBarChart from './weekly/NaBarChart.vue'
import ScoreLineChart from './weekly/ScoreLineChart.vue'
import DietScorePanel from './weekly/DietScorePanel.vue'
import BpSummaryPanel from './weekly/BpSummaryPanel.vue'
import DashWeekPanel from './weekly/DashWeekPanel.vue'
import BpPrintView from './weekly/BpPrintView.vue'
import type { WeeklyDay, WeeklyResult } from '@/utils/nutrition'
import type { BpRecord } from '@/types'

const router = useRouter()
const bpLog = useBpLogStore()
const medication = useMedicationStore()
const devices = useDevicesStore()
const profileStore = useProfileStore()

// BP 设备未连接时不合入任何设备 mock 血压（与健康页 BpCard 口径一致）
const bpDeviceConnected = computed(() => devices.isConnected('bp'))

// 首帧空周（7 天全 null），onMounted 经 api.getWeekly 填充
// （mock 分支等价于本地 buildWeekly；真实分支 GET /api/weekly）
const weekly = ref<WeeklyResult>(buildWeekly([]))
const bpRecords = ref<BpRecord[]>([])
const medicationDays = ref(0)
const printVisible = ref(false)

async function refresh() {
  const [weeklyResult] = await Promise.all([getWeekly(), ensureDeviceData(profileStore.profile)])
  weekly.value = weeklyResult

  // 血压：设备模拟数据 + 手动记录合并
  const deviceData = await getDeviceData()
  const dates = recentDates(7)
  // 同一日期+时段已有手动记录时，丢弃该时段的设备 mock 记录
  const manualSlots = new Set(bpLog.records.map((r) => `${r.date}_${r.period}`))
  const deviceRecords: BpRecord[] = []
  for (const date of dates) {
    const day = deviceData.days[date]
    if (!day) continue
    if (bpDeviceConnected.value && day.bpMorning && !manualSlots.has(`${date}_morning`)) {
      deviceRecords.push({
        id: `dev_m_${date}`,
        measuredAt: `${date}T07:00:00`,
        date,
        period: 'morning',
        sys: day.bpMorning[0],
        dia: day.bpMorning[1],
        hr: day.hr ?? null,
        source: 'device',
        readings: [{ sys: day.bpMorning[0], dia: day.bpMorning[1] }],
        createdAt: `${date}T07:00:00`,
      })
    }
    if (bpDeviceConnected.value && day.bpEvening && !manualSlots.has(`${date}_evening`)) {
      deviceRecords.push({
        id: `dev_e_${date}`,
        measuredAt: `${date}T21:00:00`,
        date,
        period: 'evening',
        sys: day.bpEvening[0],
        dia: day.bpEvening[1],
        hr: day.hr ?? null,
        source: 'device',
        readings: [{ sys: day.bpEvening[0], dia: day.bpEvening[1] }],
        createdAt: `${date}T21:00:00`,
      })
    }
  }
  bpRecords.value = [...deviceRecords, ...bpLog.records].sort((a, b) =>
    b.measuredAt.localeCompare(a.measuredAt),
  )

  // 服药打卡天数（近 7 天）
  const medDateSet = new Set(medication.records.map((r) => r.date))
  medicationDays.value = dates.filter((d) => medDateSet.has(d)).length
}

onMounted(async () => {
  const dates = recentDates(7)
  const from = dates[0]
  const to = dates[dates.length - 1]
  await Promise.all([bpLog.load({ from, to }), medication.load({ from, to })])
  await refresh()
})

/**
 * 周报统计口径：同一槽位（date+period）有多条手动记录时，
 * 取 measuredAt 最新的一条再进 buildWeeklyBp（与 BpCard.manualBySlot 一致）；
 * 打印明细仍逐行展示全部 bpRecords，不受这里影响。
 */
function collapseManualBySlot(records: BpRecord[]): BpRecord[] {
  const deviceRecords = records.filter((r) => r.source !== 'manual')
  const latestBySlot = new Map<string, BpRecord>()
  for (const r of records) {
    if (r.source !== 'manual') continue
    const key = `${r.date}_${r.period}`
    const exist = latestBySlot.get(key)
    if (!exist || r.measuredAt > exist.measuredAt) {
      latestBySlot.set(key, r)
    }
  }
  return [...deviceRecords, ...latestBySlot.values()]
}

const weeklyBp = computed(() => buildWeeklyBp(collapseManualBySlot(bpRecords.value)))

// 近 7 天日均钠（mg），用于钠联动文案
const avgDailyNa = computed(() => {
  const active = weekly.value.days.filter((d): d is WeeklyDay => d !== null)
  if (!active.length) return 0
  return Math.round(active.reduce((s, d) => s + d.na, 0) / active.length)
})

// 零餐次：最近 7 天 days 全为 null（以服务端周报口径为准，不依赖本地 store）
const hasMeals = computed(() => weekly.value.days.some(Boolean))

const avgScore = computed(() => Math.round(Number(weekly.value.avgScore) || 0))

const verdict = computed(() => {
  if (avgScore.value >= 80) return { text: '很棒', level: 'green' }
  if (avgScore.value >= 60) return { text: '还可以', level: 'yellow' }
  return { text: '再调整', level: 'red' }
})

const dateRange = computed(() => {
  const active = weekly.value.days.filter((d): d is WeeklyDay => d !== null)
  if (!active.length) {
    const dates = recentDates(7)
    const toMD = (d: string) => {
      const [, m, day] = d.split('-')
      return `${Number(m)}/${Number(day)}`
    }
    return `${toMD(dates[0])} - ${toMD(dates[dates.length - 1])}`
  }
  const toMD = (date: string) => {
    const [, month, day] = date.split('-')
    return `${Number(month)}/${Number(day)}`
  }
  return `${toMD(active[0].date)} - ${toMD(active[active.length - 1].date)}`
})

const adviceText = computed(() => weekly.value.advice || '继续保持荤素搭配，主食换点杂粮更好')

function goHome() {
  router.push('/')
}

function openPrint() {
  printVisible.value = true
}
</script>

<template>
  <div class="page-container weekly-page">
    <!-- 血压面板：零餐次也显示 -->
    <BpSummaryPanel :bp="weeklyBp" :avg-daily-na="avgDailyNa" @print="openPrint" />

    <!-- 无餐次：饮食图表区空态 -->
    <EmptyState
      v-if="!hasMeals"
      icon="Bowl"
      title="还没有一周饮食记录"
      desc="拍两顿饭后，就能看到这周吃得怎么样啦"
      action-text="去拍今天的饭菜"
      @action="goHome"
    />

    <template v-else>
      <header class="weekly-hero nd-card">
        <div class="weekly-hero__intro">
          <div class="weekly-hero__title-row">
            <h1 class="weekly-hero__title">这一周的饮食小结</h1>
            <DemoBadge text="演示数据" />
          </div>
          <p class="weekly-hero__range">{{ dateRange }} · 最近 7 天</p>
        </div>
        <div class="weekly-hero__score">
          <div class="weekly-hero__ring" :class="`is-${verdict.level}`">
            <span class="weekly-hero__number">{{ avgScore }}</span>
            <span class="weekly-hero__number-unit">分</span>
          </div>
          <span class="weekly-hero__verdict" :class="`is-${verdict.level}`">
            {{ verdict.text }}
          </span>
        </div>
      </header>

      <div class="weekly-charts">
        <NaBarChart :days="weekly.days" />
        <ScoreLineChart class="weekly-charts__wide" :days="weekly.days" />
      </div>

      <DashWeekPanel :days="weekly.days" :profile="profileStore.profile" :bp-records="bpRecords" />

      <DietScorePanel :scores="weekly.dietScores" />

      <section class="weekly-advice nd-card">
        <el-icon class="weekly-advice__icon" aria-hidden="true">
          <ReadingLamp />
        </el-icon>
        <p class="weekly-advice__text">{{ adviceText }}</p>
      </section>
    </template>

    <!-- 打印 / 存 PDF 给医生看 覆盖层 -->
    <BpPrintView
      v-model:visible="printVisible"
      :bp="weeklyBp"
      :records="bpRecords"
      :profile="profileStore.profile"
      :medication-days="medicationDays"
    />
  </div>
</template>

<style scoped>
.weekly-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

/* ---------- 页头 ---------- */
.weekly-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-xl);
  flex-wrap: wrap;
}

.weekly-hero__title-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.weekly-hero__title {
  margin: 0;
  font-size: var(--font-size-xxl);
  font-weight: 700;
  color: var(--color-text);
}

.weekly-hero__range {
  margin: var(--space-sm) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.weekly-hero__score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

.weekly-hero__ring {
  display: flex;
  align-items: baseline;
  justify-content: center;
  width: 132px;
  height: 132px;
  border: 8px solid currentColor;
  border-radius: 50%;
  background-color: var(--color-bg-warm);
}

.weekly-hero__number {
  font-size: 3rem;
  font-weight: 700;
  line-height: 1;
}

.weekly-hero__number-unit {
  font-size: var(--font-size-base);
  font-weight: 600;
}

.weekly-hero__verdict {
  font-size: var(--font-size-lg);
  font-weight: 600;
}

/* ---------- 图表区：宽屏两列，折线整行；窄屏单列 ---------- */
.weekly-charts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-lg);
}

.weekly-charts__wide {
  grid-column: 1 / -1;
}

/* ---------- 底部建议卡 ---------- */
.weekly-advice {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  background-color: var(--color-bg-warm);
}

.weekly-advice__icon {
  flex-shrink: 0;
  margin-top: 2px;
  font-size: var(--font-size-xl);
  color: var(--color-warning);
}

.weekly-advice__text {
  margin: 0;
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  color: var(--color-text);
}

/* ---------- 颜色档（装饰环用原色 token） ---------- */
.is-green {
  color: var(--color-success);
}

.is-yellow {
  color: var(--color-warning);
}

.is-red {
  color: var(--color-danger);
}

/* 黄色档文字用更深的警告文字色，保证米白底上对比度；环仍用 --color-warning */
.weekly-hero__verdict.is-yellow {
  color: var(--color-warning-strong);
}

@media (max-width: 767px) {
  .weekly-charts {
    grid-template-columns: 1fr;
  }

  .weekly-charts__wide {
    grid-column: auto;
  }

  .weekly-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .weekly-hero__score {
    align-self: center;
  }
}
</style>
