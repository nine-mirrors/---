<script setup lang="ts">
import { computed, provide, reactive, ref } from 'vue'
import type { Component } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useProfileStore } from '@/stores/profile'
import { assessHypertension } from '@/utils/healthAssess'
import { todayStr } from '@/utils/date'
import BasicInfoStep from './onboarding/BasicInfoStep.vue'
import DietHabitStep from './onboarding/DietHabitStep.vue'
import HtnStep from './onboarding/HtnStep.vue'
import SummaryStep from './onboarding/SummaryStep.vue'
import SymptomQuizStep from './onboarding/SymptomQuizStep.vue'
import StepIndicator from './onboarding/StepIndicator.vue'
import { DRAFT_KEY, type OnboardingDraft } from './onboarding/useDraft'

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

type StageName = 'htn' | 'symptom' | 'basic' | 'diet' | 'summary'

const router = useRouter()
const profileStore = useProfileStore()

const STEP_LABELS = ['健康状况', '基本信息', '饮食与习惯', '健康小结']

// 阶段顺序：健康状况一组内包含 高血压 →（不清楚时）症状问卷
const STAGE_COMPONENTS: Record<StageName, Component> = {
  htn: HtnStep,
  symptom: SymptomQuizStep,
  basic: BasicInfoStep,
  diet: DietHabitStep,
  summary: SummaryStep,
}
const STAGE_GROUP: Record<StageName, number> = {
  htn: 0,
  symptom: 0,
  basic: 1,
  diet: 2,
  summary: 3,
}
const GROUP_ENTRY_STAGE: StageName[] = ['htn', 'basic', 'diet']

function createDraft(): OnboardingDraft {
  // 重新测评时基础画像保留（Profile 页 restartAssessment 只清慢病结论），首次进入则全是默认值
  const p = profileStore.profile
  return {
    name: p.name || '',
    age: p.age ?? null,
    gender: p.gender || '',
    heightCm: p.heightCm ?? null,
    weightKg: p.weightKg ?? null,
    occupation: p.occupation || '',
    activity: p.activity || 'low',
    dental: p.dental || '好',
    taste: p.taste || '一般',
    staplePref: p.staplePref || '',
    eatOutFreq: p.eatOutFreq || '',
    smoke: p.smoke || '否',
    drink: p.drink || '否',
    allergies: Array.isArray(p.allergies) ? [...p.allergies] : [],
    htnStatus: null,
    renalKRestriction: p.renalKRestriction ?? null,
    htnDetail: {
      duration: '',
      medicated: false,
      symptoms: [],
      factors: [],
      redFlags: [],
      assessedAt: null,
      records: [],
    },
  }
}

const draft = reactive(createDraft()) as OnboardingDraft
provide(DRAFT_KEY, draft)

const stage = ref<StageName>('htn')
const currentGroup = computed(() => STAGE_GROUP[stage.value])
const stageComponent = computed(() => STAGE_COMPONENTS[stage.value])
const isLastStage = computed(() => stage.value === 'summary')
const showBack = computed(() => stage.value !== 'htn')
const nextLabel = computed(() => (isLastStage.value ? '开始用' : '下一步'))

function warn(message: string) {
  // 适老化：校验提示停留 5 秒，给老人留足阅读时间
  ElMessage({ message, type: 'warning', duration: 5000 })
}

function toNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function inRange(value: unknown, min: number, max: number): boolean {
  const n = toNumber(value)
  return n !== null && n >= min && n <= max
}

function validateCurrent() {
  switch (stage.value) {
    case 'htn':
      if (!draft.htnStatus) {
        warn('先选一个最接近您情况的选项吧')
        return false
      }
      return true
    case 'basic':
      if (!inRange(draft.age, 40, 100)) {
        warn('请填写 40–100 之间的年龄')
        return false
      }
      if (!draft.gender) {
        warn('请选择性别')
        return false
      }
      if (!inRange(draft.heightCm, 140, 200)) {
        warn('请填写 140–200 之间的身高（厘米）')
        return false
      }
      if (!inRange(draft.weightKg, 30, 150)) {
        warn('请填写 30–150 之间的体重（公斤）')
        return false
      }
      if (!draft.occupation) {
        warn('选一下您现在主要做什么吧')
        return false
      }
      return true
    case 'diet':
      if (!draft.staplePref || !draft.eatOutFreq) {
        warn('主食和外食频率都选一下吧')
        return false
      }
      return true
    default:
      return true
  }
}

function clearQuizAnswers() {
  draft.htnDetail.symptoms = []
  draft.htnDetail.factors = []
  draft.htnDetail.redFlags = []
  draft.htnDetail.assessedAt = null
}

function goNext() {
  if (!validateCurrent()) return

  if (stage.value === 'htn') {
    if (draft.htnStatus === 'unsure') {
      stage.value = 'symptom'
    } else {
      // 改选“有/没有”后丢弃旧问卷答案
      clearQuizAnswers()
      stage.value = 'basic'
    }
    return
  }

  if (stage.value === 'symptom') {
    const result = assessHypertension({
      symptoms: draft.htnDetail.symptoms,
      factors: draft.htnDetail.factors,
      redFlags: draft.htnDetail.redFlags,
    })
    draft.htnStatus = result.status
    draft.htnDetail.assessedAt = todayStr()
    stage.value = 'basic'
    return
  }

  if (stage.value === 'basic') {
    stage.value = 'diet'
    return
  }

  if (stage.value === 'diet') {
    stage.value = 'summary'
    return
  }

  finish()
}

