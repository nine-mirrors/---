<script setup lang="ts">
// 血压卡（置顶放大，本页视觉主角）
// - 135/85 markLine + 诊室口径解释
// - 四级着色（classifyBp：normal/high/urgent/emergency/low）
// - 设备 + 手动合并序列（source/symbol/tooltip，时间 formatRelTime）
// - 当周 ≥180/120 → 急诊条（EmergencyPanel）
// - "记一下血压"大按钮（emit open 由父组件弹 BpEntryDialog）

import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Connection } from '@element-plus/icons-vue'
import DemoCard from '@/components/common/DemoCard.vue'
import { useEcharts } from '@/composables/useEcharts'
import { useDevicesStore } from '@/stores/devices'
import { useProfileStore } from '@/stores/profile'
import { triageBpLevel } from '@/stores/bpLog'
import { BP_THRESHOLDS } from '@/constants/dict'
import { classifyBp } from '@/utils/nutrition'
import { formatRelTime } from '@/utils/date'
import EmergencyPanel from './EmergencyPanel.vue'
import type { DeviceDay, BpRecord, BpLevel, BpReading } from '@/types'

/** 近 7 天条目（旧 → 新）：key 为 YYYY-MM-DD */
interface WeekEntry {
  key: string
  day: DeviceDay
}

const props = withDefaults(
  defineProps<{
    week?: WeekEntry[]
    manualRecords?: BpRecord[]
  }>(),
  { week: () => [], manualRecords: () => [] },
)

const emit = defineEmits<{
  openEntry: []
}>()

const router = useRouter()
const devices = useDevicesStore()
const profileStore = useProfileStore()
const connected = computed(() => devices.isConnected('bp'))

const HOME_SYS = BP_THRESHOLDS.home.sys
const HOME_DIA = BP_THRESHOLDS.home.dia
const EMERGENCY_SYS = BP_THRESHOLDS.emergency.sys
const EMERGENCY_DIA = BP_THRESHOLDS.emergency.dia

const subtitle = computed(() => {
  const status = profileStore.profile.htnStatus
  if (status === 'confirmed') return '高血压要坚持每天量、按时吃药'
  if (status === 'mild_risk' || status === 'high_risk') {
    return '建议每天早晚各量一次，连续看几天'
  }
  return '没高血压也建议每年量一量'
})

// 按 date+period 索引的手动记录（取最新一条）
const manualBySlot = computed(() => {
  const map = new Map<string, BpRecord>()
  for (const r of props.manualRecords) {
    const k = `${r.date}_${r.period}`
    const exist = map.get(k)
    if (!exist || r.measuredAt > exist.measuredAt) {
      map.set(k, r)
    }
  }
  return map
})

// 构建合并后的图数据点
interface SlotPoint {
  category: string
  relTime: string
  deviceSys: number | null
  deviceDia: number | null
  deviceMeasuredAt: string | null
  manualId: string | null
  manualSys: number | null
  manualDia: number | null
  manualMeasuredAt: string | null
  manualReadings: BpReading[] | null
}

function shortDate(key: string): string {
  return key.slice(5).replace('-', '/')
}

const slots = computed<SlotPoint[]>(() => {
  const result: SlotPoint[] = []
  for (const { key, day } of props.week) {
    for (const period of ['morning', 'evening'] as const) {
      const dev = period === 'morning' ? day.bpMorning : day.bpEvening
      const manual = manualBySlot.value.get(`${key}_${period}`) ?? null
      const deviceMeasuredAt = `${key}T${period === 'morning' ? '07:00:00' : '21:00:00'}`
      const measuredAt = manual ? manual.measuredAt : deviceMeasuredAt
      result.push({
        category: `${shortDate(key)}${period === 'morning' ? '早' : '晚'}`,
        relTime: formatRelTime(measuredAt, period),
        deviceSys: connected.value ? (dev?.[0] ?? null) : null,
        deviceDia: connected.value ? (dev?.[1] ?? null) : null,
        deviceMeasuredAt: connected.value && dev ? deviceMeasuredAt : null,
        manualId: manual ? manual.id : null,
        manualSys: manual ? manual.sys : null,
        manualDia: manual ? manual.dia : null,
        manualMeasuredAt: manual ? manual.measuredAt : null,
        manualReadings: manual ? manual.readings : null,
      })
    }
  }
  return result
})

