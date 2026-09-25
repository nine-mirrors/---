<script setup lang="ts">
import { computed } from 'vue'
import { Check, Warning, InfoFilled } from '@element-plus/icons-vue'
import { assessHypertension, buildOnboardingSummary } from '@/utils/healthAssess'
import { BP_THRESHOLDS, ELDER_AGE } from '@/constants/dict'
import { useDraft } from './useDraft'

const draft = useDraft()

const summary = computed(() => buildOnboardingSummary(draft))

const assessment = computed(() =>
  assessHypertension({
    symptoms: draft.htnDetail.symptoms,
    factors: draft.htnDetail.factors,
    redFlags: draft.htnDetail.redFlags,
  }),
)

const seekCare = computed(() => assessment.value.seekCare)

const BMI_SHORT_LABEL: Record<string, string> = {
  underweight: '偏瘦',
  normal: '正常',
  overweight: '偏胖',
  obese: '胖',
}

const bmiKey = computed(() => {
  const bmi = summary.value.bmi
  if (!bmi) return ''
  if (bmi < 18.5) return 'underweight'
  if (bmi < 24) return 'normal'
  if (bmi < 28) return 'overweight'
  return 'obese'
})

// 血压结论：confirmed/none 给固定口语文案；风险档展示评估原文（红旗时避免重复，用小结文案）
const bpConclusion = computed(() => {
  if (draft.htnStatus === 'confirmed') return '您有高血压，饮食上重点控盐'
  if (draft.htnStatus === 'none') return '目前没有高血压趋势，保持住'
  if (seekCare.value) return summary.value.htnConclusionText
  if (draft.htnStatus === 'mild_risk' || draft.htnStatus === 'high_risk') {
    return assessment.value.advice
  }
  return summary.value.htnConclusionText
})

// 是否需要显示“别自行停药”
const showMedicationWarning = computed(
  () => draft.htnStatus === 'confirmed' && draft.htnDetail.medicated === true,
)

// 是否显示高龄目标遵医嘱
const showElderAdvice = computed(() => {
  const age = Number(draft.age)
  return Number.isFinite(age) && age >= ELDER_AGE
})

/**
 * 是否显示控钾/低钠盐提醒。
 * 注意：draft.renalKRestriction 是合并口径——"医生明确让限钾"与"仅勾选正在使用低钠盐"
 * （DietHabitStep 的 lowSodiumSalt + unsure）都会合并成 true，本页无法区分两种情形
 * （独立字段未上送 draft，相关文件不在可改范围）。因此文案必须中性包容，
 * 不能武断说"您肾不好"。
 */
const showRenalAdvice = computed(() => draft.renalKRestriction === true)
</script>

<template>
  <div class="summary-step">
    <h2 class="q-title">您的健康小结</h2>

    <div v-if="seekCare" class="urgent-card">
      <p class="urgent-card__title">
        <el-icon aria-hidden="true"><Warning /></el-icon>
        您勾选了需要尽快处理的情况
      </p>
      <p class="urgent-card__text">{{ assessment.advice }}</p>
      <p class="urgent-card__action">请尽快线下就医或拨打 120</p>
    </div>

    <div class="summary-grid">
      <section class="summary-block summary-block--bmi">
        <p class="summary-block__label">体质指数 BMI</p>
        <template v-if="summary.bmi">
          <p class="summary-block__bignum">
            {{ summary.bmi }}
            <span class="summary-block__unit">· {{ BMI_SHORT_LABEL[bmiKey] }}</span>
          </p>
        </template>
        <p v-else class="summary-block__bignum summary-block__bignum--empty">—</p>
        <p class="summary-block__hint">{{ summary.bmiText }}</p>
      </section>

      <section class="summary-block summary-block--protein">
        <p class="summary-block__label">每天蛋白质目标</p>
        <p class="summary-block__bignum">
          {{ summary.proteinTarget || '—' }}
          <span class="summary-block__unit">克/天</span>
        </p>
        <p class="summary-block__hint">大约一个鸡蛋+一杯奶+一掌大的肉</p>
      </section>
    </div>

    <section class="summary-block summary-block--bp">
      <p class="summary-block__label">血压情况</p>
      <p class="summary-block__conclusion">{{ bpConclusion }}</p>
    </section>

    <!-- 家庭血压 135/85 科普 -->
    <section class="info-block">
      <p class="info-block__title">
        <el-icon aria-hidden="true"><InfoFilled /></el-icon>
        家庭测压小知识
      </p>
      <p class="info-block__text">
        在家量血压，{{ BP_THRESHOLDS.home.sys }}/{{ BP_THRESHOLDS.home.dia }} 及以上就算偏高，
        比医院的 140/90 标准更严格一些。建议每天早起后、睡前各量一次，量前先静坐 5 分钟。
      </p>
    </section>

    <!-- 别自行停药 -->
    <section v-if="showMedicationWarning" class="info-block info-block--warning">
      <p class="info-block__title">
        <el-icon aria-hidden="true"><Warning /></el-icon>
        用药提醒
      </p>
      <p class="info-block__text">
        降压药要按时吃，<strong>别自己停药或减药</strong>。觉得血压稳了想调，先问问医生。
      </p>
    </section>

    <!-- 控钾/低钠盐建议（合并口径：医生限钾 或 仅使用低钠盐，文案不武断说肾不好） -->
    <section v-if="showRenalAdvice" class="info-block info-block--renal">
      <p class="info-block__title">
        <el-icon aria-hidden="true"><InfoFilled /></el-icon>
        控钾 / 低钠盐提醒
      </p>
      <p class="info-block__text">
        您勾选了医生让限钾，或正在使用低钠盐（氯化钾盐）。这两种情况下，
        <strong>富钾食物（如香蕉、橙子、菠菜）和低钠盐先问医生再吃</strong>，
        没查过肾功能的话建议体检查一个；盐可以用普通盐，只是总量要少。
      </p>
    </section>

    <!-- 高龄目标遵医嘱 -->
    <section v-if="showElderAdvice" class="info-block">
      <p class="info-block__title">
        <el-icon aria-hidden="true"><InfoFilled /></el-icon>
        给高龄朋友的话
      </p>
      <p class="info-block__text">
        您的年龄较高，血压控制目标可以和医生商量后再定，<strong>不一定非要降到 130/80</strong>，
        避免降得太低引起头晕。饮食清淡、按时吃药、定期复查就好。
      </p>
    </section>

    <section class="summary-block">
      <p class="summary-block__label">给您的 3 条小建议</p>
      <ul class="tip-list list-unstyled">
        <li v-for="tip in summary.tips" :key="tip" class="tip-list__item">
          <span class="tip-list__check" aria-hidden="true">
            <el-icon><Check /></el-icon>
          </span>
          <span>{{ tip }}</span>
        </li>
      </ul>
    </section>

    <p class="disclaimer">以上建议不能代替医生诊断</p>
  </div>
