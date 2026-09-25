<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ensureDeviceData, getDeviceData } from '@/api'
import { useProfileStore } from '@/stores/profile'
import { useBpLogStore } from '@/stores/bpLog'
import { recentDates, todayStr } from '@/utils/date'
import BpCard from './health/BpCard.vue'
import BpEntryDialog from './health/BpEntryDialog.vue'
import ManualMetricDialog from './health/ManualMetricDialog.vue'
import MoodHrCard from './health/MoodHrCard.vue'
import StepsCard from './health/StepsCard.vue'
import SleepCard from './health/SleepCard.vue'
import WeightCard from './health/WeightCard.vue'
import type { DeviceData, DeviceDay, BpRecord, ManualMetric } from '@/types'

const route = useRoute()
const router = useRouter()
const profileStore = useProfileStore()
const bpLog = useBpLogStore()

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

const deviceData = ref<DeviceData>({ days: {} })
const manualRecords = ref<BpRecord[]>([])
const entryOpen = ref(false)

// 每次进入页面重新读取：保存餐次回来能看到血压的新值
async function refresh() {
  deviceData.value = await getDeviceData()
  // 加载近 7 天手动血压记录，合并进血压卡
  manualRecords.value = await bpLog.recordsOfLast7()
}

onMounted(async () => {
  await ensureDeviceData(profileStore.profile)
  await refresh()

  // 从首页催测卡等入口带 query 直达血压录入弹窗；处理后清掉 query，避免刷新重开
  if (route.query.recordBp === '1') {
    entryOpen.value = true
    void router.replace({ path: route.path, query: {} })
  }
})

const todayKey = todayStr()
const weekKeys = recentDates(7)
const monthKeys = recentDates(30)

const today = computed<DeviceDay>(() => deviceData.value.days[todayKey] || {})

const week = computed(() =>
  weekKeys.map((key) => ({ key, day: deviceData.value.days[key] })).filter((item) => item.day),
)

const weightSeries = computed(() =>
  monthKeys
    .map((key) => ({ t: key.slice(5).replace('-', '/'), v: deviceData.value.days[key]?.weight }))
    .filter((point): point is { t: string; v: number } => typeof point.v === 'number'),
)

// 心率：手动录入血压时填了心率，则以最新一条手动心率为准；否则用设备手环心率
const effectiveHr = computed(() => {
  const todayManual = manualRecords.value
    .filter((r) => r.date === todayKey && r.hr != null)
    .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0]
  if (todayManual?.hr != null) return todayManual.hr
  return today.value.hr ?? null
})

function handleSaved() {
  // 保存后刷新血压记录与设备数据，让趋势图更新
  void refresh()
}

// —— 心率/步数/睡眠/体重 手动录入（无手环/体脂秤也能自己记） ——
const manualOpen = ref(false)
const manualMetric = ref<ManualMetric>('steps')
const manualInitial = ref<number | null>(null)

function openManual(metric: ManualMetric, initial?: number | null) {
  manualMetric.value = metric
  manualInitial.value = initial ?? null
  manualOpen.value = true
}

// 弹窗内部已完成持久化，这里只需重读设备数据让卡片与体重趋势更新
async function handleManualSaved() {
  await refresh()
}
</script>

<template>
  <div class="page-container health-page">
    <header class="health-header">
      <h1 class="health-title">健康数据</h1>
      <p class="health-subtitle">
        {{ USE_MOCK ? '这些都是演示数据，帮您看看趋势' : '数据来自已连接的设备和您的手动记录' }}
      </p>
    </header>

    <div class="health-grid">
      <!-- 血压卡置顶放大（本页视觉主角） -->
      <BpCard
        class="health-grid__wide health-grid__bp"
        :week="week"
        :manual-records="manualRecords"
        @open-entry="entryOpen = true"
      />

      <div class="health-grid__row">
        <MoodHrCard
          :hr="effectiveHr"
          :manual="!!today.manual?.hr"
          @manual="openManual('hr', effectiveHr)"
        />
        <StepsCard
          :steps="today.steps"
          :manual="!!today.manual?.steps"
          @manual="openManual('steps', today.steps ?? null)"
        />
        <SleepCard
          :sleep="today.sleep"
          :manual="!!today.manual?.sleep"
          @manual="openManual('sleep', today.sleep?.total ?? null)"
        />
      </div>

      <WeightCard
        :series="weightSeries"
        :weight="today.weight"
        :manual="!!today.manual?.weight"
        @manual="openManual('weight', today.weight ?? null)"
      />
    </div>

    <BpEntryDialog v-model="entryOpen" @saved="handleSaved" />
    <ManualMetricDialog
      v-model="manualOpen"
      :metric="manualMetric"
      :initial="manualInitial"
      @saved="handleManualSaved"
    />
  </div>
</template>

<style scoped>
.health-header {
  margin-bottom: var(--space-lg);
}

