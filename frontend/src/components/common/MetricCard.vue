<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import {
  Aim,
  Apple,
  Bell,
  Bowl,
  CircleCheck,
  CircleClose,
  CoffeeCup,
  DataLine,
  Dish,
  FirstAidKit,
  Flag,
  Food,
  Histogram,
  InfoFilled,
  KnifeFork,
  Lightning,
  Location,
  Moon,
  Odometer,
  ScaleToOriginal,
  Star,
  Sugar,
  Sunny,
  Timer,
  TrendCharts,
  Warning,
} from '@element-plus/icons-vue'

// 图标白名单：未命中时回退默认图标，避免任意字符串解析失败
const ICON_MAP: Record<string, Component> = {
  DataLine,
  Timer,
  Histogram,
  Odometer,
  TrendCharts,
  Aim,
  Star,
  Bell,
  Flag,
  Moon,
  Sunny,
  Lightning,
  InfoFilled,
  Food,
  Bowl,
  Apple,
  CoffeeCup,
  Sugar,
  ScaleToOriginal,
  FirstAidKit,
  KnifeFork,
  Dish,
  Location,
  CircleCheck,
  Warning,
  CircleClose,
}

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  value: {
    type: [String, Number],
    required: true,
  },
  unit: {
    type: String,
    default: '',
  },
  /** green / yellow / red / neutral */
  status: {
    type: String,
    default: 'neutral',
  },
  /** Element 图标组件名（需在白名单内），默认 DataLine */
  icon: {
    type: String,
    default: 'DataLine',
  },
  /** 中文结论句 */
  hint: {
    type: String,
    default: '',
  },
})

// 装饰用（左侧色条、小圆点）：保留语义原色
const STATUS_COLORS: Record<string, string> = {
  green: 'var(--color-success)',
  yellow: 'var(--color-warning)',
  red: 'var(--color-danger)',
  neutral: 'var(--color-primary)',
}

// 图标 fill 当语义文字用：米纸底上需满足文字对比度
const STATUS_ICON_COLORS: Record<string, string> = {
  green: 'var(--color-success-text)',
  yellow: 'var(--color-warning-text)',
  red: 'var(--color-danger)',
  neutral: 'var(--color-primary)',
}

const accentColor = computed(() => STATUS_COLORS[props.status] || STATUS_COLORS.neutral)
const iconColor = computed(() => STATUS_ICON_COLORS[props.status] || STATUS_ICON_COLORS.neutral)

const iconComponent = computed(() => ICON_MAP[props.icon] || DataLine)
</script>

<template>
  <article
    class="metric-card nd-card"
    :style="{ '--metric-accent': accentColor, '--metric-icon': iconColor }"
  >
    <div class="metric-card__header">
      <el-icon class="metric-card__icon">
        <component :is="iconComponent" />
      </el-icon>
      <h3 class="metric-card__title">{{ title }}</h3>
      <span class="metric-card__dot" aria-hidden="true" />
    </div>
    <div class="metric-card__body">
      <span class="metric-card__value">{{ value }}</span>
      <span v-if="unit" class="metric-card__unit">{{ unit }}</span>
    </div>
    <p v-if="hint" class="metric-card__hint">{{ hint }}</p>
  </article>
</template>

<style scoped>
.metric-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-height: 140px;
  padding-left: calc(var(--space-lg) + var(--space-xs));
  transition: box-shadow 0.2s ease;
}

.metric-card:hover {
  box-shadow: var(--shadow-base);
}

/* 左侧 4px 状态色条 */
.metric-card::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: var(--space-xs);
  background-color: var(--metric-accent);
  border-radius: var(--radius-lg) 0 0 var(--radius-lg);
  content: '';
}

.metric-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.metric-card__icon {
  flex-shrink: 0;
  font-size: var(--font-size-lg);
  color: var(--metric-icon);
}

.metric-card__title {
  flex: 1;
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.metric-card__dot {
  flex-shrink: 0;
  width: var(--space-sm);
  height: var(--space-sm);
  background-color: var(--metric-accent);
  border-radius: 50%;
}

.metric-card__body {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
}

.metric-card__value {
  font-size: var(--font-size-xxl);
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-text);
}

.metric-card__unit {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.metric-card__hint {
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-base);
  color: var(--color-text-secondary);
}
</style>
