<script setup lang="ts">
import { Warning } from '@element-plus/icons-vue'
import ChoiceGroup from './ChoiceGroup.vue'
import { RED_FLAGS, RISK_FACTORS, SYMPTOMS } from '@/constants/onboarding'
import { useDraft } from './useDraft'

const draft = useDraft()
</script>

<template>
  <div class="symptom-step">
    <section class="quiz-section">
      <h2 class="q-title">下面这些情况，最近半年您有没有？（可多选）</h2>
      <p class="q-subtitle">不用太琢磨，有印象的就勾上</p>
      <ChoiceGroup v-model="draft.htnDetail.symptoms" :options="SYMPTOMS" :columns="2" multiple />
    </section>

    <section class="quiz-section">
      <h2 class="q-title">再看看这些情况（可多选）</h2>
      <p class="q-subtitle">这些是和血压有关系的生活习惯和身体底子</p>
      <ChoiceGroup
        v-model="draft.htnDetail.factors"
        :options="RISK_FACTORS"
        :columns="2"
        multiple
      />
    </section>

    <section class="red-flag-card">
      <h2 class="red-flag-card__title">
        <el-icon aria-hidden="true"><Warning /></el-icon>
        如果最近出现过下面任何一种情况，请一定勾选
      </h2>
      <ChoiceGroup
        v-model="draft.htnDetail.redFlags"
        :options="RED_FLAGS"
        :columns="1"
        type="danger"
        multiple
      />
    </section>

    <p class="disclaimer">这个小问卷不能代替血压测量和医生诊断</p>
  </div>
</template>

<style scoped>
.quiz-section {
  margin-bottom: var(--space-xl);
}

.q-subtitle {
  margin: -8px 0 var(--space-lg);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.red-flag-card {
  padding: var(--space-lg);
  background-color: color-mix(in srgb, var(--color-danger) 5%, var(--color-bg-card));
  border: 2px solid color-mix(in srgb, var(--color-danger) 45%, var(--color-border));
  border-radius: var(--radius-md);
}

.red-flag-card__title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0 0 var(--space-lg);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-danger);
}

.disclaimer {
  margin: var(--space-lg) 0 0;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  text-align: center;
}
</style>
