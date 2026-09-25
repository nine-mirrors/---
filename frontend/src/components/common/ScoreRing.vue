<script setup lang="ts">
import { computed } from 'vue'
import { CircleCheck, CircleClose, Warning } from '@element-plus/icons-vue'

const props = defineProps({
  /** 健康评分 0–100 */
  score: {
    type: Number,
    default: 0,
  },
  /** 圆环整体尺寸（px） */
  size: {
    type: Number,
    default: 160,
  },
})

const clampedScore = computed(() => {
  if (Number.isNaN(props.score)) return 0
  return Math.min(100, Math.max(0, Math.round(props.score)))
})

// 颜色不作为唯一通道：评级文字与图标始终同时呈现
// color：圆环装饰描边，保留语义原色；textColor：中央评级文字/图标，米底上需达文字对比度
const status = computed(() => {
  if (clampedScore.value >= 80) {
    return {
      color: 'var(--color-success)',
      textColor: 'var(--color-success-text)',
      label: '很棒',
      icon: CircleCheck,
    }
  }
  if (clampedScore.value >= 60) {
    return {
      color: 'var(--color-warning)',
      textColor: 'var(--color-warning-text)',
      label: '还可以',
      icon: Warning,
    }
  }
  return {
    color: 'var(--color-danger)',
    textColor: 'var(--color-danger)',
    label: '要注意',
    icon: CircleClose,
  }
})

const strokeWidth = computed(() => Math.max(8, Math.round(props.size * 0.075)))
const center = computed(() => props.size / 2)
const radius = computed(() => (props.size - strokeWidth.value) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const dashOffset = computed(() => circumference.value * (1 - clampedScore.value / 100))
</script>

<template>
  <div
    class="score-ring"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="img"
    :aria-label="`健康评分 ${clampedScore} 分，${status.label}`"
  >
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" aria-hidden="true">
      <circle
        class="score-ring__track"
        :cx="center"
        :cy="center"
        :r="radius"
        :stroke-width="strokeWidth"
        fill="none"
      />
      <circle
        class="score-ring__value"
        :cx="center"
        :cy="center"
        :r="radius"
        :stroke-width="strokeWidth"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
        :style="{ stroke: status.color }"
        fill="none"
        stroke-linecap="round"
        :transform="`rotate(-90 ${center} ${center})`"
      />
    </svg>
    <div class="score-ring__center">
      <span class="score-ring__score">{{ clampedScore }}</span>
      <span class="score-ring__label" :style="{ color: status.textColor }">
        <el-icon class="score-ring__label-icon">
          <component :is="status.icon" />
        </el-icon>
        <span>{{ status.label }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.score-ring {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.score-ring__track {
  stroke: var(--color-border);
}

.score-ring__value {
  transition: stroke-dashoffset 0.8s ease;
}

.score-ring__center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
}

.score-ring__score {
  font-size: var(--font-size-xl);
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-text);
}

.score-ring__label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-size-sm);
  font-weight: 600;
  line-height: 1.2;
}

.score-ring__label-icon {
  font-size: var(--font-size-base);
}
</style>