</template>

<style scoped>
.urgent-card {
  margin-bottom: var(--space-xl);
  padding: var(--space-lg) var(--space-xl);
  background-color: color-mix(in srgb, var(--color-danger) 7%, var(--color-bg-card));
  border: 2px solid var(--color-danger);
  border-radius: var(--radius-md);
}

.urgent-card__title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0 0 var(--space-sm);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-danger);
}

.urgent-card__text {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  color: var(--color-text);
}

.urgent-card__action {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-danger);
}

.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.summary-block {
  padding: var(--space-lg) var(--space-xl);
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.summary-grid + .summary-block {
  margin-bottom: var(--space-md);
}

.summary-block:last-of-type {
  margin-bottom: 0;
}

.summary-block--bmi,
.summary-block--protein {
  background-color: color-mix(in srgb, var(--color-primary) 7%, var(--color-bg-card));
  border-color: color-mix(in srgb, var(--color-primary) 25%, var(--color-border));
}

.summary-block__label {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.summary-block__bignum {
  margin: 0 0 var(--space-xs);
  font-size: var(--font-size-xxl);
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-primary-dark);
}

.summary-block__bignum--empty {
  color: var(--color-text-secondary);
}

.summary-block__unit {
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.summary-block__hint {
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-base);
  color: var(--color-text-secondary);
}

.summary-block__conclusion {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  line-height: var(--line-height-base);
  color: var(--color-text);
}

/* 科普/提醒信息块 */
.info-block {
  margin-bottom: var(--space-md);
  padding: var(--space-lg) var(--space-xl);
  background-color: color-mix(in srgb, var(--color-primary) 5%, var(--color-bg-card));
  border: 1px solid color-mix(in srgb, var(--color-primary) 20%, var(--color-border));
  border-radius: var(--radius-md);
}

.info-block--warning {
  background-color: color-mix(in srgb, var(--color-warning) 8%, var(--color-bg-card));
  border-color: color-mix(in srgb, var(--color-warning) 40%, var(--color-border));
}

.info-block--renal {
  background-color: color-mix(in srgb, var(--color-warning) 10%, var(--color-bg-card));
  border-color: color-mix(in srgb, var(--color-warning) 50%, var(--color-border));
}

.info-block__title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0 0 var(--space-sm);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-primary-dark);
}

.info-block--warning .info-block__title {
  color: var(--color-warning-strong);
}

.info-block--renal .info-block__title {
  color: var(--color-warning-strong);
}

.info-block__text {
  margin: 0;
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  color: var(--color-text);
}

.info-block__text strong {
  font-weight: 700;
  color: var(--color-text);
}

.tip-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.tip-list__item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
}

.tip-list__check {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-top: 2px;
  color: var(--color-text-inverse);
  background-color: var(--color-primary);
  border-radius: 50%;
}

.tip-list__check .el-icon {
  font-size: 18px;
}

.disclaimer {
  margin: var(--space-xl) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-align: center;
}

@media (max-width: 600px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
