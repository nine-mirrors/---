<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Warning, Microphone, VideoPause, Camera } from '@element-plus/icons-vue'
import { evaluateApi } from '@/api'
import { scoreMeal } from '@/utils/nutrition'
import { useMealsStore } from '@/stores/meals'
import { useProfileStore } from '@/stores/profile'
import { useSpeech, requestSpeak } from '@/composables/useSpeech'
import { todayStr } from '@/utils/date'
import ScoreRing from '@/components/common/ScoreRing.vue'
import SubstitutionChip from '@/components/common/SubstitutionChip.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ResultMetrics from './result/ResultMetrics.vue'
import RulesPanel from './result/RulesPanel.vue'
import NaBudgetChart from './result/NaBudgetChart.vue'
import RecommendPanel from './result/RecommendPanel.vue'
import SaveMealPopover from './result/SaveMealPopover.vue'
import type { EvaluateResult, Meal, StatusLevel } from '@/types'

const router = useRouter()
const meals = useMealsStore()
const profileStore = useProfileStore()
const { supported, speaking, speak, stop } = useSpeech()

const loading = ref(true)
const result = ref<EvaluateResult | null>(null)
const saving = ref(false)
const savePopVisible = ref(false)

const pending = computed(() => meals.pendingEvaluation)
const premeal = computed<{ heartRate?: number; mood?: string }>(
  () => (pending.value?.premeal as { heartRate?: number; mood?: string } | undefined) || {},
)

// 餐前心率偏快或情绪焦虑时，顶部给一张暖黄色安心提示卡
const showWarmTip = computed(
  () => Number(premeal.value.heartRate) > 100 || premeal.value.mood === '焦虑',
)

const levelTextMap: Record<StatusLevel, string> = {
  green: '这餐搭配得不错，继续保持',
  yellow: '有两个小地方可以调整一下',
  red: '这餐有点咸，调整一下更舒服',
}

const overallText = computed(
  () => levelTextMap[result.value?.level ?? 'yellow'] || levelTextMap.yellow,
)

// 今日已保存餐次 + 1，即本餐在当日的第几餐
const mealOrdinal = computed(() => {
  const today = todayStr()
  const count = meals.meals.filter((meal) => meal.date === today).length
  return count + 1
})

const rules = computed(() => result.value?.rules || [])
const substitutions = computed(() => result.value?.substitutions || [])
const recipes = computed(() => result.value?.recipes || [])

// 肾功能三态原值透传给结果页组件：true 控钾 / false 明确正常 / null 未知
const renalKRestriction = computed(() => profileStore.profile.renalKRestriction ?? null)

async function loadEvaluation() {
  if (!pending.value || !Array.isArray(pending.value.items) || !pending.value.items.length) {
    loading.value = false
    ElMessage.warning('还没有识别的饭菜，先拍一张吧')
    router.replace('/')
    return
  }
  loading.value = true
  try {
    // Mock 接口约 500ms 返回，骨架在 600ms 内结束
    result.value = await evaluateApi({
      items: pending.value.items,
      profile: profileStore.profile,
    })
  } catch (error) {
    console.error('评估失败', error)
    ElMessage.error('评估出了点问题，请再试一次')
  } finally {
    loading.value = false
  }
}

function stripEnding(text: string): string {
  return String(text || '').replace(/[。！？!?．.]+$/, '')
}

// 语音总结：总评 + 钠规则 + 减盐替换建议（控钾画像不播补钾）
function buildSpeechText() {
  if (!result.value) return ''
  const parts = [overallText.value]

  // 钠规则（重点）
  const sodiumRule = rules.value.find((rule) => rule.id === 'HTN_Sodium_High')
  if (sodiumRule) {
    parts.push(sodiumRule.text)
  }

  // 减盐替换建议第一条
  if (substitutions.value.length) {
    parts.push(substitutions.value[0].tip)
  }

  return `${parts.map(stripEnding).filter(Boolean).join('。')}。`
}

function toggleSpeech() {
  // 未开启时由 requestSpeak 统一弹"打开并朗读"确认框，支持/停止分支也在内部处理
  void requestSpeak({ supported, speaking, speak, stop }, buildSpeechText(), {
    rate: 0.9,
    lang: 'zh-CN',
  })
}

function retake() {
  stop()
  meals.clearPending()
  router.replace('/')
}