// 今晨读数（手动优先）
const todayMorning = computed(() => {
  if (!slots.value.length) return { sys: null, dia: null }
  // 最后一天的早（slots 末尾前一个）
  const lastDayMorning = slots.value[slots.value.length - 2]
  if (!lastDayMorning) return { sys: null, dia: null }
  const sys = lastDayMorning.manualSys ?? lastDayMorning.deviceSys
  const dia = lastDayMorning.manualDia ?? lastDayMorning.deviceDia
  return { sys, dia }
})

const todaySys = computed(() => todayMorning.value.sys)
const todayDia = computed(() => todayMorning.value.dia)

// 无数据时不做分级（避免 classifyBp(0,0) 误上 low 配色）
const todayLevel = computed<BpLevel | null>(() => {
  if (todaySys.value == null || todayDia.value == null) return null
  return classifyBp(todaySys.value, todayDia.value)
})

// 最新一条记录（手动优先于设备）的分级，供急诊条判断是否已回落
const latestLevel = computed<BpLevel | null>(() => {
  for (let i = slots.value.length - 1; i >= 0; i -= 1) {
    const s = slots.value[i]
    const sys = s.manualSys ?? s.deviceSys
    const dia = s.manualDia ?? s.deviceDia
    if (sys != null && dia != null) return classifyBp(sys, dia)
  }
  return null
})

// 历史点统一中性灰；仅最新一点恢复品牌色强调，急症/紧急档用危险红
const POINT_COLOR_NORMAL = '#8f8a80'
const POINT_COLOR_EMPHASIS = '#0e7a5f'
const POINT_COLOR_DANGER = '#d93025'

// 最新一个有数据的槽位（手动/设备都算）
const latestDataIndex = computed(() => {
  for (let i = slots.value.length - 1; i >= 0; i -= 1) {
    const s = slots.value[i]
    if (s.manualSys != null || s.deviceSys != null) return i
  }
  return -1
})

// 某槽位的有效分级：手动优先（含任一原始读数分诊），否则设备
function slotLevel(s: SlotPoint): BpLevel | null {
  if (s.manualSys != null && s.manualDia != null) {
    return triageBpLevel(s.manualReadings ?? [], s.manualSys, s.manualDia)
  }
  if (s.deviceSys != null && s.deviceDia != null) {
    return classifyBp(s.deviceSys, s.deviceDia)
  }
  return null
}

function pointColor(index: number): string {
  if (index !== latestDataIndex.value) return POINT_COLOR_NORMAL
  const level = slotLevel(slots.value[index])
  return level === 'urgent' || level === 'emergency' ? POINT_COLOR_DANGER : POINT_COLOR_EMPHASIS
}

// 最新一条急症记录标识（同时承担“本周是否有急症”判断）：
// 手动记录必须检查 readings 里的任一原始读数，不能只看均值
// （185/115+170/108 的均值会被稀释到 180 以下）。
// 优先记录 id；无 id（如设备槽位）用 measuredAt+sys+dia 拼。
// 同一条已确认则跨天不重弹；出现更新的急症记录时标识变化，红条重新出现。
const latestEmergencyKey = computed<string | null>(() => {
  for (let i = slots.value.length - 1; i >= 0; i -= 1) {
    const s = slots.value[i]
    if (
      s.manualSys != null &&
      s.manualDia != null &&
      triageBpLevel(s.manualReadings ?? [], s.manualSys, s.manualDia) === 'emergency'
    ) {
      return s.manualId ?? `${s.manualMeasuredAt ?? ''}_${s.manualSys}_${s.manualDia}`
    }
    if (
      s.deviceSys != null &&
      s.deviceDia != null &&
      (s.deviceSys >= EMERGENCY_SYS || s.deviceDia >= EMERGENCY_DIA)
    ) {
      return `${s.deviceMeasuredAt ?? ''}_${s.deviceSys}_${s.deviceDia}`
    }
  }
  return null
})

function goDevices() {
  router.push('/devices')
}

function openEntry() {
  emit('openEntry')
}

