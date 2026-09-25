<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Delete, Search } from '@element-plus/icons-vue'
import BigOptionButton from '@/components/common/BigOptionButton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { searchFoods } from '@/api'
import { FOOD_MAP } from '@/mock/foods'
import type { Food, FoodServing } from '@/types'

/** 识别确认区行模型（与 Home.vue 的 HomeItem 结构兼容） */
interface FoodRow {
  _uid: string
  /** 食物库 id：有 servingPresets 的食物（盐、生抽等）渲染专用份量大按钮 */
  id?: string
  kind?: string
  name?: string
  baseWeightG: number
  /** 当前实际克数；preset 食物直接等于所选档位 weightG */
  weightG?: number
  portion: string
  manual: boolean
  confidence: number | null
}

const props = defineProps<{
  items: FoodRow[]
}>()

const emit = defineEmits<{
  portion: [payload: { uid: string; portion: string; weightG?: number }]
  remove: [uid: string]
  add: [food: Food]
}>()

const PORTIONS: { key: string; label: string; factor: number }[] = [
  { key: 'small', label: '小份', factor: 0.7 },
  { key: 'standard', label: '标准', factor: 1 },
  { key: 'large', label: '大份', factor: 1.3 },
]

/* ---------------- 调味品专用份量档（盐/生抽，真实克数不走 0.7/1/1.3） ---------------- */

/** 该行食物是否配有专用份量档（如盐 1/5/10g、生抽 5/10/20ml） */
function presetsOf(item: FoodRow): FoodServing[] {
  return item.id ? (FOOD_MAP[item.id]?.servingPresets ?? []) : []
}

/** 当前选中的 preset 档位：优先 portion=preset-N，其次按 weightG 匹配，兜底第一档 */
function presetIndex(item: FoodRow): number {
  const presets = presetsOf(item)
  if (!presets.length) return -1
  const m = /^preset-(\d+)$/.exec(item.portion)
  if (m) {
    const idx = Number(m[1])
    if (idx >= 0 && idx < presets.length) return idx
  }
  if (typeof item.weightG === 'number') {
    const hit = presets.findIndex((p) => p.weightG === item.weightG)
    if (hit >= 0) return hit
  }
  return 0
}

function choosePreset(item: FoodRow, index: number) {
  const preset = presetsOf(item)[index]
  if (!preset) return
  emit('portion', { uid: item._uid, portion: `preset-${index}`, weightG: preset.weightG })
}

/** 普通食物三档：标签直接带白话克数（"小份 约70克"），避免老人换算 */
function normalPortions(item: FoodRow): { key: string; label: string }[] {
  return PORTIONS.map((p) => ({
    key: p.key,
    label: `${p.label} 约${Math.round(item.baseWeightG * p.factor)}克`,
  }))
}

const foodOptions = ref<Food[]>([])
const selectedFoodId = ref('')
const searching = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null
let requestSeq = 0

async function loadOptions(keyword = '') {
  const seq = ++requestSeq
  searching.value = true
  try {
    const list = await searchFoods(keyword)
    if (seq === requestSeq) foodOptions.value = Array.isArray(list) ? list : []
  } finally {
    if (seq === requestSeq) searching.value = false
  }
}

// remote-method 300ms 防抖
function remoteSearch(query: string) {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    loadOptions(query)
  }, 300)
}

function handleAdd(id: string) {
  const food = foodOptions.value.find((item) => item.id === id)
  selectedFoodId.value = ''
  if (food) emit('add', food)
}

/* ---------------- 常点菜大字快捷区 ---------------- */

/** 固定的 8 个常见菜名；食物库解析不到的不显示对应 chip */
const QUICK_FOOD_NAMES = ['青菜', '米饭', '鸡蛋', '豆腐', '番茄', '鸡胸肉', '牛奶', '燕麦']

interface QuickFood {
  /** chip 上展示的菜名（固定常用名） */
  name: string
  /** 食物库中解析出的真实 Food，点击时与搜索选中走同一个 add 事件 */
  food: Food
}

const quickFoods = ref<QuickFood[]>([])