function goBack() {
  switch (stage.value) {
    case 'symptom':
      stage.value = 'htn'
      break
    case 'basic':
      stage.value = draft.htnStatus === 'unsure' ? 'symptom' : 'htn'
      break
    case 'diet':
      stage.value = 'basic'
      break
    case 'summary':
      stage.value = 'diet'
      break
    default:
      break
  }
}

function jumpGroup(groupIndex: number) {
  // 只允许回到已完成的步骤组
  if (groupIndex >= currentGroup.value) return
  const target = GROUP_ENTRY_STAGE[groupIndex]
  if (target) stage.value = target
}

async function skip() {
  // “先随便看看”：用默认画像直接完成引导
  try {
    await profileStore.completeOnboarding({})
  } catch {
    ElMessage.error('网络好像不太顺，暂时没能保存，请稍后再试')
    return
  }
  router.replace('/')
}

async function finish() {
  const weightKg = toNumber(draft.weightKg)
  const payload = {
    name: draft.name.trim(),
    age: toNumber(draft.age),
    gender: draft.gender,
    heightCm: toNumber(draft.heightCm),
    weightKg: weightKg !== null ? Math.round(weightKg * 10) / 10 : null,
    occupation: draft.occupation,
    activity: draft.activity,
    dental: draft.dental,
    taste: draft.taste,
    staplePref: draft.staplePref,
    eatOutFreq: draft.eatOutFreq,
    smoke: draft.smoke,
    drink: draft.drink,
    allergies: [...draft.allergies],
    htnStatus: draft.htnStatus,
    renalKRestriction: draft.renalKRestriction,
    htnDetail: {
      duration: draft.htnDetail.duration,
      medicated: !!draft.htnDetail.medicated,
      symptoms: [...draft.htnDetail.symptoms],
      factors: [...draft.htnDetail.factors],
      redFlags: [...draft.htnDetail.redFlags],
      assessedAt: draft.htnDetail.assessedAt,
      // 只保留文件名与类型，绝不带文件内容
      records: draft.htnDetail.records.map((record) => ({
        name: record.name,
        type: record.type,
      })),
    },
  }
  try {
    await profileStore.completeOnboarding(payload)
  } catch {
    ElMessage.error('网络好像不太顺，问卷暂时没能保存，请稍后再试')
    return
  }
  ElMessage.success('都填好啦，开始看看今天吃什么')
  router.replace('/')
}

const privacyTitle = USE_MOCK
  ? '您填写的信息只保存在这台电脑上，用于让建议更合您的情况'
  : '您填写的健康信息将加密存储，仅用于生成个性化饮食建议'
</script>

<template>
  <div class="onboarding-page">
    <div class="onboarding-card">
      <header class="onboarding-card__header">
        <div class="onboarding-card__skip-row">
          <button type="button" class="skip-button" @click="skip">先随便看看</button>
        </div>
        <StepIndicator :steps="STEP_LABELS" :current="currentGroup" @select="jumpGroup" />
      </header>

      <el-alert
        v-if="currentGroup === 0"
        class="privacy-alert"
        type="info"
        :closable="false"
        show-icon
        :title="privacyTitle"
      />

      <main class="onboarding-card__body">
        <component :is="stageComponent" />
      </main>

      <footer class="onboarding-card__footer">
        <button v-if="showBack" type="button" class="nav-button nav-button--back" @click="goBack">
          上一步
        </button>
        <span v-else aria-hidden="true" />
        <button type="button" class="nav-button nav-button--next" @click="goNext">
          {{ nextLabel }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.onboarding-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--space-xl);
  background-color: var(--color-bg);
}

.onboarding-card {
  width: 100%;
  max-width: 760px;
  padding: clamp(28px, 4vw, 36px);
  background-color: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.onboarding-card__header {
  margin-bottom: var(--space-lg);
}

.onboarding-card__skip-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-sm);
}

.skip-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 var(--space-sm);
  font-family: inherit;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  background: none;
  border: none;
  cursor: pointer;
}

.skip-button:hover {
  color: var(--color-text);
  text-decoration: underline;
}

.privacy-alert {
  margin-bottom: var(--space-xl);
  background-color: #f7f1e4;
  border: 1px solid #e7dcc4;
  border-radius: var(--radius-md);
}

.privacy-alert :deep(.el-alert__content) {
  font-size: var(--font-size-sm);
  line-height: var(--line-height-base);
  color: #5f5746;
}

.privacy-alert :deep(.el-alert__icon) {
  color: #9a7f3c;
}

.onboarding-card__body {
  margin-bottom: var(--space-xl);
}

.onboarding-card__body .q-title {
  margin: 0 0 var(--space-lg);
  font-size: var(--font-size-lg);
  font-weight: 700;
  line-height: 1.45;
  color: var(--color-text);
}

.onboarding-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
  padding-top: var(--space-lg);
  border-top: 1px solid var(--color-border);
}

.nav-button {
  min-height: var(--control-height);
  padding: 0 36px;
  font-family: inherit;
  font-size: var(--font-size-base);
  font-weight: 600;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.nav-button--back {
  color: var(--color-text-secondary);
  background: none;
  border: 2px solid var(--color-border);
}

.nav-button--back:hover {
  color: var(--color-text);
  border-color: var(--color-text-secondary);
}

.nav-button--next {
  color: var(--color-text-inverse);
  background-color: var(--color-primary);
  border: 2px solid var(--color-primary);
}

.nav-button--next:hover {
  background-color: var(--color-primary-dark);
  border-color: var(--color-primary-dark);
}

@media (max-width: 600px) {
  .onboarding-page {
    padding: var(--space-md);
  }

  .nav-button {
    padding: 0 var(--space-xl);
  }
}
</style>
