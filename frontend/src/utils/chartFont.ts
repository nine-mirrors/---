/**
 * 图表文字适老缩放：ECharts 的 fontSize 只认物理 px，不跟随 html 根字号，
 * 系统/适老放大（本项目 1rem=20px）在图表上会失效。统一从这里换算。
 */
function rootFontSize(): number {
  if (typeof document === 'undefined') return 20
  const n = parseFloat(getComputedStyle(document.documentElement).fontSize)
  return Number.isFinite(n) && n > 0 ? n : 20
}

/** rem 数值 → 物理 px（供 ECharts option 使用），如 chartRem(0.72) ≈ 14.4 */
export function chartRem(rem: number): number {
  return Math.round(rootFontSize() * rem * 10) / 10
}

/** 常用字号档（读取时实时换算，页面初始化后字号不变） */
export const CHART_FONT = {
  /** 轴标签/刻度：0.72rem ≈ 14.4px */
  get axis(): number {
    return chartRem(0.72)
  },
  /** 辅助/图例小字：0.66rem ≈ 13px */
  get small(): number {
    return chartRem(0.66)
  },
  /** 图表标题/强调：0.82rem ≈ 16.4px */
  get title(): number {
    return chartRem(0.82)
  },
}
