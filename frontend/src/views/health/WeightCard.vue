<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { EditPen } from '@element-plus/icons-vue'
import DemoCard from '@/components/common/DemoCard.vue'
import { useEcharts } from '@/composables/useEcharts'
import { useDevicesStore } from '@/stores/devices'
import { useProfileStore } from '@/stores/profile'
import { CHART_FONT } from '@/utils/chartFont'

interface WeightPoint {
  t: string
  v: number
}

const props = withDefaults(
  defineProps<{
    // 近 30 天体重序列（旧 → 新）：{ t: 'M/D', v: number }
    series?: WeightPoint[]
    // 今日体重（day.weight）
    weight?: number | null
    // 体重为手动录入：角标改“手动记录”
    manual?: boolean
  }>(),
  { series: () => [], weight: null, manual: false },
)

const emit = defineEmits<{
  // 点击“自己记一下”，Health.vue 统一打开录入弹窗
  manual: []
}>()

const router = useRouter()
const devices = useDevicesStore()
const profileStore = useProfileStore()
const connected = computed(() => devices.isConnected('scale'))

// 画像里没有体重时，引导去“我的”补全身高体重
const hasWeight = computed(() => Number(profileStore.profile.weightKg) > 0)
const bmi = computed(() => profileStore.bmi)
const currentWeight = computed(() => (Number(props.weight) > 0 ? Number(props.weight) : null))

function goDevices() {
  router.push('/devices')
}

function goProfile() {
  router.push('/profile')
}

const { el } = useEcharts(() => {
  if (!props.series.length) return null
  return {
    grid: { left: 42, right: 16, top: 18, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      formatter(params: unknown) {
        const p = (params as Array<{ axisValue: string; data: number }>)[0]
        return `${p.axisValue}<br/>体重 ${p.data} kg`
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: props.series.map((p) => p.t),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e5ddcd' } },
      // 图表字号走 CHART_FONT：ECharts 只认物理 px，由工具按根字号换算，适老放大不失效
      axisLabel: { color: '#6b675e', fontSize: CHART_FONT.axis, interval: 4 },
    },
    yAxis: {
      type: 'value',
      scale: true,
      min: (value: { min: number }) => Math.floor(value.min - 0.5),
      max: (value: { max: number }) => Math.ceil(value.max + 0.5),
      axisLabel: { color: '#6b675e', fontSize: CHART_FONT.axis },
      splitLine: { lineStyle: { color: '#eee7d8' } },
    },
    series: [
      {
        name: '体重',
        type: 'line',
        data: props.series.map((p) => p.v),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2.5, color: '#0e7a5f' },
        itemStyle: { color: '#0e7a5f' },
        areaStyle: { color: 'rgba(14,122,95,0.08)' },
      },
    ],
  }
})
</script>

<template>
  <DemoCard
    title="体重"
    subtitle="近期体重变化（体脂秤或自己记）"
    :badge-text="manual ? '手动记录' : '演示数据'"
    :disconnected="!connected"
    @click="goDevices"
  >
    <template #footer>
      <el-button text type="primary" class="manual-btn" @click.stop="emit('manual')">
        <el-icon class="manual-btn__icon" aria-hidden="true"><EditPen /></el-icon>
        自己记一下
      </el-button>
    </template>
    <template v-if="hasWeight">
      <div class="metric-row">
        <div class="metric">
          <span class="metric__label">当前体重</span>
          <span class="metric__value">{{ currentWeight ?? '—' }}</span>
          <span class="metric__unit">kg</span>
        </div>
        <div class="metric">
          <span class="metric__label">体重指数</span>
          <span class="metric__value">{{ bmi ?? '—' }}</span>
        </div>
      </div>
      <p class="chart-note">近 30 天</p>
      <div ref="el" class="chart chart--weight" />
    </template>
    <div v-else class="empty">
      <p class="empty__text">还没有身高体重记录，没法画出趋势</p>
      <el-button text type="primary" class="empty__btn" @click="goProfile">
        去“我的”填一下身高体重
      </el-button>
    </div>
  </DemoCard>
</template>

<style scoped>
.manual-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  min-height: var(--control-touch);
  padding: 0 var(--space-xs);
  font-size: var(--font-size-base);
}

.manual-btn__icon {
  font-size: 1.1rem;
}

.metric-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-lg);
}

.metric {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
}

.metric__label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.metric__value {
  font-size: 1.9rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-text);
}

.metric__unit {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.chart-note {
  margin: 0;
  /* 全仓最小正文 15px：0.8125rem≈16.25px（原 0.75rem=15px 物理注释字号） */
  font-size: var(--font-size-xs);
  text-align: right;
  color: var(--color-text-secondary);
}

.chart {
  width: 100%;
}

.chart--weight {
  height: 220px;
}

/* 桌面一屏仪表盘（见 Health.vue）：footer 不再独占剩余空间，
   把高度让给弹性图表（否则 margin-top:auto 会把图表压成 0 高） */
@media (min-width: 1200px) and (min-height: 700px) {
  :deep(.demo-card__footer) {
    margin-top: 0;
    padding-top: 0;
  }
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-md) 0;
}

.empty__text {
  margin: 0;
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}

.empty__btn {
  min-height: var(--control-touch);
  padding: 0;
  font-size: var(--font-size-base);
}
</style>