const { el } = useEcharts(() => {
  if (!slots.value.length) return null
  const categories = slots.value.map((s) => s.category)

  // 设备线（带点）：历史点中性灰，最新一点加大并用品牌色/危险红强调
  const deviceSysData = slots.value.map((s, i) => ({
    value: s.deviceSys,
    symbolSize: i === latestDataIndex.value ? 10 : 7,
    itemStyle: { color: pointColor(i) },
  }))
  const deviceDiaData = slots.value.map((s, i) => ({
    value: s.deviceDia,
    symbolSize: i === latestDataIndex.value ? 8 : 6,
    itemStyle: { color: pointColor(i) },
  }))

  // 手动点（菱形，无连线）；最新槽位的手动点同样加大并按分级强调
  const manualSysData = slots.value.map((s, i) =>
    s.manualSys != null
      ? {
          value: [i, s.manualSys],
          symbolSize: i === latestDataIndex.value ? 13 : 12,
          itemStyle: { color: pointColor(i) },
        }
      : null,
  )
  const manualDiaData = slots.value.map((s, i) =>
    s.manualDia != null
      ? {
          value: [i, s.manualDia],
          symbolSize: i === latestDataIndex.value ? 11 : 10,
          itemStyle: { color: pointColor(i) },
        }
      : null,
  )

  return {
    grid: { left: 42, right: 16, top: 40, bottom: 36 },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 16,
      itemHeight: 8,
      textStyle: { color: '#6b675e', fontSize: 14 },
      data: ['收缩压', '舒张压', '手动收缩压', '手动舒张压'],
    },
    tooltip: {
      trigger: 'axis',
      // 米白定制 tooltip，与周报两张图口径一致
      backgroundColor: '#fffdf7',
      borderColor: '#e5ddcd',
      textStyle: { color: '#2b2a26' },
      formatter(params: unknown) {
        const list = params as Array<{
          axisValue: string
          dataIndex: number
          data:
            | number
            | { value: number | [number, number]; itemStyle?: { color?: string } }
            | [number, number]
            | null
          marker?: string
          seriesName?: string
          color?: string
        }>
        if (!list.length) return ''
        const idx = list[0].dataIndex ?? 0
        const slot = slots.value[idx]
        const lines: string[] = [slot.relTime]
        for (const p of list) {
          let val: number | null = null
          if (p.data == null) continue
          if (Array.isArray(p.data)) {
            val = p.data[1]
          } else if (typeof p.data === 'object') {
            const inner = p.data.value
            val = Array.isArray(inner) ? inner[1] : inner
          } else {
            val = p.data
          }
          if (val == null) continue
          const isManual = (p.seriesName || '').startsWith('手动')
          const tag = isManual ? '（手动）' : ''
          lines.push(`${p.marker}${p.seriesName}${tag} ${val} mmHg`)
        }
        return lines.join('<br/>')
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: categories,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e5ddcd' } },
      axisLabel: { color: '#6b675e', fontSize: 14, interval: 'auto' },
    },
    yAxis: {
      type: 'value',
      scale: true,
      min: (value: { min: number }) => Math.floor((value.min - 10) / 10) * 10,
      max: (value: { max: number }) => Math.ceil((value.max + 10) / 10) * 10,
      axisLabel: { color: '#6b675e', fontSize: 14 },
      splitLine: { lineStyle: { color: '#eee7d8' } },
    },
    series: [
      {
        name: '收缩压',
        type: 'line',
        data: deviceSysData,
        connectNulls: true,
        smooth: 0.2,
        showSymbol: true,
        symbolSize: 7,
        lineStyle: { width: 2.5, color: '#0e7a5f' },
        itemStyle: { color: '#0e7a5f' },
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            {
              yAxis: HOME_SYS,
              lineStyle: { color: '#d93025', type: 'dashed', width: 1.2 },
              label: {
                formatter: `${HOME_SYS} 家里警戒线`,
                color: '#d93025',
                fontSize: 14,
                position: 'insideEndTop',
              },
            },
            {
              yAxis: HOME_DIA,
              lineStyle: { color: '#d93025', type: 'dashed', width: 1.2 },
              label: {
                formatter: `舒张压参考${HOME_DIA}`,
                color: '#d93025',
                fontSize: 14,
                position: 'insideEndTop',
              },
            },
          ],
        },
      },
      {
        name: '舒张压',
        type: 'line',
        data: deviceDiaData,
        connectNulls: true,
        smooth: 0.2,
        showSymbol: true,
        symbolSize: 6,
        lineStyle: { width: 2, type: 'dashed', color: '#6fb5a1' },
        itemStyle: { color: '#6fb5a1' },
      },
      {
        name: '手动收缩压',
        type: 'scatter',
        data: manualSysData,
        symbol: 'diamond',
        symbolSize: 12,
        itemStyle: { color: POINT_COLOR_NORMAL },
        tooltip: { show: false },
      },
      {
        name: '手动舒张压',
        type: 'scatter',
        data: manualDiaData,
        symbol: 'diamond',
        symbolSize: 10,
        itemStyle: { color: POINT_COLOR_NORMAL },
        tooltip: { show: false },
      },
    ],
  }
})
</script>

