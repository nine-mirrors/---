<script setup lang="ts">
defineProps({
  text: {
    type: String,
    default: '演示数据',
  },
})
</script>

<template>
  <span class="demo-badge" title="这是演示版，里面的数据都是模拟的，不能用来治病">{{ text }}</span>
</template>

<style scoped>
.demo-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--color-warning-text);
  background-color: var(--color-warning-bg);
  border: 1px solid color-mix(in srgb, var(--color-warning-strong) 35%, var(--color-bg-card));
  border-radius: 999px;
  white-space: nowrap;
}
</style>
