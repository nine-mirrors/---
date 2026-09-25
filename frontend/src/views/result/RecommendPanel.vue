<script setup lang="ts">
import { useRouter } from 'vue-router'
import RecipeCard from '@/components/common/RecipeCard.vue'
import type { Recipe } from '@/types'

withDefaults(
  defineProps<{
    /** evaluate().recipes：最多 3 道 */
    recipes?: Recipe[]
  }>(),
  { recipes: () => [] },
)

const router = useRouter()

function openRecipe(recipe: Recipe) {
  if (!recipe || !recipe.id) return
  router.push({ path: '/recipes', query: { id: recipe.id } })
}
</script>

<template>
  <section v-if="recipes.length" class="recommend-panel">
    <h2 class="result-section-title">给您搭配了 3 个更稳的选择</h2>
    <div class="recommend-list">
      <RecipeCard v-for="recipe in recipes" :key="recipe.id" :recipe="recipe" @click="openRecipe" />
    </div>
  </section>
</template>

<style scoped>
.recommend-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}
</style>
