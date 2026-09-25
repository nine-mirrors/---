<script setup lang="ts">
import { ref } from 'vue'
import { Check, Plus } from '@element-plus/icons-vue'
import { DENTAL_OPTIONS, TASTE_OPTIONS } from '@/constants/dict'
import { COMMON_ALLERGY_TAGS, FREQ_OPTIONS, STAPLE_PREFS, YESNO } from '@/constants/onboarding'
import ChoiceGroup from './ChoiceGroup.vue'
import { useDraft } from './useDraft'

const draft = useDraft()
const allergyInput = ref('')

// 问题一：医生有没有让限钾（三态：有 / 没有 / 不清楚）
const RENAL_OPTIONS: { value: 'yes' | 'no' | 'unsure'; label: string; description: string }[] = [
  { value: 'yes', label: '让限钾了', description: '医生明确说过要少吃高钾食物' },
  { value: 'no', label: '没让限钾', description: '肾功能正常，医生没有这方面交代' },
  { value: 'unsure', label: '不清楚', description: '没查过或不太确定' },
]

// 历史草稿只有合并值 true/false/null，进入页面时按它给医生问题预选
const renalDoctor = ref<'yes' | 'no' | 'unsure'>(
  draft.renalKRestriction === true ? 'yes' : draft.renalKRestriction === false ? 'no' : 'unsure',
)
// 问题二：独立勾选项“我在用低钠盐（氯化钾盐）”
const lowSodiumSalt = ref(false)

// 两个问题在组件内合并回现有字段：任一为是 → true；医生明确说没有且未用低钠盐 → false；否则 null
// （不改 store / healthAssess，只在组件产出值层合并）
function syncRenal() {
  if (lowSodiumSalt.value || renalDoctor.value === 'yes') {
    draft.renalKRestriction = true
  } else if (renalDoctor.value === 'no') {
    draft.renalKRestriction = false
  } else {
    draft.renalKRestriction = null
  }
}

function chooseRenal(value: 'yes' | 'no' | 'unsure') {
  renalDoctor.value = value
  syncRenal()
}

function toggleLowSodiumSalt() {
  lowSodiumSalt.value = !lowSodiumSalt.value
  syncRenal()
}

function addAllergy() {
  const value = allergyInput.value.trim()
  if (!value) return
  const exists = draft.allergies.some((item: string) => item.toLowerCase() === value.toLowerCase())
  if (!exists) draft.allergies.push(value)
  allergyInput.value = ''
}

function removeAllergy(value: string) {
  const index = draft.allergies.indexOf(value)
  if (index >= 0) draft.allergies.splice(index, 1)
}

// 常见忌口/过敏大字 chips：点一下加入，再点一下取消
function hasAllergyTag(name: string): boolean {
  return draft.allergies.some((item: string) => item.toLowerCase() === name.toLowerCase())
}

function toggleCommonAllergy(name: string) {
  const index = draft.allergies.findIndex(
    (item: string) => item.toLowerCase() === name.toLowerCase(),
  )
  if (index >= 0) {
    draft.allergies.splice(index, 1)
  } else {
    draft.allergies.push(name)
  }
}
</script>

<template>
  <div class="diet-step">
    <h2 class="q-title">再聊聊平时怎么吃、有什么习惯</h2>

    <section class="diet-field">
      <p class="field-label">牙口怎么样？</p>
      <ChoiceGroup v-model="draft.dental" :options="DENTAL_OPTIONS" :columns="3" />
    </section>

    <section class="diet-field">
      <p class="field-label">平时口味偏淡还是偏重？</p>
      <ChoiceGroup v-model="draft.taste" :options="TASTE_OPTIONS" :columns="3" />
    </section>

    <section class="diet-field">
      <p class="field-label">主食更喜欢怎么吃？</p>
      <ChoiceGroup v-model="draft.staplePref" :options="STAPLE_PREFS" :columns="3" />
    </section>

    <section class="diet-field">
      <p class="field-label">外出就餐或点外卖多吗？</p>
      <ChoiceGroup v-model="draft.eatOutFreq" :options="FREQ_OPTIONS" :columns="3" />
    </section>

    <!-- 问题一：医生有没有让限钾 / 少吃高钾食物 -->
    <section class="diet-field renal-field">
      <p class="field-label">医生有没有让您限制钾、少吃高钾食物（比如肾功能不好）？</p>
      <div class="renal-options">
        <button
          v-for="item in RENAL_OPTIONS"
          :key="item.value"
          type="button"
          class="renal-btn"
          :class="{ 'is-selected': renalDoctor === item.value }"
          :aria-pressed="renalDoctor === item.value"
          @click="chooseRenal(item.value)"
        >
          <span class="renal-btn__label">{{ item.label }}</span>
          <span class="renal-btn__desc">{{ item.description }}</span>
        </button>
      </div>

      <!-- 问题二：独立勾选“我在用低钠盐（氯化钾盐）” -->
      <button
        type="button"
        class="lowsalt-check"
        :class="{ 'is-checked': lowSodiumSalt }"
        :aria-pressed="lowSodiumSalt"
        @click="toggleLowSodiumSalt"
      >
        <span class="lowsalt-check__box" aria-hidden="true">
          <el-icon v-if="lowSodiumSalt"><Check /></el-icon>
        </span>
        <span class="lowsalt-check__label">我在用低钠盐（氯化钾盐）</span>
      </button>

      <p class="renal-hint">
        医生让限钾，或家里在用低钠盐（氯化钾盐），建议里都会避开富钾食物和钾盐；具体能吃多少请遵医嘱。
      </p>
    </section>

    <div class="two-col">
      <section class="diet-field">
        <p class="field-label">抽烟吗？</p>
        <ChoiceGroup v-model="draft.smoke" :options="YESNO" :columns="2" />
      </section>
      <section class="diet-field">
        <p class="field-label">喝酒吗？</p>
        <ChoiceGroup v-model="draft.drink" :options="YESNO" :columns="2" />
      </section>
    </div>

    <section class="diet-field">
      <p class="field-label">有什么忌口或过敏吗？（比如花生、海鲜，没有可以不填）</p>
      <div class="allergy-row">
        <el-input
          v-model="allergyInput"
          class="big-input allergy-input"
          placeholder="输入后点“添加”，或直接按回车"
          @keydown.enter.prevent="addAllergy"
        />
        <button type="button" class="allergy-add" @click="addAllergy">
          <el-icon aria-hidden="true"><Plus /></el-icon>
          添加
        </button>
      </div>
      <!-- 常见忌口/过敏：大字 chips，点一下加上、再点一下取消 -->
      <p class="allergy-quick-label">常见的，点一下就加上（再点一下取消）</p>
      <div class="allergy-quick">
        <button
          v-for="name in COMMON_ALLERGY_TAGS"
          :key="name"
          type="button"
          class="allergy-quick__chip"
          :class="{ 'is-active': hasAllergyTag(name) }"
          :aria-pressed="hasAllergyTag(name)"
          @click="toggleCommonAllergy(name)"
        >
          {{ name }}
        </button>
      </div>
      <div v-if="draft.allergies.length" class="allergy-tags">
        <el-tag
          v-for="item in draft.allergies"
          :key="item"
          size="large"
          closable
          disable-transitions
          class="allergy-tag"
          @close="removeAllergy(item)"
        >
          {{ item }}
        </el-tag>
      </div>
    </section>
  </div>
