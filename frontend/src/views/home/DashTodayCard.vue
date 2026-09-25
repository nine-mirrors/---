<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Food, InfoFilled } from '@element-plus/icons-vue'
import DemoBadge from '@/components/common/DemoBadge.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useMealsStore } from '@/stores/meals'
import { useProfileStore } from '@/stores/profile'
import { useBpLogStore } from '@/stores/bpLog'
import { buildDashProgress } from '@/utils/nutrition'
import { buildLifestyleTips } from '@/utils/lifestyle'
import { recentDates, todayStr } from '@/utils/date'
import type { DashDimension, Meal } from '@/types'

const mealsStore = useMealsStore()
const profileStore = useProfileStore()
const bpStore = useBpLogStore()

// 当天已保存餐次（跨三餐累加）
const todayMeals = computed<Meal[]>(() => {
  const today = todayStr()
  return mealsStore.meals.filter((m) => m.date === today)
})

const progress = computed(() => buildDashProgress(todayMeals.value, profileStore.profile))

const hasMeals = computed(() => todayMeals.value.length > 0)

// 近 7 天餐次（今日 DASH + 最近常吃聚合）与血压记录（戒烟限酒卡用）；
// 只在未加载时拉一次，失败静默（页面仍可手动记一餐）
onMounted(() => {
  if (!mealsStore.loaded) {
    const dates = recentDates(7)
    mealsStore.load({ from: dates[0], to: dates[dates.length - 1] }).catch(() => {})
  }
  if (!bpStore.loaded) {
    bpStore.recordsOfLast7().catch(() => {})
  }
})

// 戒烟限酒温和提醒（仅画像勾选了吸烟/饮酒才出现）
const lifestyleTips = computed(() => buildLifestyleTips(profileStore.profile, bpStore.records))

// 进度条百分比（取 value/target，clamp 0–100）
function percent(dim: DashDimension): number {
  if (!dim.target || dim.target <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((dim.value / dim.target) * 100)))
}

// 状态对应颜色：达标绿/接近黄/差距大暖色（不用红色吓人）；控钾/中性态用灰
function dimColor(status: DashDimension['status']): string {
  switch (status) {
    case 'green':
      return 'var(--color-success)'
    case 'yellow':
      return 'var(--color-warning)'
    case 'red':
      return '#d97706' // 暖色，不用红色吓人
    case 'restricted':
    case 'neutral':
    default:
      return 'var(--color-text-secondary)'
  }
}

// 维度数值与单位文案（各维单位不同，禁止统一显示 mg）
function valueText(dim: DashDimension): string {
  if (dim.status === 'restricted') return '遵医嘱'
  if (dim.key === 'k' && dim.status === 'neutral') return '适量'
  if (dim.key === 'salt') return `${dim.value} g`
  if (dim.key === 'energy') return `${dim.value} 千卡`
  if (dim.key === 'k') return `${dim.value} mg`
  return `${dim.value} g` // 蔬菜/纤维/蛋白
}

function targetText(dim: DashDimension): string {
  if (dim.key === 'salt') return '一天不超 5g'
  if (dim.key === 'energy')
    return dim.status === 'neutral'
      ? `一天约 ${dim.target} 千卡，记全再评`
      : `一天约 ${dim.target} 千卡`
  if (dim.key === 'veg') return '目标 500g'
  if (dim.key === 'fiber') return '目标 25g'
  if (dim.key === 'protein') return `目标 ${dim.target}g`
  return '' // 富钾不强调满目标
}
</script>

