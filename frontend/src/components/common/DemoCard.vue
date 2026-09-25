<script setup lang="ts">
import { Connection } from '@element-plus/icons-vue'
import DemoBadge from '@/components/common/DemoBadge.vue'

defineProps({
  title: {
    type: String,
    default: '',
  },
  subtitle: {
    type: String,
    default: '',
  },
  bigValue: {
    type: [String, Number],
    default: '',
  },
  bigUnit: {
    type: String,
    default: '',
  },
  showBadge: {
    type: Boolean,
    default: true,
  },
  badgeText: {
    type: String,
    default: '演示数据',
  },
  /** 设备未连接态：隐藏默认 slot，显示占位，整卡可点 */
  disconnected: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['click'])

function handleClick() {
  emit('click')
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emit('click')
  }
}
</script>

<template>
  <div
    class="demo-card nd-card"
    :class="{ 'nd-card-interactive': disconnected }"
    :role="disconnected ? 'button' : undefined"
    :tabindex="disconnected ? 0 : undefined"
    :aria-label="disconnected ? `${title} 设备未连接，点击查看`.trim() : undefined"
    @click="disconnected && handleClick()"
    @keydown="disconnected && handleKeydown($event)"
  >
    <div class="demo-card__header">
      <div class="demo-card__heading">
        <h3 v-if="title" class="demo-card__title">{{ title }}</h3>
        <p v-if="subtitle" class="demo-card__subtitle">{{ subtitle }}</p>
      </div>
      <DemoBadge v-if="showBadge" :text="badgeText" />
    </div>

    <div
      v-if="bigValue !== '' && bigValue !== null && bigValue !== undefined"
      class="demo-card__big"
    >
      <span class="demo-card__big-value">{{ bigValue }}</span>
      <span v-if="bigUnit" class="demo-card__big-unit">{{ bigUnit }}</span>
    </div>

    <!--
      v-show 而非 v-if：断连/重连切换时默认插槽（含 echarts 容器）始终保留在 DOM，
      避免图表实例被销毁后游离、新容器未 init 导致的空白
    -->
    <div v-show="disconnected" class="demo-card__placeholder">
      <el-icon class="demo-card__placeholder-icon" aria-hidden="true">
        <Connection />
      </el-icon>
      <p class="demo-card__placeholder-title">设备未连接</p>
      <el-button text type="primary" class="demo-card__placeholder-btn" tabindex="-1">
        点击查看
      </el-button>
    </div>
    <div v-show="!disconnected" class="demo-card__slot">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="demo-card__footer">
      <slot name="footer" />
    </footer>
  </div>
</template>

<style scoped>
.demo-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.demo-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
}

.demo-card__heading {
  min-width: 0;
}

.demo-card__title {
  margin: 0;
  font-size: calc(var(--font-size-base) * 1.1);
  font-weight: 700;
  line-height: 1.4;
  color: var(--color-text);
}

.demo-card__subtitle {
  margin: var(--space-xs) 0 0;
  font-size: var(--font-size-sm);
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.demo-card__big {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
}

.demo-card__big-value {
  font-size: calc((var(--font-size-xl) + var(--font-size-xxl)) / 2);
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-text);
}

.demo-card__big-unit {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/*
 * 插槽包裹层不生成盒子：内部 metric/图表等仍是卡片 flex 直接子项，布局与改造前一致；
 * v-show 隐藏时内联 display:none 会覆盖该声明，整子树随之隐藏。
 */
.demo-card__slot {
  display: contents;
}

.demo-card__placeholder {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-lg) 0;
}

.demo-card__placeholder-icon {
  font-size: calc(var(--font-size-xl) * 2);
  color: var(--color-text-secondary);
}

.demo-card__placeholder-title {
  margin: 0;
  font-size: calc(var(--font-size-base) * 1.1);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.demo-card__placeholder-btn {
  min-height: var(--control-touch);
  font-size: var(--font-size-sm);
}

.demo-card__footer {
  margin-top: auto;
  padding-top: var(--space-sm);
}
</style>
