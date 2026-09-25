<script setup lang="ts">
import { computed } from 'vue'

// 心情类型：平静 / 焦虑 / 疲惫 / 烦躁（与 constants/dict.ts 的 MOODS 对应）
const props = withDefaults(
  defineProps<{
    mood: string
    size?: number
  }>(),
  { size: 28 },
)

// 未识别的心情回退为平静脸
const face = computed(() => {
  if (props.mood === '焦虑' || props.mood === '疲惫' || props.mood === '烦躁') {
    return props.mood
  }
  return '平静'
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <!-- 圆脸 -->
    <circle cx="12" cy="12" r="9" />

    <!-- 平静：放松微笑，弯月闭眼 -->
    <g v-if="face === '平静'">
      <path d="M7.6 11.3q1 1 2 0" />
      <path d="M14.4 11.3q1 1 2 0" />
      <path d="M8.4 14.8q3.6 2.7 7.2 0" />
    </g>

    <!-- 焦虑：眉头内端上扬，圆睁的小眼，下撇嘴 -->
    <g v-else-if="face === '焦虑'">
      <path d="M7 9.8 10 8.6" />
      <path d="M17 9.8 14 8.6" />
      <circle cx="8.7" cy="12" r="0.9" />
      <circle cx="15.3" cy="12" r="0.9" />
      <path d="M9.6 16.4q2.4-1.6 4.8 0" />
    </g>

    <!-- 疲惫：耷拉眉、半闭眼、张嘴打哈欠 -->
    <g v-else-if="face === '疲惫'">
      <path d="M7.2 9.2q1.4-.5 2.8.1" />
      <path d="M14 9.3q1.4-.6 2.8-.1" />
      <path d="M7.2 11.4h2.8" />
      <path d="M14 11.4h2.8" />
      <path d="M7.3 11.9q1.3 1 2.6 0" />
      <path d="M14.1 11.9q1.3 1 2.6 0" />
      <ellipse cx="12" cy="16" rx="1.9" ry="2.3" />
    </g>

    <!-- 烦躁：皱眉下压、眉间竖纹、不开心撇嘴 -->
    <g v-else>
      <path d="M7 8.8 10.2 9.9" />
      <path d="M17 8.8 13.8 9.9" />
      <path d="M12 7.6v1.2" />
      <circle cx="8.7" cy="12" r="0.9" />
      <circle cx="15.3" cy="12" r="0.9" />
      <path d="M8.8 16.6q3.2-2 6.4 0" />
    </g>
  </svg>
</template>