/** 从搜索结果里挑最贴切的一项：全名一致 > 以菜名开头 > 第一条 */
function pickBest(list: Food[], keyword: string): Food | undefined {
  return (
    list.find((item) => item.name === keyword) ||
    list.find((item) => item.name.startsWith(keyword)) ||
    list[0]
  )
}

// 组件加载时解析常点菜：只使用 searchFoods 返回的真实 Food，搜不到的项直接跳过
async function resolveQuickFoods() {
  const results = await Promise.all(
    QUICK_FOOD_NAMES.map(async (name) => {
      try {
        const list = await searchFoods(name)
        const food = Array.isArray(list) ? pickBest(list, name) : undefined
        return food ? { name, food } : null
      } catch {
        return null
      }
    }),
  )
  const picked: QuickFood[] = []
  results.forEach((entry) => {
    if (entry && !picked.some((item) => item.food.id === entry.food.id)) {
      picked.push(entry)
    }
  })
  quickFoods.value = picked
}

/* ---------------- 删除二次确认 ---------------- */

async function handleRemoveClick(item: FoodRow) {
  try {
    await ElMessageBox.confirm(
      `确定删掉「${item.name || '这道菜'}」吗？删了要重新加哦。`,
      '删掉这道菜吗？',
      {
        confirmButtonText: '删除',
        cancelButtonText: '留着',
        type: 'warning',
      },
    )
  } catch {
    // 老人点“留着”：不删
    return
  }
  emit('remove', item._uid)
}

function portionFactor(portion: string): number {
  const matched = PORTIONS.find((item) => item.key === portion)
  return matched ? matched.factor : 1
}

function weightText(item: FoodRow): number {
  // preset 行与手动改过克数的行直接用真实 weightG；其余按 0.7/1/1.3 折算
  if (typeof item.weightG === 'number') return Math.round(item.weightG)
  return Math.round(item.baseWeightG * portionFactor(item.portion))
}

function confidenceText(item: FoodRow): string {
  if (item.manual || typeof item.confidence !== 'number') return '手动添加'
  return `${Math.round(item.confidence * 100)}% 像`
}

function isUncertain(item: FoodRow): boolean {
  return !item.manual && typeof item.confidence === 'number' && item.confidence < 0.7
}