</template>

<style scoped>
.diet-field {
  margin-bottom: var(--space-xl);
}

.field-label {
  margin: 0 0 var(--space-md);
  font-size: 1.05rem;
  font-weight: 600;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-xl);
}

/* 控钾三选一 */
.renal-field {
  padding: var(--space-lg);
  background-color: color-mix(in srgb, var(--color-warning) 6%, var(--color-bg-card));
  border: 1px solid color-mix(in srgb, var(--color-warning) 30%, var(--color-border));
  border-radius: var(--radius-md);
}

.renal-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-md);
}

.renal-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-xs);
  min-height: var(--control-height);
  padding: var(--space-md) var(--space-lg);
  font-family: inherit;
  color: var(--color-text);
  background-color: var(--color-bg-card);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.renal-btn:hover {
  border-color: var(--color-warning);
}

.renal-btn.is-selected {
  font-weight: 600;
  color: var(--color-text);
  background-color: color-mix(in srgb, var(--color-warning) 14%, var(--color-bg-card));
  border-color: var(--color-warning);
}

.renal-btn__label {
  font-size: var(--font-size-base);
  font-weight: 600;
}

.renal-btn__desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-base);
}

.renal-hint {
  margin: var(--space-md) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-base);
}

/* 独立勾选：我在用低钠盐（氯化钾盐） */
.lowsalt-check {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  width: 100%;
  min-height: 56px;
  margin-top: var(--space-md);
  padding: var(--space-sm) var(--space-lg);
  font-family: inherit;
  color: var(--color-text);
  background-color: var(--color-bg-card);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.lowsalt-check:hover {
  border-color: var(--color-warning);
}

.lowsalt-check.is-checked {
  background-color: color-mix(in srgb, var(--color-warning) 14%, var(--color-bg-card));
  border-color: var(--color-warning);
}

.lowsalt-check__box {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text-inverse);
  background-color: var(--color-bg-card);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.lowsalt-check.is-checked .lowsalt-check__box {
  background-color: var(--color-warning);
  border-color: var(--color-warning);
}

.lowsalt-check__label {
  font-size: var(--font-size-base);
  font-weight: 600;
  line-height: var(--line-height-base);
}

.allergy-row {
  display: flex;
  gap: var(--space-md);
}

.allergy-input {
  flex: 1;
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

.allergy-add {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  min-height: var(--control-height);
  padding: 0 var(--space-xl);
  font-family: inherit;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-primary-dark);
  background-color: color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-card));
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.allergy-add:hover {
  background-color: color-mix(in srgb, var(--color-primary) 16%, var(--color-bg-card));
}

.allergy-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-top: var(--space-md);
}

/* 常见忌口/过敏大字 chips */
.allergy-quick-label {
  margin: var(--space-md) 0 var(--space-sm);
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text);
}

.allergy-quick {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.allergy-quick__chip {
  min-height: 48px;
  padding: 0 var(--space-lg);
  font-family: inherit;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-primary-dark);
  background-color: var(--color-bg-card);
  border: 2px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
  border-radius: 999px;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
}

.allergy-quick__chip:hover {
  border-color: var(--color-primary);
}

.allergy-quick__chip.is-active {
  color: var(--color-text-inverse);
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

.allergy-tag {
  font-size: var(--font-size-base);
  border-radius: var(--radius-sm);
}

@media (max-width: 600px) {
  .two-col {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .renal-options {
    grid-template-columns: 1fr;
  }
}
</style>
