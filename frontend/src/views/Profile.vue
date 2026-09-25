<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowRight, Cellphone, TrendCharts } from '@element-plus/icons-vue'
import { useProfileStore } from '@/stores/profile'
import { useAuthStore } from '@/stores/auth'
import { bmiOf } from '@/utils/healthAssess'
import { bmiHintText } from './profile/assessmentText'
import AssessmentSummaryCard from './profile/AssessmentSummaryCard.vue'
import ProfileFormCard from './profile/ProfileFormCard.vue'
import BpRecordsCard from './profile/BpRecordsCard.vue'
import MedicationCard from './profile/MedicationCard.vue'
import DangerZone from './profile/DangerZone.vue'
import type { HtnDetail } from '@/types'

const router = useRouter()
const profileStore = useProfileStore()
const auth = useAuthStore()

/** 表单初始值：从 store 画像拷贝，保存前仅本地编辑 */
function buildForm() {
  const p = profileStore.profile
  return {
    name: p.name ?? '',
    age: p.age ?? null,
    gender: p.gender ?? '',
    heightCm: p.heightCm ?? null,
    weightKg: p.weightKg ?? null,
    occupation: p.occupation ?? '',
    activity: p.activity ?? 'low',
    dental: p.dental ?? '好',
    taste: p.taste ?? '一般',
    staplePref: p.staplePref ?? '',
    eatOutFreq: p.eatOutFreq ?? '',
    smoke: p.smoke ?? '否',
    drink: p.drink ?? '否',
    allergies: Array.isArray(p.allergies) ? [...p.allergies] : [],
    // R2.2：控钾三态，null=不清楚
    renalKRestriction: p.renalKRestriction ?? null,
    // 紧急联系人（急症时一键拨打）
    emergencyContactName: p.emergencyContactName ?? '',
    emergencyContactPhone: p.emergencyContactPhone ?? '',
    // 病史明细（含规律服药 medicated），保存时整体合并
    htnDetail: (p.htnDetail ? { ...p.htnDetail } : null) as HtnDetail | null,
  }
}

const form = reactive(buildForm())

// 身高体重编辑时，指标卡实时联动
const liveBmi = computed(() => bmiOf(form.heightCm, form.weightKg))
const liveProtein = computed(() => {
  const weight = Number(form.weightKg)
  if (!weight) return null
  return Math.round(weight * 1.2 * 10) / 10
})
const liveBmiHint = computed(() => bmiHintText(liveBmi.value))
const welcomeName = computed(() => auth.user?.name || '朋友')
const userPhone = computed(() => auth.user?.phone)
// 手机号脱敏展示：138****0006，让长辈确认当前登录的是哪个账号
const maskedPhone = computed(() => {
  const phone = auth.user?.phone
  if (!phone || phone.length !== 11) return phone ?? ''
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
})

async function handleSave() {
  try {
    await profileStore.updateProfile({
      ...form,
      allergies: [...form.allergies],
      htnDetail: form.htnDetail ? { ...form.htnDetail } : null,
    })
  } catch {
    ElMessage.error('网络好像不太顺，暂时没能保存，请稍后再试')
    return
  }
  ElMessage.success('已保存')
}
</script>

<template>
  <div class="page-container profile-page">
    <header class="profile-header">
      <h1 class="profile-header__title">我的</h1>
      <p class="profile-header__welcome">你好，{{ welcomeName }}</p>
      <p v-if="maskedPhone" class="profile-header__account">当前账号 {{ maskedPhone }}</p>
    </header>

    <AssessmentSummaryCard :profile="profileStore.profile" />

    <div class="metric-grid">
      <article class="nd-card metric-mini">
        <h2 class="metric-mini__label">体重指数（BMI）</h2>
        <p class="metric-mini__value">
          {{ liveBmi ?? '—' }}
        </p>
        <p class="metric-mini__hint">{{ liveBmiHint }}</p>
      </article>
      <article class="nd-card metric-mini">
        <h2 class="metric-mini__label">每日蛋白质目标</h2>
        <p class="metric-mini__value">
          {{ liveProtein != null ? liveProtein : '—' }}
          <span v-if="liveProtein != null" class="metric-mini__unit">g/天</span>
        </p>
        <p class="metric-mini__hint">约等于一蛋一奶一掌肉</p>
      </article>
    </div>

    <ProfileFormCard
      v-model="form"
      :phone="userPhone"
      :profile="profileStore.profile"
      @save="handleSave"
    />

    <MedicationCard />

    <BpRecordsCard />

    <nav class="entry-grid" aria-label="快捷入口">
      <button
        type="button"
        class="nd-card nd-card-interactive entry-card"
        @click="router.push('/devices')"
      >
        <span class="entry-card__icon" aria-hidden="true">
          <el-icon><Cellphone /></el-icon>
        </span>
        <span class="entry-card__name">我的设备</span>
        <el-icon class="entry-card__arrow" aria-hidden="true"><ArrowRight /></el-icon>
      </button>
      <button
        type="button"
        class="nd-card nd-card-interactive entry-card"
        @click="router.push('/health')"
      >
        <span class="entry-card__icon entry-card__icon--health" aria-hidden="true">
          <el-icon><TrendCharts /></el-icon>
        </span>
        <span class="entry-card__name">健康数据</span>
        <el-icon class="entry-card__arrow" aria-hidden="true"><ArrowRight /></el-icon>
      </button>
    </nav>

    <DangerZone />
  </div>
</template>

<style scoped>
.profile-page {
  display: flex;
  flex-direction: column;
  /* 桌面/宽屏卡片之间留 32px 呼吸感（手机窄屏仍取 24px，避免一屏卡片过少） */
  gap: 32px;
}

@media (max-width: 480px) {
  .profile-page {
    gap: var(--space-xl);
  }
}

.profile-header__title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-text);
}

.profile-header__welcome {
  margin: var(--space-xs) 0 0;
  font-size: 1rem;
  color: var(--color-text-secondary);
}

.profile-header__account {
  margin: 2px 0 0;
  font-size: 0.95rem;
  color: var(--color-text-secondary);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-md);
}

.metric-mini {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.metric-mini__label {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.metric-mini__value {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 700;
  line-height: 1.25;
  color: var(--color-text);
}

.metric-mini__unit {
  margin-left: 2px;
  font-size: 0.95rem;
  font-weight: 400;
  color: var(--color-text-secondary);
}

.metric-mini__hint {
  margin: 0;
  font-size: 0.95rem;
  line-height: var(--line-height-base);
  color: var(--color-text-secondary);
}

.entry-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-md);
  margin: 0;
  padding: 0;
}

.entry-card {
  display: flex;
  gap: var(--space-md);
  align-items: center;
  width: 100%;
  min-height: 76px;
  padding: var(--space-lg);
  font-family: inherit;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text);
  text-align: left;
  border-radius: var(--radius-lg);
}

.entry-card__icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  font-size: 1.4rem;
  color: var(--color-primary);
  background-color: color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-card));
  border-radius: 50%;
}

.entry-card__icon--health {
  color: var(--color-primary-dark);
}

.entry-card__name {
  flex: 1;
}

.entry-card__arrow {
  flex-shrink: 0;
  font-size: 1.1rem;
  color: var(--color-text-secondary);
}

@media (max-width: 767px) {
  .metric-grid,
  .entry-grid {
    grid-template-columns: 1fr;
  }
}
</style>