<template>
  <section class="dash-card nd-card" aria-label="今日健康饮食达标">
    <header class="dash-card__head">
      <div class="dash-card__title-wrap">
        <h2 class="dash-card__title">今日健康饮食达标</h2>
        <span class="dash-card__subtitle">低盐 · 控热量 · 蔬菜 · 纤维 · 蛋白 · 富钾</span>
      </div>
      <DemoBadge text="演示数据" />
    </header>

    <EmptyState
      v-if="!hasMeals"
      icon="Bowl"
      title="还没记录今天的饭"
      desc="拍一拍今天的饭菜，就能看到达标进度"
    />

    <ul v-else class="dash-card__dims list-unstyled">
      <li v-for="dim in progress.dimensions" :key="dim.key" class="dash-dim">
        <div class="dash-dim__head">
          <span class="dash-dim__label">{{ dim.label }}</span>
          <span class="dash-dim__value" :style="{ color: dimColor(dim.status) }">
            {{ valueText(dim) }}
          </span>
        </div>

        <!-- 医生明确限钾：不渲染追求满进度的条 -->
        <div v-if="dim.status === 'restricted'" class="dash-dim__neutral">
          <el-icon aria-hidden="true"><Food /></el-icon>
          <span>按您的情况，富钾食物和低钠盐都要控制</span>
        </div>
        <!-- 肾功能未知（null）：中性提示，不出现"都要控制"，也不夸达标 -->
        <div v-else-if="dim.key === 'k' && dim.status === 'neutral'" class="dash-dim__neutral">
          <el-icon aria-hidden="true"><Food /></el-icon>
          <span>肾功能不确定，含钾食物适量吃就好，暂不评达标</span>
        </div>
        <!-- 其余（含盐维度无调味品记录、热量没记全的 neutral）：灰条中性展示，不给绿色 -->
        <div v-else class="dash-dim__bar">
          <div
            class="dash-dim__bar-fill"
            :style="{ width: percent(dim) + '%', backgroundColor: dimColor(dim.status) }"
          />
        </div>

        <p v-if="dim.status !== 'restricted'" class="dash-dim__target">
          {{ targetText(dim) }}
        </p>
        <p class="dash-dim__text">{{ dim.text }}</p>
      </li>
    </ul>

    <!-- 环外：高脂/高胆固醇食材提示（不评分、不亮红叉） -->
    <p v-if="hasMeals && progress.fatNote" class="dash-card__fat">
      <el-icon aria-hidden="true"><Food /></el-icon>
      <span>{{ progress.fatNote }}</span>
    </p>

    <!-- 环外：戒烟限酒温和提醒（仅画像勾选项出现；近期血压高危时加强） -->
    <ul v-if="lifestyleTips.length" class="dash-card__lifestyle list-unstyled">
      <li
        v-for="tip in lifestyleTips"
        :key="tip.key"
        class="lifestyle-tip"
        :class="{ 'lifestyle-tip--urgent': tip.urgent }"
      >
        <p class="lifestyle-tip__title">
          <el-icon aria-hidden="true"><InfoFilled /></el-icon>
          {{ tip.title
          }}<span v-if="tip.urgent" class="lifestyle-tip__badge">血压不稳加强提醒</span>
        </p>
        <p class="lifestyle-tip__text">{{ tip.text }}</p>
      </li>
    </ul>

    <!-- 蛋白 / 富钾安全提示 -->
    <p v-if="hasMeals" class="dash-card__safety">
      肾有问题的老人蛋白量要听医生的；补钾片、低钠盐别自己买来吃，先问大夫。
    </p>
  </section>
</template>

<style scoped>
.dash-card {
  padding: var(--space-xl);
}

.dash-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.dash-card__title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-text);
}

.dash-card__subtitle {
  display: block;
  margin-top: var(--space-xs);
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.dash-card__dims {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.dash-dim__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-sm);
}

.dash-dim__label {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.dash-dim__value {
  font-size: 1.15rem;
  font-weight: 700;
}

.dash-dim__bar {
  height: 10px;
  margin: var(--space-sm) 0;
  background-color: var(--color-bg-warm);
  border-radius: 999px;
  overflow: hidden;
}

.dash-dim__bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
}

.dash-dim__neutral {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: var(--space-sm) 0;
  padding: var(--space-sm) var(--space-md);
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  background-color: var(--color-bg-warm);
  border-radius: var(--radius-sm);
}

.dash-dim__target {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.dash-dim__text {
  margin: var(--space-xs) 0 0;
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

/* 高脂/高胆固醇环外提示：暖灰底，不做红色警示 */
.dash-card__fat {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  margin: var(--space-lg) 0 0;
  padding: var(--space-md);
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--color-text-secondary);
  background-color: var(--color-bg-warm);
  border-left: 4px solid var(--color-warning);
  border-radius: var(--radius-sm);
}

.dash-card__fat .el-icon {
  margin-top: 3px;
  flex-shrink: 0;
}

/* 戒烟限酒卡（环外、温和；高危时暖色左边框） */
.dash-card__lifestyle {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin: var(--space-lg) 0 0;
}

.lifestyle-tip {
  margin: 0;
  padding: var(--space-md);
  background-color: var(--color-bg-warm);
  border-left: 4px solid var(--color-text-secondary);
  border-radius: var(--radius-sm);
}

.lifestyle-tip--urgent {
  border-left-color: var(--color-warning);
}

.lifestyle-tip__title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-xs);
  margin: 0 0 var(--space-xs);
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
}

.lifestyle-tip__badge {
  padding: 2px 8px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-warning-text, #92400e);
  background-color: color-mix(in srgb, var(--color-warning) 18%, transparent);
  border-radius: 999px;
}

.lifestyle-tip__text {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.dash-card__safety {
  margin: var(--space-lg) 0 0;
  padding: var(--space-md);
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--color-text-secondary);
  background-color: var(--color-bg-warm);
  border-radius: var(--radius-sm);
}
</style>
