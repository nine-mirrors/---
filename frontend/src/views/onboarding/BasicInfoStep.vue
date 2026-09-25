<script setup lang="ts">
import { computed } from 'vue'
import BigOptionButton from '@/components/common/BigOptionButton.vue'
import { ACTIVITY_OPTIONS } from '@/constants/dict'
import { OCCUPATIONS } from '@/constants/onboarding'
import { bmiHint, bmiOf, occupationToActivity } from '@/utils/healthAssess'
import ChoiceGroup from './ChoiceGroup.vue'
import { useDraft } from './useDraft'

const draft = useDraft()

const BMI_SHORT_LABEL: Record<string, string> = {
  underweight: '偏瘦',
  normal: '正常',
  overweight: '偏胖',
  obese: '胖',
}

const bmi = computed(() => bmiOf(draft.heightCm, draft.weightKg))
const bmiKey = computed(() => bmiHint(bmi.value))

function chooseOccupation(value: string) {
  draft.occupation = value
  // 选职业后自动带活动量；“其他”不自动设，留给用户自己选
  const mapped = occupationToActivity(value)
  if (mapped) draft.activity = mapped
}
</script>

<template>
  <div class="basic-step">
    <h2 class="q-title">先认识一下您，建议会更合您的情况</h2>

    <div class="form-grid">
      <label class="field">
        <span class="field__label">怎么称呼您（可不填）</span>
        <el-input v-model="draft.name" class="big-input" placeholder="比如：张阿姨" clearable />
      </label>

      <label class="field">
        <span class="field__label">年龄</span>
        <el-input
          v-model.number="draft.age"
          class="big-input"
          type="number"
          :min="40"
          :max="100"
          placeholder="40–100 岁"
        />
      </label>

      <div class="field">
        <span class="field__label">性别</span>
        <ChoiceGroup v-model="draft.gender" :options="['男', '女']" :columns="2" />
      </div>

      <div class="field field--span2">
        <span class="field__label">身高体重</span>
        <span class="field__hint">体重指数（BMI）反映胖瘦，后面会自动算</span>
        <div class="hw-row">
          <el-input
            v-model.number="draft.heightCm"
            class="big-input hw-input"
            type="number"
            :min="140"
            :max="200"
            placeholder="身高"
          >
            <template #append>cm</template>
          </el-input>
          <el-input
            v-model.number="draft.weightKg"
            class="big-input hw-input"
            type="number"
            :min="30"
            :max="150"
            :step="0.1"
            placeholder="体重"
          >
            <template #append>kg</template>
          </el-input>
          <div class="bmi-readout" :class="{ 'is-ready': bmi }">
            <template v-if="bmi">
              <span class="bmi-readout__num">体重指数 {{ bmi }}</span>
              <span class="bmi-readout__tag">· {{ bmiKey ? BMI_SHORT_LABEL[bmiKey] : '' }}</span>
            </template>
            <span v-else class="bmi-readout__empty">填好身高体重<br />就能看到体重指数</span>
          </div>
        </div>
      </div>
    </div>

    <div class="field">
      <span class="field__label">您现在主要是做什么的？</span>
      <div class="occupation-grid">
        <BigOptionButton
          v-for="item in OCCUPATIONS"
          :key="item.value"
          :label="item.label"
          :model-value="draft.occupation === item.value"
          @click="chooseOccupation(item.value)"
        />
      </div>
    </div>

    <div class="field">
      <span class="field__label">平时活动量怎么样？（选了职业会帮忙带一下，也可以自己改）</span>
      <ChoiceGroup v-model="draft.activity" :options="ACTIVITY_OPTIONS" :columns="3" />
    </div>
  </div>
</template>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-lg) var(--space-xl);
  margin-bottom: var(--space-xl);
}

.field {
  display: flex;
  flex-direction: column;
}

.field--span2 {
  grid-column: span 2;
}

.field__label {
  margin-bottom: var(--space-sm);
  font-size: 1.05rem;
  font-weight: 600;
}

.field__hint {
  margin: calc(var(--space-xs) - var(--space-sm)) 0 var(--space-sm);
  font-size: var(--font-size-sm);
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.basic-step > .field {
  margin-bottom: var(--space-xl);
}

.basic-step > .field:last-child {
  margin-bottom: 0;
}

:deep(.big-input .el-input__wrapper) {
  min-height: var(--control-height);
  padding: 0 var(--space-md);
  font-size: var(--font-size-base);
  border-radius: var(--radius-md);
}

:deep(.big-input .el-input__inner) {
  font-size: var(--font-size-base);
}

:deep(.big-input .el-input-group__append) {
  padding: 0 var(--space-md);
  font-size: var(--font-size-base);
}

.hw-row {
  display: grid;
  grid-template-columns: 1fr 1fr minmax(180px, 1.1fr);
  gap: var(--space-md);
  align-items: stretch;
}

.bmi-readout {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: var(--control-height);
  padding: var(--space-sm) var(--space-md);
  color: var(--color-text-secondary);
  background-color: var(--color-bg);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  text-align: center;
}

.bmi-readout.is-ready {
  color: var(--color-primary-dark);
  background-color: color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-card));
  border: 1px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
}

.bmi-readout__num {
  font-size: var(--font-size-xl);
  font-weight: 700;
}

.bmi-readout__tag {
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.bmi-readout__empty {
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.occupation-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-md);
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .field--span2 {
    grid-column: span 1;
  }

  .hw-row {
    grid-template-columns: 1fr 1fr;
  }

  .bmi-readout {
    grid-column: span 2;
  }

  .occupation-grid {
    grid-template-columns: 1fr;
  }
}
</style>
