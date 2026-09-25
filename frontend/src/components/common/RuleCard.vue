<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  /** { severity, title, text, id, evidence } */
  rule: {
    type: Object,
    required: true,
  },
})

const SEVERITY_COLORS: Record<string, string> = {
  danger: 'var(--color-danger)',
  high: 'var(--color-danger)',
  red: 'var(--color-danger)',
  warning: 'var(--color-warning)',
  medium: 'var(--color-warning)',
  yellow: 'var(--color-warning)',
  success: 'var(--color-success)',
  low: 'var(--color-success)',
  green: 'var(--color-success)',
}

const accentColor = computed(
  () => SEVERITY_COLORS[String(props.rule.severity || '').toLowerCase()] || 'var(--color-primary)',
)
</script>

<template>
  <article class="rule-card nd-card" :style="{ '--rule-accent': accentColor }">
    <h3 class="rule-card__title">{{ rule.title }}</h3>
    <p class="rule-card__text">{{ rule.text }}</p>
    <!-- 技术规则编号 rule.id（如 HTN_Sodium_High）不对老人展示，卡片只显中文标题与描述 -->
    <div v-if="rule.evidence" class="rule-card__footer">
      <span class="rule-card__evidence">依据：{{ rule.evidence }}</span>
    </div>
  </article>
</template>

<style scoped>
.rule-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding-left: calc(var(--space-lg) + var(--space-xs));
}

/* 左侧严重程度色条 */
.rule-card::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: var(--space-xs);
  background-color: var(--rule-accent);
  border-radius: var(--radius-lg) 0 0 var(--radius-lg);
  content: '';
}

.rule-card__title {
  margin: 0;
  font-size: calc(var(--font-size-base) * 1.1);
  font-weight: 700;
  line-height: 1.4;
  color: var(--color-text);
}

.rule-card__text {
  margin: 0;
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  color: var(--color-text);
}

.rule-card__footer {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  margin-top: auto;
  padding-top: var(--space-sm);
}

.rule-card__evidence {
  font-size: var(--font-size-sm);
  line-height: 1.5;
  color: var(--color-text-secondary);
}
</style>
