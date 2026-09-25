<script setup lang="ts">
import { Star } from '@element-plus/icons-vue'
import RecognizedFoodList from './RecognizedFoodList.vue'
import type { Food, MealItem } from '@/types'

/** 与 Home.vue 的 HomeItem 结构兼容（RecognizedFoodList 需要的子集） */
interface FoodRow {
  _uid: string
  /** 食物库 id：调味品 preset 大按钮依赖该字段匹配 FOOD_MAP */
  id?: string
  kind?: string
  name?: string
  baseWeightG: number
  /** 当前实际克数（preset 档直通，不经 0.7/1/1.3） */
  weightG?: number
  portion: string
  manual: boolean
  confidence: number | null
}

const props = defineProps<{
  items: FoodRow[]
  recentFavorites: MealItem[]
}>()

const emit = defineEmits<{
  portion: [payload: { uid: string; portion: string; weightG?: number }]
  remove: [uid: string]
  add: [food: Food]
  addFavorite: [item: MealItem]
}>()

function handleAddFavorite(item: MealItem) {
  emit('addFavorite', item)
}
</script>

<template>
  <div class="manual-sheet">
    <!-- 最近常吃一键带入 -->
    <div v-if="props.recentFavorites.length" class="manual-sheet__fav">
      <p class="manual-sheet__fav-title">
        <el-icon aria-hidden="true"><Star /></el-icon>
        最近常吃，点一下就加上
      </p>
      <div class="manual-sheet__fav-list">
        <button
          v-for="fav in props.recentFavorites"
          :key="fav.id"
          type="button"
          class="manual-sheet__fav-chip"
          @click="handleAddFavorite(fav)"
        >
          {{ fav.name || fav.id }}
        </button>
      </div>
    </div>

    <!-- 空确认区 + 手动加菜（复用 RecognizedFoodList） -->
    <RecognizedFoodList
      :items="props.items"
      @portion="emit('portion', $event)"
      @remove="emit('remove', $event)"
      @add="emit('add', $event)"
    />
  </div>
</template>

<style scoped>
.manual-sheet {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.manual-sheet__fav {
  padding: var(--space-md);
  background-color: var(--color-bg-warm);
  border-radius: var(--radius-md);
}

.manual-sheet__fav-title {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin: 0 0 var(--space-sm);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.manual-sheet__fav-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.manual-sheet__fav-chip {
  min-height: 44px;
  padding: 0 var(--space-md);
  font-family: inherit;
  font-size: 0.95rem;
  color: var(--color-primary-dark);
  background-color: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.manual-sheet__fav-chip:hover {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border-color: var(--color-primary);
}
</style>
