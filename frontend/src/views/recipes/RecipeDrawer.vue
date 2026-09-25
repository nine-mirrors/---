<script setup lang="ts">
import { computed } from 'vue'
import { Close } from '@element-plus/icons-vue'
import type { Recipe } from '@/types'

const props = withDefaults(
  defineProps<{
    modelValue?: boolean
    recipe?: Recipe | null
    /** 画像是否需控钾：true 时高钾食谱顶部显示控钾提醒 */
    renalKRestriction?: boolean
  }>(),
  { modelValue: false, recipe: null, renalKRestriction: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function fmt(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '--'
  return String(Math.round(n * 10) / 10)
}

const tags = computed(() => {
  const list = props.recipe?.tags
  return Array.isArray(list) ? list.filter((tag: string) => tag) : []
})

const isHighPotassium = computed(() => tags.value.includes('高钾'))

const ingredients = computed(() => props.recipe?.ingredients ?? [])

const salt = computed(() =>
  ingredients.value.find((ing) => ing.id === 'salt' || String(ing.name || '').includes('盐')),
)

const steps = computed(() => props.recipe?.steps ?? [])

// 每份营养：热量/蛋白/碳水/钠/钾（R2.3：移除 GL/GI）
const nutrientCells = computed(() => {
  const n = props.recipe?.nutrients
  if (!n) return []
  return [
    { key: 'energyKCal', label: '热量', value: fmt(n.energyKCal), unit: '千卡' },
    { key: 'protein', label: '蛋白质', value: fmt(n.protein), unit: '克' },
    { key: 'CHO', label: '碳水化合物', value: fmt(n.CHO), unit: '克' },
    { key: 'Na', label: '钠', value: fmt(n.Na), unit: '毫克' },
    { key: 'K', label: '钾', value: fmt(n.K), unit: '毫克' },
  ]
})

function syncVisible(visible: boolean) {
  emit('update:modelValue', visible)
}

function closeDrawer() {
  emit('update:modelValue', false)
}

// 成品图加载失败：隐藏横幅，详情内容不受影响
function handleImageError(event: Event) {
  const target = event.target as HTMLImageElement | null
  if (target) target.style.display = 'none'
}
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    :with-header="false"
    direction="rtl"
    size="min(480px, 92vw)"
    class="recipe-drawer"
    body-class="recipe-drawer__body"
    @update:model-value="syncVisible"
  >
    <div v-if="recipe" class="drawer-shell">
      <!-- 顶部成品图横幅：写实示意图，加载失败自动隐藏 -->
      <div class="drawer-hero">
        <img
          v-if="recipe.image"
          :src="recipe.image"
          :alt="`${recipe.name}成品示意图`"
          class="drawer-hero__image"
          draggable="false"
          @error="handleImageError"
        />
      </div>

      <header class="drawer-header">
        <div class="drawer-header__info">
          <h2 class="drawer-header__title">{{ recipe.name }}</h2>
          <ul v-if="tags.length" class="drawer-tags list-unstyled">
            <li v-for="tag in tags" :key="tag">
              <el-tag
                class="drawer-tag"
                :class="{ 'drawer-tag--dim': renalKRestriction && tag === '高钾' }"
                round
                disable-transitions
              >
                {{ tag }}
              </el-tag>
            </li>
          </ul>
        </div>
        <button type="button" class="drawer-close" aria-label="关闭食谱详情" @click="closeDrawer">
          <el-icon aria-hidden="true"><Close /></el-icon>
        </button>
      </header>

      <div class="drawer-body">
        <!-- 控钾提醒：肾不好用户打开高钾食谱时顶部醒目提示 -->
        <div v-if="renalKRestriction && isHighPotassium" class="renal-warn">
          <p class="renal-warn__title">控钾提醒</p>
          <p class="renal-warn__text">
            按您的情况，含钾高的食物和低钠盐都要控制。这道菜含钾较高，请先问过医生或营养师再吃，别自己买补钾片。
          </p>
        </div>

        <!-- 富钾食谱通用安全提示 -->
        <div v-else-if="isHighPotassium" class="k-safety">
          <p class="k-safety__text">
            富钾食物有益血压，但肾不好或正在吃普利/沙坦类降压药的人，补钾要先问医生；补钾片、低钠盐别自己买来吃。
          </p>
        </div>

        <p class="drawer-yield">一份约 {{ recipe.yieldG }} 克</p>

        <section class="drawer-section">
          <h3 class="drawer-section__title">每份营养摘要</h3>
          <ul class="nutr-grid list-unstyled">
            <li v-for="cell in nutrientCells" :key="cell.key" class="nutr-cell">
              <p class="nutr-cell__value">
                {{ cell.value }}
                <span class="nutr-cell__unit">{{ cell.unit }}</span>
              </p>
              <p class="nutr-cell__label">{{ cell.label }}</p>
            </li>
          </ul>
        </section>

        <section class="drawer-section">
          <h3 class="drawer-section__title">配料表</h3>
          <ul class="ingr-list list-unstyled">
            <li v-for="ing in ingredients" :key="ing.id" class="ingr-row">
              <span class="ingr-name">{{ ing.name }}</span>
              <span class="ingr-dots" aria-hidden="true"></span>
              <span class="ingr-grams">{{ ing.grams }} 克</span>
            </li>
          </ul>
          <p v-if="salt" class="ingr-salt-tip">盐约 {{ fmt(salt.grams) }} 克，约小半啤酒盖</p>
        </section>

        <section class="drawer-section">
          <h3 class="drawer-section__title">做法步骤</h3>
          <ol class="steps-list list-unstyled">
            <li v-for="(step, index) in steps" :key="index" class="steps-item">
              <span class="steps-index" aria-hidden="true">{{ index + 1 }}</span>
              <span class="steps-text">{{ step }}</span>
            </li>
          </ol>
        </section>
      </div>

      <footer class="drawer-footer">
        营养数据按配料克数计算 · 来源：《中国食物成分表（标准版）》
      </footer>
    </div>
  </el-drawer>
</template>

<style>
/* el-drawer 传送至 body，样式需全局生效，类名统一 recipe-drawer 前缀 */
.el-drawer.recipe-drawer {
  background-color: var(--color-bg-card);
}

.el-drawer__body.recipe-drawer__body {
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}
</style>

<style scoped>
.drawer-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 顶部成品图横幅：宽 100%、高 180px；图加载失败被隐藏后容器自然塌缩 */
.drawer-hero {
  flex-shrink: 0;
}

.drawer-hero__image {
  display: block;
  width: 100%;
  height: 180px;
  object-fit: cover;
  background-color: var(--color-bg-warm);
}

.drawer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
  padding: var(--space-lg) var(--space-lg) var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

.drawer-header__info {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-width: 0;
}

.drawer-header__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--color-text);
}

