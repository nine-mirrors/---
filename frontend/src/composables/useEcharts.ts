import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, ScatterChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

// 按需注册：本应用图表只有折线/柱状/散点（血压手动记录点）+ 直角坐标系 + 提示/图例 + 标线/标域 + Canvas 渲染。
// 全量引入 echarts 主包约 1MB（chunk 超 500KB），按需后约 1/3 体积，渲染行为不变。
echarts.use([
  CanvasRenderer,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  MarkAreaComponent,
  LineChart,
  BarChart,
  ScatterChart,
])

/** option 来源：getter 函数，或持有 option 的 ref/computed */
export type EchartsOptionSource = (() => unknown) | Ref<unknown>

/**
 * ECharts 生命周期管理组合式函数
 *
 * @param getOption 返回 echarts option 的 getter 函数，或一个持有 option 的 ref/computed。
 *   返回 null/undefined 时跳过本次 setOption。
 *
 * 用法：
 * const { el, getChart } = useEcharts(optionGetter)
 * <div ref="el" class="chart" />
 */
export function useEcharts(getOption: EchartsOptionSource) {
  const el = ref<HTMLElement | null>(null)

  let chart: ReturnType<typeof echarts.init> | null = null
  let observer: ResizeObserver | null = null
  let visibilityObserver: IntersectionObserver | null = null
  let resizeTimer: number | null = null

  function resolveOption(): unknown {
    if (typeof getOption === 'function') {
      return getOption()
    }
    if (getOption && typeof getOption === 'object' && 'value' in getOption) {
      return getOption.value
    }
    return null
  }

  function applyOption(): void {
    if (!chart || chart.isDisposed()) return
    const option = resolveOption()
    if (option == null) return
    // 第二个参数 true：不与旧 option 合并，避免系列残留
    chart.setOption(option as echarts.EChartsCoreOption, true)
  }

  function resize(): void {
    if (chart && !chart.isDisposed()) {
      chart.resize()
    }
  }

  // 100ms 节流，避免容器尺寸连续变化时频繁重绘
  function scheduleResize(): void {
    if (resizeTimer !== null) {
      window.clearTimeout(resizeTimer)
    }
    resizeTimer = window.setTimeout(() => {
      resizeTimer = null
      resize()
    }, 100)
  }

  function getChart(): ReturnType<typeof echarts.init> | null {
    return chart
  }

  onMounted(() => {
    // el 不存在时静默跳过，容错处理
    if (!el.value) return
    chart = echarts.init(el.value, null, { renderer: 'canvas' })
    applyOption()

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(scheduleResize)
      observer.observe(el.value)
    }
    // 兜底可见性观测：祖先 v-show（display:none↔block）切换时，
    // 个别内核下 ResizeObserver 对 0→实际尺寸变化不一定及时回调；
    // 容器重新进入视口时强制安排一次 resize，0 尺寸 init 的实例可据此恢复重绘
    if (typeof IntersectionObserver !== 'undefined') {
      visibilityObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting || entry.intersectionRatio > 0) {
            scheduleResize()
          }
        }
      })
      visibilityObserver.observe(el.value)
    }
    window.addEventListener('resize', scheduleResize)
  })

  // option 变化（含深层响应式数据变化）时重设图表
  watch(
    () => resolveOption(),
    () => {
      applyOption()
    },
    { deep: true },
  )

  onBeforeUnmount(() => {
    if (resizeTimer !== null) {
      window.clearTimeout(resizeTimer)
      resizeTimer = null
    }
    window.removeEventListener('resize', scheduleResize)
    if (observer) {
      observer.disconnect()
      observer = null
    }
    if (visibilityObserver) {
      visibilityObserver.disconnect()
      visibilityObserver = null
    }
    if (chart) {
      chart.dispose()
      chart = null
    }
  })

  return { el, resize, getChart }
}
