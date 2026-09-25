<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import {
  Aim,
  Bell,
  Bowl,
  Camera,
  Cellphone,
  Check,
  Flag,
  Food,
  Location,
  Microphone,
  Monitor,
  Picture,
  Search,
  Star,
  Timer,
  Upload,
} from '@element-plus/icons-vue'

// 图标白名单：未命中时不渲染图标
const ICON_MAP: Record<string, Component> = {
  Aim,
  Bell,
  Bowl,
  Camera,
  Cellphone,
  Flag,
  Food,
  Location,
  Microphone,
  Monitor,
  Picture,
  Search,
  Star,
  Timer,
  Upload,
}

const props = defineProps({
  /** 选中态（v-model） */
  modelValue: {
    type: Boolean,
    default: false,
  },
  label: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  /** Element 图标组件名（需在白名单内） */
  icon: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  /** 红旗问题使用 danger 描边 */
  type: {
    type: String,
    default: 'default',
  },
})

const emit = defineEmits(['update:modelValue', 'click'])

const isDanger = computed(() => props.type === 'danger')

const accentColor = computed(() =>
  isDanger.value ? 'var(--color-danger)' : 'var(--color-primary)',
)

const iconComponent = computed(() => ICON_MAP[props.icon] || null)

const classes = computed(() => ({
  'big-option-button--selected': props.modelValue,
  'big-option-button--danger': isDanger.value,
  'big-option-button--disabled': props.disabled,
}))

function handleClick() {
  if (props.disabled) return
  emit('update:modelValue', true)
  emit('click')
}
</script>

<template>
  <button
    type="button"
    class="big-option-button nd-card"
    :class="classes"
    :style="{ '--bo-accent': accentColor }"
    :disabled="disabled"
    :aria-pressed="modelValue"
    @click="handleClick"
  >
    <el-icon v-if="iconComponent" class="big-option-button__icon" aria-hidden="true">
      <component :is="iconComponent" />
    </el-icon>
    <span class="big-option-button__text">
      <span class="big-option-button__label">{{ label }}</span>
      <span v-if="description" class="big-option-button__description">{{ description }}</span>
    </span>
    <el-icon v-if="modelValue" class="big-option-button__check" aria-hidden="true">
      <Check />
    </el-icon>
  </button>
</template>

<style scoped>
.big-option-button {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: var(--control-height);
  padding: var(--space-md) var(--space-lg);
  font-family: inherit;
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

.big-option-button:hover:not(:disabled) {
  border-color: var(--bo-accent);
  box-shadow: var(--shadow-sm);
}

.big-option-button:focus-visible {
  outline: 2px solid var(--bo-accent);
  outline-offset: 2px;
}

.big-option-button--danger {
  border-color: var(--color-danger);
}

.big-option-button--selected {
  background-color: color-mix(in srgb, var(--bo-accent) 10%, var(--color-bg-card));
  border-color: var(--bo-accent);
}

.big-option-button--disabled {
  color: var(--color-text-secondary);
  cursor: not-allowed;
  opacity: 0.6;
}

.big-option-button__icon {
  flex-shrink: 0;
  margin-right: var(--space-md);
  font-size: var(--font-size-xl);
  color: var(--bo-accent);
}

.big-option-button__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-xs);
  min-width: 0;
}

.big-option-button__label {
  font-weight: 600;
}

.big-option-button__description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.big-option-button__check {
  flex-shrink: 0;
  align-self: flex-start;
  margin-left: var(--space-sm);
  font-size: var(--font-size-lg);
  color: var(--bo-accent);
}
</style>
