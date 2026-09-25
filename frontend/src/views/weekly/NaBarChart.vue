<script setup lang="ts">
import { useEcharts } from '@/composables/useEcharts'
import { NA_DAY, NA_DAY_WARN_MG } from '@/constants/dict'
import { CHART_FONT } from '@/utils/chartFont'
import { recentDates } from '@/utils/date'
import type { WeeklyDay } from '@/utils/nutrition'

// 最近 7 天钠摄入柱状图（mg，按全天合计上色）：
// >2000mg 红、>1500mg 黄、否则绿；参考线仅保留 2000mg 全天目标

type WeekDays = (WeeklyDay | null)[]

const props = withDefaults(
  defineProps<{
    /** buildWeekly 的 days：最近 7 天（旧 → 新），无餐日为 null */
    days?: WeekDays
  }>(),
  { days: () => [] },
)

// 柱体允许使用状态色（canvas 吃不到 CSS 变量，hex 与 tokens 同值）
const COLOR_RED = '#d93025'
const COLOR_YELLOW = '#f59e0b'
const COLOR_GREEN = '#1e8e3e'
// 轴标签/文字统一中性色（= --color-text-secondary），参考线文字用深色危险 token
const AXIS_LABEL = '#6b675e'
const TEXT_DANGER = '#b3261e' // = --color-danger-text
const SPLIT_LINE = 'rgba(90, 80, 60, 0.1)'
const WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

// 与 buildWeekly 同口径补全 7 个日期槽，无餐日也能显示周几
const dates = recentDates(7)

function barColor(value: number): string {
  if (value > NA_DAY) return COLOR_RED
  if (value > NA_DAY_WARN_MG) return COLOR_YELLOW
  return COLOR_GREEN
}

function weekLabel(date: string): string {
  return WEEK_LABELS[new Date(`${date}T00:00:00`).getDay()]
}

function shortDate(date: string): string {
  const [, month, day] = date.split('-')
  return `${Number(month)}/${Number(day)}`
}

function buildOption(days: WeekDays) {
  return {
    grid: { left: 48, right: 20, top: 28, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#fffdf7',
      borderColor: '#e5ddcd',
      textStyle: { color: '#2b2a26' },
      formatter(params: unknown) {
        const index = (params as Array<{ dataIndex: number }>)[0].dataIndex
        const date = dates[index]
        const title = `${weekLabel(date)} ${shortDate(date)}`
        const day = days[index]
        if (!day) return `${title}<br/>无记录`
        return `${title}<br/>钠摄入：<b>${day.na} mg</b>`
      },
    },
    xAxis: {
      type: 'category',
      data: dates.map(weekLabel),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e5ddcd' } },
      axisLabel: { color: AXIS_LABEL, fontSize: CHART_FONT.axis },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: AXIS_LABEL, fontSize: CHART_FONT.axis },
      splitLine: { lineStyle: { color: SPLIT_LINE } },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 30,
        // 无餐日传 null：不画柱，仅保留日期槽位
        data: days.map((day) =>
          day
            ? {
                value: day.na,
                itemStyle: { color: barColor(day.na), borderRadius: [6, 6, 0, 0] },
              }
            : null,
        ),
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            {
              yAxis: NA_DAY,
              lineStyle: { type: 'dashed', color: COLOR_RED, width: 1.5 },
              label: {
                formatter: `全天目标 ${NA_DAY}mg 以内`,
                position: 'insideEndTop',
                color: TEXT_DANGER,
                fontSize: CHART_FONT.axis,
              },
            },
          ],
        },
      },
    ],
  }
}

const { el } = useEcharts(() => buildOption(props.days))
</script>

<template>
  <section class="chart-card nd-card">
    <header class="chart-card__head">
      <h3 class="chart-card__title">钠摄入</h3>
      <p class="chart-card__sub">最近 7 天每日合计（mg），全天目标 2000mg 以内</p>
    </header>
    <div ref="el" class="chart-card__canvas" />
  </section>
</template>

<style scoped>
.chart-card__head {
  margin-bottom: var(--space-md);
}

.chart-card__title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text);
}

.chart-card__sub {
  margin: var(--space-xs) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.chart-card__canvas {
  width: 100%;
  height: 260px;
}
</style>
