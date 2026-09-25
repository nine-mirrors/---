<script setup lang="ts">
import { computed } from 'vue'
import type { Recipe } from '@/types'

const props = withDefaults(
  defineProps<{
    recipe: Recipe
    /** 控钾用户：高钾标签不作推荐高亮（灰显） */
    renalKRestriction?: boolean
  }>(),
  { renalKRestriction: false },
)

const emit = defineEmits<{
  click: [recipe: Recipe]
}>()

const tags = computed(() => {
  const list = props.recipe.tags
  return Array.isArray(list)
    ? list.filter((tag) => tag !== null && tag !== undefined && tag !== '')
    : []
})

// 每份营养摘要：热量/蛋白/钠（R2.3：移除 GL）
const nutrientsLine = computed(() => {
  const n = props.recipe.nutrients || {}
  const parts: string[] = []
  if (n.energyKCal !== undefined && n.energyKCal !== null) {
    parts.push(`约 ${Math.round(n.energyKCal)} 千卡`)
  }
  if (n.protein !== undefined && n.protein !== null) {
    parts.push(`蛋白 ${Math.round(n.protein)}g`)
  }
  if (n.Na !== undefined && n.Na !== null) {
    parts.push(`钠 ${Math.round(n.Na)}mg`)
  }
  if (n.K !== undefined && n.K !== null) {
    parts.push(`钾 ${Math.round(n.K)}mg`)
  }
  return parts.join(' · ')
})

// 菜品图加载失败：直接隐藏 img，卡片只留文字信息（适老兜底，不出现碎图）
function handleImageError(event: Event) {
  const target = event.target as HTMLImageElement | null
  if (target) target.style.display = 'none'
}

function handleClick() {
  emit('click', props.recipe)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emit('click', props.recipe)
  }
}
</script>

<template>
  <div
    class="recipe-card nd-card nd-card-interactive"
    role="button"
    tabindex="0"
    :aria-label="`查看${recipe.name}的做法`"
    @click="handleClick"
    @keydown="handleKeydown"
  >
    <img
      v-if="recipe.image"
      :src="recipe.image"
      :alt="`${recipe.name}成品示意图`"
      class="recipe-card__image"
      loading="lazy"
      draggable="false"
      @error="handleImageError"
    />
    <h3 class="recipe-card__name">{{ recipe.name }}</h3>

    <ul v-if="tags.length" class="recipe-card__tags list-unstyled">
      <li
        v-for="tag in tags"
        :key="tag"
        class="recipe-card__tag"
        :class="{ 'recipe-card__tag--dim': renalKRestriction && tag === '高钾' }"
      >
        {{ tag }}
      </li>
    </ul>

    <p v-if="nutrientsLine" class="recipe-card__nutrients">{{ nutrientsLine }}</p>

    <p class="recipe-card__action" aria-hidden="true">查看做法 &gt;</p>
  </div>
</template>

<style scoped>
.recipe-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.recipe-card:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* 方形成品图：负边距顶住卡片内边距，上方两角跟随卡片圆角；加载失败时 JS 隐藏 */
.recipe-card__image {
  display: block;
  width: calc(100% + 2 * var(--space-lg));
  margin: calc(-1 * var(--space-lg)) calc(-1 * var(--space-lg)) 0;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  background-color: var(--color-bg-warm);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.recipe-card__name {
  margin: 0;
  font-size: calc(var(--font-size-base) * 1.15);
  font-weight: 700;
  line-height: 1.4;
  color: var(--color-text);
}

.recipe-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.recipe-card__tag {
  padding: 2px var(--space-md);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  color: var(--color-primary);
  background-color: color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-card));
  border: 1px solid color-mix(in srgb, var(--color-primary) 30%, var(--color-bg-card));
  border-radius: var(--radius-lg);
  white-space: nowrap;
}

/* 控钾用户：高钾标签不作推荐卖点高亮（灰显） */
.recipe-card__tag--dim {
  color: var(--color-text-secondary);
  background-color: var(--color-bg-warm);
  border-color: var(--color-border);
}

.recipe-card__nutrients {
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.recipe-card__action {
  margin: auto 0 0;
  padding-top: var(--space-sm);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-primary);
}
</style>