// 页面展示始终基于"实际拍下这一餐"；仅在"换成低钠搭配保存"时落库 suggested* 口径
function buildMealData(adoptedHealthy: boolean): Partial<Meal> | null {
  const res = result.value
  const pendingData = pending.value
  if (!res || !pendingData || !Array.isArray(pendingData.items)) return null

  if (adoptedHealthy && res.suggestedItems) {
    const suggestedTotals = res.suggestedTotals
    // 评分按采纳后的营养同源重算，避免"存的是低钠餐，分数还是原餐"
    const { score, level } = scoreMeal(suggestedTotals, profileStore.profile)
    return {
      score,
      level,
      totals: suggestedTotals,
      items: res.suggestedItems,
    }
  }

  return {
    score: res.score,
    level: res.level,
    totals: res.totals,
    items: pendingData.items,
  }
}

async function handleSave(adoptedHealthy: boolean) {
  savePopVisible.value = false
  if (saving.value) return
  const data = buildMealData(adoptedHealthy)
  if (!data) return
  saving.value = true
  try {
    await meals.addMeal(data, { adoptedHealthy })
    ElMessage.success(adoptedHealthy ? '已按低钠搭配记录这一餐' : '已记到今天的饮食里')
    stop()
    meals.clearPending()
    router.replace('/')
  } catch (error) {
    console.error('保存失败', error)
    ElMessage.error('没保存成功，请再试一次')
    saving.value = false
  }
}

onMounted(loadEvaluation)
</script>

<template>
  <div class="page-container result-page">
    <!-- 加载骨架 -->
    <div v-if="loading" class="result-grid" aria-busy="true" aria-label="正在评估这餐">
      <div class="nd-card skeleton-card skeleton-summary">
        <el-skeleton animated :rows="3" />
      </div>
      <div class="nd-card skeleton-card">
        <el-skeleton animated :rows="7" />
      </div>
      <div class="nd-card skeleton-card">
        <el-skeleton animated :rows="9" />
      </div>
      <div class="nd-card skeleton-card skeleton-footer">
        <el-skeleton animated :rows="1" />
      </div>
    </div>

    <!-- 失败 / 无数据兜底 -->
    <EmptyState
      v-else-if="!result"
      icon="Camera"
      title="还没有评估结果"
      desc="返回首页拍一张饭菜照片，马上就能看到这餐的营养分析。"
      action-text="回去拍照"
      @action="retake"
    />

    <div v-else class="result-grid">
      <!-- 餐前状态暖黄提示（跨两列） -->
      <div v-if="showWarmTip" class="warm-tip">
        <el-icon class="warm-tip__icon" aria-hidden="true"><Warning /></el-icon>
        <p class="warm-tip__text">您现在心率有点快，先歇两分钟慢慢吃，饭后散步15分钟会更舒服。</p>
      </div>

      <!-- 顶部总评大纸卡（跨两列） -->
      <section class="nd-card summary-card">
        <ScoreRing :score="result.score" :size="168" />
        <div class="summary-card__main">
          <h1 class="summary-card__title">这餐的营养结果</h1>
          <p class="summary-card__overall" :class="`is-${result.level}`">
            {{ overallText }}
          </p>
          <p class="summary-card__meta">今日第 {{ mealOrdinal }} 餐</p>
        </div>
      </section>

      <!-- 左列：指标 + 规则 -->
      <div class="result-col result-col--left">
        <ResultMetrics
          :totals="result.totals"
          :weight-kg="Number(profileStore.profile.weightKg) || 0"
          :height-cm="Number(profileStore.profile.heightCm) || null"
          :activity="profileStore.profile.activity"
          :renal-k-restriction="renalKRestriction"
        />
        <RulesPanel :rules="rules" />
      </div>

      <!-- 右列：钠预算图 + 语音 + 替换 + 推荐 -->
      <div class="result-col result-col--right">
        <NaBudgetChart :totals="result.totals" :renal-k-restriction="renalKRestriction" />

        <button
          type="button"
          class="nd-big-btn listen-btn"
          :class="{ 'listen-btn--stop': speaking }"
          @click="toggleSpeech"
        >
          <el-icon class="listen-btn__icon" aria-hidden="true">
            <VideoPause v-if="speaking" />
            <Microphone v-else />
          </el-icon>
          <span>{{ speaking ? '停下' : '听一听这餐建议' }}</span>
        </button>

        <section v-if="substitutions.length" class="nd-card substitution-card">
          <h2 class="result-section-title">替换建议</h2>
          <div class="substitution-list">
            <SubstitutionChip
              v-for="(item, index) in substitutions"
              :key="`${item.from}-${index}`"
              :from="item.from"
              :to="item.to"
              :tip="item.tip"
            />
          </div>
        </section>

        <RecommendPanel :recipes="recipes" />
      </div>

      <!-- 底部操作（跨两列） -->
      <footer class="result-footer">
        <p class="result-footer__disclaimer">本结果仅为膳食建议，不替代医生诊断。</p>
        <div class="result-footer__actions">
          <el-button class="nd-big-btn retake-btn" @click="retake">
            <el-icon class="retake-btn__icon"><Camera /></el-icon>
            <span>再拍一餐</span>
          </el-button>
          <SaveMealPopover v-model="savePopVisible" :saving="saving" @select="handleSave" />
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.result-grid {
  display: grid;
  grid-template-columns: 5fr 4fr;
  gap: 24px;
  align-items: start;
}

