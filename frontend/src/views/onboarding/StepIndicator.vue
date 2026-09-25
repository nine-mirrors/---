<script setup lang="ts">
import { Check } from '@element-plus/icons-vue'

const props = defineProps<{
  steps: string[]
  current: number
}>()

const emit = defineEmits<{
  select: [index: number]
}>()

function handleClick(index: number) {
  // 只有已经走过的步骤可以点回去改
  if (index < props.current) emit('select', index)
}
</script>

<template>
  <ol class="step-indicator list-unstyled">
    <li
      v-for="(label, index) in steps"
      :key="label"
      class="step-indicator__item"
      :class="{
        'is-current': index === current,
        'is-done': index < current,
        'is-todo': index > current,
      }"
    >
      <span v-if="index > 0" class="step-indicator__line" aria-hidden="true" />
      <button
        type="button"
        class="step-indicator__node"
        :disabled="index >= current"
        :aria-current="index === current ? 'step' : undefined"
        @click="handleClick(index)"
      >
        <el-icon v-if="index < current" class="step-indicator__check" aria-hidden="true">
          <Check />
        </el-icon>
        <span v-else>{{ index + 1 }}</span>
      </button>
      <span class="step-indicator__label">{{ label }}</span>
    </li>
  </ol>
</template>

<style scoped>
.step-indicator {
  display: flex;
  align-items: flex-start;
  width: 100%;
}

.step-indicator__item {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.step-indicator__line {
  position: absolute;
  top: 19px;
  right: 50%;
  left: -50%;
  z-index: 0;
  height: 2px;
  background-color: var(--color-border);
}

.is-done .step-indicator__line {
  background-color: var(--color-primary);
}

.step-indicator__node {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  background-color: var(--color-bg-card);
  border: 2px solid var(--color-border);
  border-radius: 50%;
  cursor: default;
}

.is-done .step-indicator__node {
  color: var(--color-text-inverse);
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  cursor: pointer;
}

.is-current .step-indicator__node {
  color: var(--color-text-inverse);
  background-color: var(--color-primary-dark);
  border-color: var(--color-primary-dark);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary) 18%, transparent);
}

.step-indicator__check {
  font-size: 22px;
}

.step-indicator__label {
  font-size: 0.9rem;
  line-height: 1.3;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.is-current .step-indicator__label,
.is-done .step-indicator__label {
  font-weight: 600;
  color: var(--color-primary-dark);
}

@media (max-width: 560px) {
  .step-indicator__label {
    font-size: 0.78rem;
  }
}
</style>