.health-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.4;
  color: var(--color-text);
}

.health-subtitle {
  margin: var(--space-xs) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.health-grid {
  display: grid;
  /* 最小列宽 260px：320px 视口减去 12px*2 页边距后仍有 296px，不再横向溢出 */
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 24px;
}

/* 血压卡宽屏占两列并置顶放大 */
@media (min-width: 900px) {
  .health-grid__wide {
    grid-column: span 2;
  }
}

.health-grid__bp {
  order: -1;
}

/* 手环三卡并列在同一宽行内，窄屏自然堆叠 */
.health-grid__row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 24px;
}

@media (min-width: 900px) {
  .health-grid__row {
    grid-column: span 2;
  }
}

/* 约 900–1200px 中屏：显式两列。血压卡与三卡行占满两列，
   体重卡也占满整行，避免单独一行右侧留大空白 */
@media (min-width: 900px) and (max-width: 1199px) {
  .health-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .health-grid__wide,
  .health-grid__row {
    grid-column: 1 / -1;
  }

  .health-grid__row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .health-grid > :not(.health-grid__wide):not(.health-grid__row) {
    grid-column: 1 / -1;
  }
}

/* ≥1200px 宽屏（桌面侧栏布局）：血压大卡占左上 2×2，
   心率 / 步数 / 睡眠 / 体重四张小卡填满右侧 2×2，不再把体重卡挤到孤立一列 */
@media (min-width: 1200px) {
  .health-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .health-grid__wide {
    grid-column: span 2;
    grid-row: span 2;
  }

  /* 三卡行容器"隐身"：心率/步数/睡眠直接作为外层网格子项，
     按 DOM 顺序依次落位 右上、右中、右下上，体重卡补满最后一格 */
  .health-grid__row {
    display: contents;
  }
}

/* ≥1200px 且视口高度 ≥700px：整页锁定为一屏仪表盘
   （页面纵向滚动条从根上消除，小卡也不再被强行等高拉出底部留白）。
   更矮的窗口不锁高，退回自然滚动，避免内容被压坏。 */
@media (min-width: 1200px) and (min-height: 700px) {
  .health-page {
    display: flex;
    flex-direction: column;
    /* 抵掉 .page-container 上下各 16px 内边距，整页恰好一屏 */
    height: calc(100vh - 32px);
    overflow: hidden;
  }

  .health-header {
    flex: none;
    margin-bottom: var(--space-md);
  }

  .health-title {
    line-height: 1.3;
  }

  .health-grid {
    flex: 1 1 auto;
    min-height: 0;
    grid-template-rows: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  /* 网格项允许收缩到行高内（组件根节点同样吃本页 scoped 属性） */
  .health-grid__wide,
  .health-grid__row > *,
  .health-grid > :not(.health-grid__wide):not(.health-grid__row) {
    min-height: 0;
  }

  /* 卡片内部压紧一档：内边距 24→16、元素间距 12→8 */
  .health-grid :deep(.demo-card) {
    gap: var(--space-sm);
    padding: var(--space-lg);
  }

  /* 小卡副标题（"今日步数（手环或自己记）"等）在窄卡里频繁换成三行、
     白白吞掉图表高度：一屏模式下隐藏，标题本身已能自解释；血压大卡保留 */
  .health-grid :deep(.demo-card:not(.health-grid__wide) .demo-card__subtitle) {
    display: none;
  }

  /* 体重卡两项指标改两列紧凑排列（标签在上、数值在下），不再换行成两行高块 */
  .health-grid :deep(.metric-row) {
    flex-wrap: nowrap;
    gap: var(--space-sm);
  }

  .health-grid :deep(.metric-row .metric) {
    min-width: 0;
    flex-wrap: wrap;
  }

  .health-grid :deep(.metric-row .metric__label) {
    width: 100%;
  }

  .health-grid :deep(.metric-row .metric__value) {
    font-size: 1.5rem;
  }

  /* 血压/体重图由固定高度改为弹性填充，useEcharts 的 ResizeObserver 会自动重绘 */
  .health-grid :deep(.chart--bp),
  .health-grid :deep(.chart--weight) {
    flex: 1 1 auto;
    min-height: 0;
    height: auto;
  }

  /* 桌面宽下列内放得下，指标行不再把标签/单位折成多行 */
  .health-grid :deep(.metric) {
    flex-wrap: nowrap;
  }

  /* 步数圆环改为弹性尺寸：吃掉卡片剩余空间而不是把卡片撑出行高 */
  .health-grid :deep(.ring) {
    flex: 1 1 auto;
    min-height: 0;
  }

  .health-grid :deep(.ring__svg) {
    width: auto;
    height: 100%;
    max-width: 100%;
  }

  /* 睡眠卡一屏内只留深浅睡百分比，名词解释让位给高度 */
  .health-grid :deep(.legend__desc) {
    display: none;
  }
}
</style>