.drawer-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.drawer-tag {
  height: auto;
  padding: 3px 14px;
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.6;
  color: var(--color-primary);
  background-color: color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-card));
  border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-bg-card));
  border-radius: 999px;
}

/* 控钾用户：高钾标签不作推荐高亮，灰显 */
.drawer-tag--dim {
  color: var(--color-text-secondary);
  background-color: var(--color-bg-warm);
  border-color: var(--color-border);
}

.drawer-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  font-size: 1.25rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  background-color: transparent;
  border: none;
  border-radius: 50%;
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
}

.drawer-close:hover {
  color: var(--color-text);
  background-color: var(--color-bg-warm);
}

.drawer-close:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.drawer-body {
  flex: 1;
  padding: var(--space-md) var(--space-lg) var(--space-lg);
  overflow-y: auto;
}

/* 控钾提醒：醒目橙红边框 */
.renal-warn {
  margin-bottom: var(--space-md);
  padding: var(--space-md);
  background-color: color-mix(in srgb, var(--color-danger) 8%, var(--color-bg-card));
  border: 2px solid var(--color-danger);
  border-radius: var(--radius-md);
}

.renal-warn__title {
  margin: 0 0 4px;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-danger);
}

.renal-warn__text {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--color-text);
}

/* 富钾通用安全提示 */
.k-safety {
  margin-bottom: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  background-color: var(--color-bg-warm);
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius-sm);
}

.k-safety__text {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--color-text);
}

.drawer-yield {
  margin: 0 0 var(--space-md);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.drawer-section {
  margin-bottom: var(--space-lg);
}

.drawer-section__title {
  margin: 0 0 var(--space-md);
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.4;
  color: var(--color-text);
}

.nutr-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  gap: var(--space-sm);
}

.nutr-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-md) var(--space-sm);
  text-align: center;
  background-color: var(--color-bg-warm);
  border-radius: var(--radius-md);
}

.nutr-cell__value {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--color-primary-dark);
}

.nutr-cell__unit {
  margin-left: 2px;
  font-size: 0.95rem;
  font-weight: 500;
}

.nutr-cell__label {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.4;
  color: var(--color-text-secondary);
}

.ingr-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.ingr-row {
  display: flex;
  align-items: baseline;
  font-size: 1rem;
  line-height: 1.6;
}

.ingr-name {
  flex-shrink: 0;
  color: var(--color-text);
}

.ingr-dots {
  flex: 1;
  min-width: 16px;
  margin: 0 var(--space-sm);
  border-bottom: 2px dotted color-mix(in srgb, var(--color-text-secondary) 55%, transparent);
  transform: translateY(-0.2em);
}

.ingr-grams {
  flex-shrink: 0;
  font-weight: 600;
  color: var(--color-text);
}

.ingr-salt-tip {
  margin: var(--space-md) 0 0;
  padding: var(--space-sm) var(--space-md);
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--color-text-secondary);
  background-color: var(--color-bg-warm);
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius-sm);
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  counter-reset: recipe-step;
}

.steps-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
}

.steps-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 1.75em;
  height: 1.75em;
  margin-top: 0.1em;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text-inverse);
  background-color: var(--color-primary);
  border-radius: 50%;
}

.steps-text {
  flex: 1;
  font-size: 1rem;
  line-height: 1.8;
  color: var(--color-text);
}

.drawer-footer {
  padding: var(--space-md) var(--space-lg);
  font-size: 0.95rem;
  text-align: center;
  color: var(--color-text-secondary);
  border-top: 1px solid var(--color-border);
}
</style>
