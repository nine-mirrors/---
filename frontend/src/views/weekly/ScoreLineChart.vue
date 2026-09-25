<script setup lang="ts">
import { useEcharts } from '@/composables/useEcharts'
import { SCORE_YELLOW, SCORE_GREEN } from '@/constants/dict'
import { CHART_FONT } from '@/utils/chartFont'
import { recentDates } from '@/utils/date'
import type { WeeklyDay } from '@/utils/nutrition'

// 最近 7 天每日评分折线：0–100，60 / 80 两条浅色参考线

type WeekDays = (WeeklyDay | null)[]

const props = withDefaults(
  defineProps<{
    /** buildWeekly 的 days：最近 7 天（旧 → 新），无餐日为 null */
    days?: WeekDays
  }>(),
  { days: () => [] },
)

// 折线品牌绿：装饰性品牌色（非状态语义），保留
const PRIMARY = '#0e7a5f'
const AXIS_LABEL = '#6b675e' // = --color-text-secondary，轴标签统一中性色
const SPLIT_LINE = 'rgba(90, 80, 60, 0.1)'
// 参考线文字（canvas 吃不到 CSS 变量）：与 tokens 同值——
// #a16207 = --color-warning-strong、#176c2f = --color-success-text
const TEXT_WARNING_STRONG = '#a16207'
const TEXT_SUCCESS = '#176c2f'
const WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

// 与 buildWeekly 同口径补全 7 个日期槽，无餐日也能显示周几
const dates = recentDates(7)

function weekLabel(date: string): string {
  return WEEK_LABELS[new Date(`${date}T00:00:00`).getDay()]
}

function shortDate(date: string): string {
  const [, month, day] = date.split('-')
  return `${Number(month)}/${Number(day)}`
}

function buildOption(days: WeekDays) {
  return {
    grid: { left: 40, right: 20, top: 28, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fffdf7',
      borderColor: '#e5ddcd',
      textStyle: { color: '#2b2a26' },
      formatter(params: unknown) {
        const index = (params as Array<{ dataIndex: number }>)[0].dataIndex
        const date = dates[index]
        const title = `${weekLabel(date)} ${shortDate(date)}`
        const day = days[index]
        if (!day) return `${title}<br/>无记录`
        return `${title}<br/>当日评分：<b>${Math.round(day.score)}</b> 分`
      },
    },
    xAxis: {
      type: 'category',
      data: dates.map(weekLabel),
      boundaryGap: false,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e5ddcd' } },
      axisLabel: { color: AXIS_LABEL, fontSize: CHART_FONT.axis },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { color: AXIS_LABEL, fontSize: CHART_FONT.axis },
      splitLine: { lineStyle: { color: SPLIT_LINE } },
    },
    series: [
      {
        type: 'line',
        name: '当日评分',
        symbol: 'circle',
        symbolSize: 9,
        connectNulls: false,
        lineStyle: { width: 3, color: PRIMARY },
        itemStyle: { color: PRIMARY, borderColor: '#fffdf7', borderWidth: 2 },
        // 无餐日传 null：断线留白，不补点
        data: days.map((day) => (day ? Math.round(day.score) : null)),
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            {
              yAxis: SCORE_YELLOW,
              lineStyle: { type: 'dashed', color: 'rgba(245, 158, 11, 0.5)' },
              label: {
                formatter: String(SCORE_YELLOW),
                position: 'insideStartTop',
                color: TEXT_WARNING_STRONG,
                fontSize: CHART_FONT.axis,
              },
            },
            {
              yAxis: SCORE_GREEN,
              lineStyle: { type: 'dashed', color: 'rgba(30, 142, 62, 0.5)' },
              label: {
                formatter: String(SCORE_GREEN),
                position: 'insideEndTop',
                color: TEXT_SUCCESS,
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
      <h3 class="chart-card__title">每日评分</h3>
      <p class="chart-card__sub">最近 7 天吃饭打分，60 分及格、80 分优秀</p>
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