<template>
  <DemoCard title="血压" :subtitle="subtitle">
    <!-- 急诊条（卡顶）：emergency-key 为最新急症记录标识，已确认过的同一条不重弹 -->
    <EmergencyPanel :emergency-key="latestEmergencyKey" :latest-level="latestLevel" />

    <!-- 断连提示：设备未连接时仅隐藏模拟曲线，手动记录与录入仍可用 -->
    <div
      v-if="!connected"
      class="disconnected-banner"
      role="button"
      tabindex="0"
      aria-label="血压计未连接，点击查看设备"
      @click="goDevices"
      @keydown.enter="goDevices"
      @keydown.space.prevent="goDevices"
    >
      <el-icon class="disconnected-banner__icon" aria-hidden="true"><Connection /></el-icon>
      <span>血压计未连接，点击查看</span>
    </div>

    <div class="metric">
      <span class="metric__label">今晨</span>
      <span class="metric__value">
        <span :class="todayLevel ? `is-${todayLevel}` : ''">{{ todaySys ?? '—' }}</span>
        <span class="metric__slash">/</span>
        <span :class="todayLevel ? `is-${todayLevel}` : ''">{{ todayDia ?? '—' }}</span>
      </span>
      <span class="metric__unit">mmHg</span>
    </div>

    <p class="clinic-note">在医院里量的标准是 140/90，家里量 135/85 以上就要留意。</p>

    <div ref="el" class="chart chart--bp" role="img" aria-label="近 7 天早晚血压趋势图" />

    <div class="action">
      <el-button type="primary" size="large" class="action__btn" @click="openEntry">
        记一下血压
      </el-button>
    </div>
  </DemoCard>
</template>

<style scoped>
.disconnected-banner {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-lg);
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  background-color: var(--color-bg-warm);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.disconnected-banner:hover,
.disconnected-banner:focus-visible {
  background-color: var(--el-color-primary-light-9);
  outline: 2px solid var(--el-color-primary-light-5);
  outline-offset: 1px;
}

.disconnected-banner__icon {
  font-size: 1.4rem;
  color: var(--color-text-secondary);
}

.metric {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  /* 窄屏单位换行时与数字行留出垂直间距，避免贴在一起 */
  row-gap: var(--space-xs);
  column-gap: var(--space-sm);
}

.metric__label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.metric__value {
  /* 320px 极窄屏两个三位数 + 斜杠会撑爆卡片：12vw 连续缩放（320→约38px、
     390→约47px），下限 2rem 仍保持适老大字；配合 .metric 的 wrap 让单位兜底换行 */
  font-size: clamp(2rem, 12vw, 2.6rem);
  font-weight: 700;
  line-height: 1.15;
  color: var(--color-text);
  white-space: nowrap;
}

.metric__value .is-normal {
  color: var(--color-success-text);
}

.metric__value .is-high {
  color: var(--color-warning-text);
}

.metric__value .is-urgent {
  color: var(--color-warning-text);
}

.metric__value .is-emergency {
  color: var(--color-danger);
}

.metric__value .is-low {
  color: var(--color-info-text);
}

.metric__slash {
  margin: 0 2px;
  font-weight: 700;
  color: var(--color-text-secondary);
}

.metric__unit {
  font-size: 1rem;
  color: var(--color-text-secondary);
}

.clinic-note {
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.chart {
  width: 100%;
}

.chart--bp {
  height: 260px;
}

.action {
  display: flex;
  justify-content: flex-start;
  margin-top: var(--space-sm);
}

.action__btn {
  min-height: 56px;
  padding: 0 var(--space-xl);
  font-size: calc(var(--font-size-base) * 1.1);
  font-weight: 600;
}
</style>
