<script setup lang="ts">
import { computed } from 'vue'
import BigOptionButton from '@/components/common/BigOptionButton.vue'
import DemoBadge from '@/components/common/DemoBadge.vue'
import { MOODS } from '@/constants/dict'
import { usePremealStore } from '@/stores/premeal'

const premeal = usePremealStore()

// 心率输入与滑块均通过 store action 更新（含 50–150 钳制与持久化）
const heartRateModel = computed({
  get: () => premeal.heartRate,
  set: (value) => premeal.setHeartRate(value),
})

const moodModel = computed({
  get: () => premeal.mood,
  set: (value) => premeal.setMood(value),
})
</script>

<template>
  <section class="premeal-card nd-card" aria-label="餐前状态">
    <header class="premeal-card__head">
      <h2 class="premeal-card__title">餐前状态</h2>
      <DemoBadge text="演示数据" />
    </header>

    <div class="premeal-card__block">
      <label class="premeal-card__label" for="premeal-heart-rate">心率</label>
      <div class="premeal-card__hr-row">
        <el-input-number
          id="premeal-heart-rate"
          v-model="heartRateModel"
          class="premeal-card__hr-input"
          :min="50"
          :max="150"
          :step="1"
          :precision="0"
          :controls="true"
          controls-position="right"
          size="large"
          aria-label="心率，次每分"
        />
        <el-slider
          v-model="heartRateModel"
          class="premeal-card__hr-slider"
          :min="50"
          :max="150"
          :step="1"
          :show-tooltip="false"
          aria-label="心率滑块"
        />
        <span class="premeal-card__hr-unit">次/分</span>
      </div>
    </div>

    <div class="premeal-card__block">
      <span class="premeal-card__label">现在的心情</span>
      <div class="premeal-card__moods" role="group" aria-label="情绪选择">
        <BigOptionButton
          v-for="mood in MOODS"
          :key="mood"
          :label="mood"
          :model-value="moodModel === mood"
          @update:model-value="moodModel = mood"
        />
      </div>
    </div>

    <p class="premeal-card__tip">帮您在饭后提醒得更贴心</p>
  </section>
</template>

<style scoped>
.premeal-card {
  padding: var(--space-xl);
}

.premeal-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.premeal-card__title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-text);
}

.premeal-card__block {
  margin-bottom: var(--space-lg);
}

.premeal-card__block:last-of-type {
  margin-bottom: 0;
}

.premeal-card__label {
  display: block;
  margin-bottom: var(--space-sm);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.premeal-card__hr-row {
  display: grid;
  grid-template-columns: auto minmax(96px, 1fr) auto;
  align-items: center;
  gap: var(--space-md);
}

.premeal-card__hr-input {
  width: 132px;
}

.premeal-card__hr-input :deep(.el-input__inner) {
  font-size: 1.15rem;
  font-weight: 700;
}

.premeal-card__hr-slider {
  min-width: 0;
}

.premeal-card__hr-unit {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-primary-dark);
  white-space: nowrap;
}

.premeal-card__moods {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-sm);
}

/* 侧栏列宽有限：两字情绪词必须横排；选中对勾改为右上角绝对定位，
   不再挤占文字宽度（原布局下"焦虑/疲惫"被压成逐字竖排并与对勾重叠） */
.premeal-card__moods :deep(.big-option-button) {
  position: relative;
  justify-content: center;
  padding: var(--space-md) 6px;
  text-align: center;
}

.premeal-card__moods :deep(.big-option-button__text) {
  align-items: center;
  flex: 0 1 auto;
}

.premeal-card__moods :deep(.big-option-button__label) {
  white-space: nowrap;
}

.premeal-card__moods :deep(.big-option-button__check) {
  position: absolute;
  top: 4px;
  right: 4px;
  margin-left: 0;
  font-size: var(--font-size-base);
}

/* 窄屏手机：四个心情改两行两列，按钮更宽、对勾回到正常流，触控更从容 */
@media (max-width: 430px) {
  .premeal-card__moods {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .premeal-card__moods :deep(.big-option-button) {
    padding: var(--space-md) var(--space-md);
  }

  .premeal-card__moods :deep(.big-option-button__check) {
    position: static;
    margin-left: var(--space-sm);
    font-size: var(--font-size-lg);
  }
}

.premeal-card__tip {
  margin: var(--space-lg) 0 0;
  font-size: 0.95rem;
  color: var(--color-text-secondary);
}

@media (max-width: 420px) {
  .premeal-card__hr-row {
    grid-template-columns: 1fr;
    justify-items: stretch;
  }

  .premeal-card__hr-input {
    width: 100%;
  }
}
</style>
