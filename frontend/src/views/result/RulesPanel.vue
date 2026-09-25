<script setup lang="ts">
import RuleCard from '@/components/common/RuleCard.vue'
import type { Rule } from '@/types'

withDefaults(
  defineProps<{
    /** evaluate().rules：含 red/yellow/green，green 为鼓励卡，也照常展示 */
    rules?: Rule[]
  }>(),
  { rules: () => [] },
)
</script>

<template>
  <section class="rules-panel">
    <h2 class="result-section-title">调整建议</h2>
    <div v-if="rules.length" class="rules-list">
      <RuleCard v-for="rule in rules" :key="rule.id" :rule="rule" />
    </div>
    <p v-else class="rules-empty">这餐没有需要特别调整的地方，继续保持。</p>
  </section>
</template>

<style scoped>
.rules-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.rules-empty {
  margin: 0;
  padding: var(--space-lg);
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  background-color: var(--color-bg-card);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
}
</style>