onMounted(() => {
  loadOptions('')
  resolveQuickFoods()
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <div class="food-list">
    <p class="food-list__hint">智能餐盘/称重勺（演示版请手动选择分量）</p>

    <ul v-if="props.items.length" class="food-list__items list-unstyled">
      <li v-for="item in props.items" :key="item._uid" class="food-card nd-card">
        <div class="food-card__head">
          <div class="food-card__name-wrap">
            <span class="food-card__name">{{ item.name }}</span>
            <span class="food-card__conf" :class="{ 'food-card__conf--warn': isUncertain(item) }">
              {{ confidenceText(item) }}
            </span>
          </div>
          <button
            type="button"
            class="food-card__delete"
            aria-label="删除这道菜"
            @click="handleRemoveClick(item)"
          >
            <el-icon aria-hidden="true"><Delete /></el-icon>
          </button>
        </div>

        <p v-if="isUncertain(item)" class="food-card__warn">不太确定，您看看是不是</p>

        <!-- 调味品专用份量档：单选大按钮，标签自带克数/毫升（盐 1小撮、生抽 1勺） -->
        <div v-if="presetsOf(item).length" class="food-card__portions food-card__portions--preset">
          <BigOptionButton
            v-for="(preset, index) in presetsOf(item)"
            :key="`preset-${index}`"
            :label="preset.label"
            :model-value="presetIndex(item) === index"
            @update:model-value="choosePreset(item, index)"
          />
        </div>
        <!-- 普通食物：小份/标准/大份，按钮直接显示约多少克 -->
        <div v-else class="food-card__portions">
          <BigOptionButton
            v-for="portion in normalPortions(item)"
            :key="portion.key"
            :label="portion.label"
            :model-value="item.portion === portion.key"
            @update:model-value="emit('portion', { uid: item._uid, portion: portion.key })"
          />
        </div>
        <p class="food-card__weight">约 {{ weightText(item) }} 克</p>
      </li>
    </ul>

    <EmptyState v-else icon="Bowl" title="这餐还没有菜" desc="可以重新拍一张，或者在下面手动加菜" />

    <div class="food-list__add">
      <label class="food-list__add-label" for="manual-food-select">手动加菜</label>

      <!-- 常点菜大字快捷区：点 chip 与搜索选中走同一个 add 事件 -->
      <div v-if="quickFoods.length" class="food-list__quick">
        <p class="food-list__quick-label">常点的菜，点一下就加上</p>
        <div class="food-list__quick-chips">
          <button
            v-for="quick in quickFoods"
            :key="quick.food.id"
            type="button"
            class="food-list__quick-chip"
            @click="emit('add', quick.food)"
          >
            {{ quick.name }}
          </button>
        </div>
      </div>

      <el-select
        id="manual-food-select"
        v-model="selectedFoodId"
        class="food-list__add-select"
        size="large"
        filterable
        remote
        clearable
        :remote-method="remoteSearch"
        :loading="searching"
        :prefix-icon="Search"
        placeholder="输入菜名搜索，如 青菜"
        @change="handleAdd"
      >
        <el-option v-for="food in foodOptions" :key="food.id" :label="food.name" :value="food.id">
          <span class="food-list__option-name">{{ food.name }}</span>
          <span class="food-list__option-cat">{{ food.category }}</span>
        </el-option>
      </el-select>
    </div>
  </div>
</template>

<style scoped>
.food-list__hint {
  margin: 0 0 var(--space-md);
  font-size: 0.95rem;
  color: var(--color-text-secondary);
}

.food-list__items {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.food-card {
  padding: var(--space-md) var(--space-lg);
}

.food-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-sm);
}

.food-card__name-wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-sm);
  min-width: 0;
}

.food-card__name {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-text);
}

.food-card__conf {
  font-size: 0.95rem;
  color: var(--color-text-secondary);
}

.food-card__conf--warn {
  color: var(--color-warning-text);
  font-weight: 600;
}

.food-card__warn {
  margin: var(--space-xs) 0 0;
  font-size: 0.95rem;
  color: var(--color-warning-text);
}

.food-card__delete {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  color: var(--color-text-secondary);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.food-card__delete:hover {
  color: var(--color-danger);
  background-color: var(--color-danger-bg);
}

.food-card__portions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-sm);
  margin-top: var(--space-md);
}

/* 调味品档：标签较长（"小半勺（约5毫升）"），按宽度自适应排 2–3 个 */
.food-card__portions--preset {
  grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
}

.food-card__portions :deep(.big-option-button) {
  justify-content: center;
  min-height: 48px;
  padding: var(--space-sm);
  text-align: center;
}

.food-card__portions :deep(.big-option-button__text) {
  align-items: center;
}

.food-card__weight {
  margin: var(--space-sm) 0 0;
  font-size: 0.95rem;
  text-align: right;
  color: var(--color-text-secondary);
}

.food-list__add {
  margin-top: var(--space-lg);
}

.food-list__add-label {
  display: block;
  margin-bottom: var(--space-sm);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.food-list__add-select {
  width: 100%;
}

.food-list__quick {
  margin-bottom: var(--space-md);
}

.food-list__quick-label {
  margin: 0 0 var(--space-sm);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.food-list__quick-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.food-list__quick-chip {
  min-height: 48px;
  padding: 0 var(--space-lg);
  font-family: inherit;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-primary-dark);
  background-color: color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-card));
  border: 2px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
  border-radius: 999px;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.food-list__quick-chip:hover {
  color: var(--color-text-inverse);
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

/* 适老热区：element-plus size=large 触发区为 40px，这里补到 ≥44px */
.food-list__add-select :deep(.el-select__wrapper) {
  min-height: 44px;
}

.food-list__option-name {
  font-size: 1rem;
}

.food-list__option-cat {
  float: right;
  margin-left: var(--space-md);
  font-size: 0.95rem;
  color: var(--color-text-secondary);
}
</style>
