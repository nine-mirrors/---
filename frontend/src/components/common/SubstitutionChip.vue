<script setup lang="ts">
import { Right } from '@element-plus/icons-vue'

defineProps({
  /** 原食材（不建议吃的） */
  from: {
    type: String,
    required: true,
  },
  /** 推荐替代食材 */
  to: {
    type: String,
    required: true,
  },
  /** 一句口语化解释 */
  tip: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <div class="sub-chip">
    <div class="sub-chip__row">
      <span class="sub-chip__from">{{ from }}</span>
      <el-icon class="sub-chip__arrow" aria-hidden="true">
        <Right />
      </el-icon>
      <span class="sub-chip__to">{{ to }}</span>
    </div>
    <p v-if="tip" class="sub-chip__tip">{{ tip }}</p>
  </div>
</template>

<style scoped>
.sub-chip {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-md) var(--space-lg);
  background-color: var(--color-bg-warm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.sub-chip__row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.sub-chip__from {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  text-decoration: line-through;
}

.sub-chip__arrow {
  flex-shrink: 0;
  font-size: var(--font-size-lg);
  color: var(--color-primary);
}

.sub-chip__to {
  font-size: var(--font-size-base);
  font-weight: 700;
  color: var(--color-primary);
}

.sub-chip__tip {
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: 1.5;
  color: var(--color-text-secondary);
}
</style>
