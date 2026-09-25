<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loading } from '@element-plus/icons-vue'
import { getRecipes } from '@/api'
import { RECIPE_TAGS } from '@/constants/dict'
import { useProfileStore } from '@/stores/profile'
import RecipeCard from '@/components/common/RecipeCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import RecipeDrawer from './recipes/RecipeDrawer.vue'
import type { Recipe } from '@/types'

const route = useRoute()
const router = useRouter()
const profileStore = useProfileStore()

const ALL_TAG = RECIPE_TAGS[0]

const list = ref<Recipe[]>([])
const activeTag = ref(ALL_TAG)
const loading = ref(false)
const tagLoading = ref(false)
const drawerVisible = ref(false)
const currentRecipe = ref<Recipe | null>(null)

/**
 * 肾功能三态（true 医生限钾 / false 明确正常 / null 未知）在食谱页的收敛：
 * - 仅 true 时灰显"高钾"标签并向 RecipeCard/RecipeDrawer 传 true（控钾提醒）；
 * - null 与 false 一样正常展示高钾食谱、标签不灰（pickRecipes 对 null 也不推"高钾"need）；
 * - 子组件（RecipeCard/RecipeDrawer）的 prop 只接受 boolean，null 时无法下发
 *   "肾功能不清楚，先问医生"的中性抽屉提示，待子组件支持三态后在本处补传 null。
 */
const renalRestricted = computed(() => profileStore.profile.renalKRestriction === true)

// mock 有延迟，按钮 loading 至少展示 300ms，避免闪烁
const MIN_LOADING_MS = 300
let minLoadingTimer: ReturnType<typeof setTimeout> | null = null
const waitMinLoading = () =>
  new Promise<void>((resolve) => {
    minLoadingTimer = setTimeout(resolve, MIN_LOADING_MS)
  })

onBeforeUnmount(() => {
  if (minLoadingTimer !== null) {
    clearTimeout(minLoadingTimer)
    minLoadingTimer = null
  }
})

async function fetchRecipes(tag?: string) {
  tagLoading.value = true
  try {
    const [recipes] = await Promise.all([getRecipes(tag), waitMinLoading()])
    list.value = Array.isArray(recipes) ? recipes : []
  } finally {
    tagLoading.value = false
  }
}

function openRecipe(recipe: Recipe) {
  currentRecipe.value = recipe
  drawerVisible.value = true
}

async function selectTag(tag: string) {
  if (tagLoading.value || tag === activeTag.value) return
  activeTag.value = tag
  await fetchRecipes(tag)
}

onMounted(async () => {
  loading.value = true
  try {
    const recipes = await getRecipes()
    list.value = Array.isArray(recipes) ? recipes : []

    // 支持从建议卡片等入口带 ?id=xxx 直达并自动打开抽屉
    const queryId = Array.isArray(route.query.id) ? route.query.id[0] : route.query.id
    if (queryId) {
      const target = list.value.find((item) => item.id === queryId)
      if (target) openRecipe(target)
      // 清掉 query，但抽屉状态在本地，不受 replace 影响
      router.replace({ query: {} })
    }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page-container recipes-page">
    <header class="recipes-header">
      <h1 class="recipes-header__title">适合您的食谱</h1>
      <p class="recipes-header__subtitle">都是少油少盐的家常做法，配料都标了克数</p>
    </header>

    <nav class="tag-bar" aria-label="按标签筛选食谱">
      <button
        v-for="tag in RECIPE_TAGS"
        :key="tag"
        type="button"
        class="tag-bar__btn"
        :class="{
          'tag-bar__btn--active': tag === activeTag,
          'tag-bar__btn--dim': renalRestricted && tag === '高钾',
        }"
        :disabled="tagLoading"
        :aria-pressed="tag === activeTag"
        @click="selectTag(tag)"
      >
        <el-icon
          v-if="tagLoading && tag === activeTag"
          class="tag-bar__loading is-loading"
          aria-hidden="true"
        >
          <Loading />
        </el-icon>
        <span>{{ tag }}</span>
      </button>
    </nav>

    <div v-loading="loading || tagLoading" class="recipes-grid-wrap">
      <div v-if="list.length" class="recipes-grid">
        <RecipeCard
          v-for="recipe in list"
          :key="recipe.id"
          :recipe="recipe"
          :renal-k-restriction="renalRestricted"
          @click="openRecipe"
        />
      </div>
      <EmptyState
        v-else-if="!loading"
        icon="Files"
        title="这个标签下暂时没有食谱"
        desc="换个标签看看，其他家常做法也都少油少盐"
      />
    </div>

    <RecipeDrawer
      v-model="drawerVisible"
      :recipe="currentRecipe"
      :renal-k-restriction="renalRestricted"
    />
  </div>
</template>

<style scoped>
.recipes-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.recipes-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.recipes-header__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--color-text);
}

.recipes-header__subtitle {
  margin: 0;
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}

.tag-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.tag-bar__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  min-height: 48px;
  padding: 8px 22px;
  font-family: inherit;
  font-size: var(--font-size-base);
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-text);
  cursor: pointer;
  background-color: var(--color-bg-card);
  border: 2px solid var(--color-border);
  border-radius: 999px;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;
}

.tag-bar__btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.tag-bar__btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.tag-bar__btn--active {
  color: var(--color-text-inverse);
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

/* 控钾用户：高钾标签不作推荐高亮（灰显） */
.tag-bar__btn--dim.tag-bar__btn--active {
  color: var(--color-text-secondary);
  background-color: var(--color-bg-warm);
  border-color: var(--color-border);
}

.tag-bar__btn:disabled {
  cursor: progress;
  opacity: 0.75;
}

.tag-bar__loading {
  font-size: 1.1em;
}

.recipes-grid-wrap {
  position: relative;
  min-height: 200px;
}

.recipes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
</style>