.result-col {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}

.result-section-title {
  margin: 0 0 var(--space-lg);
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.4;
  color: var(--color-text);
}

/* 暖黄提示卡 */
.warm-tip {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-lg) var(--space-xl);
  background-color: color-mix(in srgb, var(--color-warning) 12%, var(--color-bg-card));
  border: 1px solid color-mix(in srgb, var(--color-warning) 45%, var(--color-border));
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.warm-tip__icon {
  flex-shrink: 0;
  font-size: var(--font-size-xl);
  color: var(--color-warning-text);
}

.warm-tip__text {
  margin: 0;
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  color: var(--color-text);
}

/* 顶部总评卡 */
.summary-card {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: var(--space-xl);
  padding: var(--space-xl);
}

.summary-card__main {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-width: 0;
}

.summary-card__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-secondary);
}

.summary-card__overall {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.4;
}

.summary-card__overall.is-green {
  color: var(--color-success);
}

.summary-card__overall.is-yellow {
  color: var(--color-warning-text);
}

.summary-card__overall.is-red {
  color: var(--color-danger);
}

.summary-card__meta {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* 56px 大按钮（次按钮描边 / 主按钮填充） */
.nd-big-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 56px;
  padding: 0 var(--space-xl);
  font-size: 1.05rem;
  font-weight: 600;
  border-radius: var(--radius-md);
}

.listen-btn {
  gap: var(--space-sm);
  color: var(--color-primary);
  background-color: var(--color-bg-card);
  border: 1.5px solid var(--color-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

.listen-btn:hover {
  background-color: color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-card));
}

.listen-btn--stop {
  color: var(--color-danger);
  background-color: var(--color-bg-card);
  border-color: var(--color-danger);
}

.listen-btn--stop:hover {
  background-color: color-mix(in srgb, var(--color-danger) 8%, var(--color-bg-card));
}

.listen-btn__icon {
  font-size: var(--font-size-xl);
}

.retake-btn {
  color: var(--color-primary);
  background-color: var(--color-bg-card);
  border: 1.5px solid var(--color-primary);
}

.retake-btn:hover,
.retake-btn:focus {
  color: var(--color-primary-dark);
  border-color: var(--color-primary-dark);
  background-color: color-mix(in srgb, var(--color-primary) 6%, var(--color-bg-card));
}

.retake-btn__icon {
  margin-right: var(--space-sm);
}

.substitution-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

/* 底部 */
.result-footer {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
  padding-top: var(--space-sm);
}

.result-footer__disclaimer {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.result-footer__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-lg);
  width: 100%;
  max-width: 640px;
}

/* 骨架屏 */
.skeleton-card {
  padding: var(--space-xl);
}

.skeleton-summary {
  grid-column: 1 / -1;
  min-height: 220px;
}

.skeleton-footer {
  grid-column: 1 / -1;
}

/* 窄屏（<1200）退化为单列；<1024 收紧间距 */
@media (max-width: 1199px) {
  .result-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1023px) {
  .result-grid,
  .result-col {
    gap: var(--space-lg);
  }

  .summary-card {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-lg);
  }

  .result-footer__actions {
    grid-template-columns: 1fr;
    max-width: none;
  }
}
</style>
