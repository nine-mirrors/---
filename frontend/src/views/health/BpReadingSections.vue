<script setup lang="ts">
import { Minus, Plus } from '@element-plus/icons-vue'

// 录入中的单次读数（收缩/舒张均可为空，未填时为 null）
export interface BpReadingInput {
  sys: number | null
  dia: number | null
}

const props = defineProps<{
  // 三次读数：[第一次, 第二次, 第三次]
  readings: [BpReadingInput, BpReadingInput, BpReadingInput]
  hr: number | null
  bpStep: number
  hrStep: number
  // 两次差 >10，控制第三次显示与提示
  diffGt10: boolean
  // 校验文案（空串表示无错误）
  sys1Error: string
  dia1Error: string
  hrError: string
  // 低心率灰字提示
  hrLow: boolean
}>()

const emit = defineEmits<{
  'update:readings': [readings: [BpReadingInput, BpReadingInput, BpReadingInput]]
  'update:hr': [hr: number | null]
}>()

// —— 数值归一：输入清空/非数字时统一当空值 ——
function num(v: number | null): number | null {
  if (v == null || !Number.isFinite(v)) return null
  return v
}

// —— 步进 ——
function step(value: number | null, delta: number, min: number, max: number): number {
  const base = num(value) ?? min
  return Math.min(max, Math.max(min, base + delta))
}

// 更新某次读数的某字段
function updateReading(index: number, field: 'sys' | 'dia', value: number | null) {
  const next = props.readings.map((r, i) => (i === index ? { ...r, [field]: value } : r)) as [
    BpReadingInput,
    BpReadingInput,
    BpReadingInput,
  ]
  emit('update:readings', next)
}

function stepSys(index: number, delta: number) {
  updateReading(index, 'sys', step(props.readings[index].sys, delta * props.bpStep, 70, 260))
}

function stepDia(index: number, delta: number) {
  updateReading(index, 'dia', step(props.readings[index].dia, delta * props.bpStep, 40, 160))
}

function stepHr(delta: number) {
  emit('update:hr', step(props.hr, delta * props.hrStep, 40, 150))
}

// 输入框变化：模拟 v-model.number（parseFloat），空串/非数字 -> null
function parseNum(raw: string): number | null {
  if (raw === '') return null
  const n = parseFloat(raw)
  return Number.isNaN(n) ? null : n
}

function onReadingInput(index: number, field: 'sys' | 'dia', e: Event) {
  updateReading(index, field, parseNum((e.target as HTMLInputElement).value))
}

function onHrInput(e: Event) {
  emit('update:hr', parseNum((e.target as HTMLInputElement).value))
}
</script>

<template>
  <!-- 第一次读数 -->
  <div class="bp-form__section">
    <h3 class="bp-form__section-title">第一次</h3>
    <div class="bp-form__row">
      <div class="bp-input">
        <label class="bp-input__label">收缩压</label>
        <div class="bp-input__group">
          <button
            type="button"
            class="bp-input__btn"
            aria-label="收缩压减 2"
            @click="stepSys(0, -1)"
          >
            <el-icon><Minus /></el-icon>
          </button>
          <input
            :value="readings[0].sys"
            type="text"
            inputmode="numeric"
            class="bp-input__field"
            aria-label="收缩压"
            placeholder="120"
            @input="onReadingInput(0, 'sys', $event)"
          />
          <button
            type="button"
            class="bp-input__btn"
            aria-label="收缩压加 2"
            @click="stepSys(0, 1)"
          >
            <el-icon><Plus /></el-icon>
          </button>
        </div>
        <span class="bp-input__unit">mmHg</span>
        <p v-if="sys1Error" class="bp-input__error">{{ sys1Error }}</p>
      </div>

      <div class="bp-input">
        <label class="bp-input__label">舒张压</label>
        <div class="bp-input__group">
          <button
            type="button"
            class="bp-input__btn"
            aria-label="舒张压减 2"
            @click="stepDia(0, -1)"
          >
            <el-icon><Minus /></el-icon>
          </button>
          <input
            :value="readings[0].dia"
            type="text"
            inputmode="numeric"
            class="bp-input__field"
            aria-label="舒张压"
            placeholder="80"
            @input="onReadingInput(0, 'dia', $event)"
          />
          <button
            type="button"
            class="bp-input__btn"
            aria-label="舒张压加 2"
            @click="stepDia(0, 1)"
          >
            <el-icon><Plus /></el-icon>
          </button>
        </div>
        <span class="bp-input__unit">mmHg</span>
        <p v-if="dia1Error" class="bp-input__error">{{ dia1Error }}</p>
      </div>
    </div>

    <!-- 心率 -->
    <div class="bp-form__row">
      <div class="bp-input">
        <label class="bp-input__label">心率 <span class="bp-input__optional">（选填）</span></label>
        <div class="bp-input__group">
          <button type="button" class="bp-input__btn" aria-label="心率减 1" @click="stepHr(-1)">
            <el-icon><Minus /></el-icon>
          </button>
          <input
            :value="hr"
            type="text"
            inputmode="numeric"
            class="bp-input__field"
            aria-label="心率"
            placeholder="—"
            @input="onHrInput($event)"
          />
          <button type="button" class="bp-input__btn" aria-label="心率加 1" @click="stepHr(1)">
            <el-icon><Plus /></el-icon>
          </button>
        </div>
        <span class="bp-input__unit">次/分</span>
        <p v-if="hrError" class="bp-input__error">{{ hrError }}</p>
        <p v-else-if="hrLow" class="bp-input__hint">
          静息心率偏低，要是正在吃洛尔类降压药可能是正常的；若伴有头晕、乏力，记得告诉医生。
        </p>
      </div>
    </div>
  </div>

  <!-- 第二次读数 -->
  <div class="bp-form__section">
    <h3 class="bp-form__section-title">
      第二次
      <span class="bp-form__section-sub">（选填，歇一分钟再测一次，填两次自动取平均）</span>
    </h3>
    <div class="bp-form__row">
      <div class="bp-input">
        <label class="bp-input__label">收缩压</label>
        <div class="bp-input__group">
          <button
            type="button"
            class="bp-input__btn"
            aria-label="第二次收缩压减 2"
            @click="stepSys(1, -1)"
          >
            <el-icon><Minus /></el-icon>
          </button>
          <input
            :value="readings[1].sys"
            type="text"
            inputmode="numeric"
            class="bp-input__field"
            aria-label="第二次收缩压"
            placeholder="—"
            @input="onReadingInput(1, 'sys', $event)"
          />
          <button
            type="button"
            class="bp-input__btn"
            aria-label="第二次收缩压加 2"
            @click="stepSys(1, 1)"
          >
            <el-icon><Plus /></el-icon>
          </button>
        </div>
        <span class="bp-input__unit">mmHg</span>
      </div>
      <div class="bp-input">
        <label class="bp-input__label">舒张压</label>
        <div class="bp-input__group">
          <button
            type="button"
            class="bp-input__btn"
            aria-label="第二次舒张压减 2"
            @click="stepDia(1, -1)"
          >
            <el-icon><Minus /></el-icon>
          </button>
          <input
            :value="readings[1].dia"
            type="text"
            inputmode="numeric"
            class="bp-input__field"
            aria-label="第二次舒张压"
            placeholder="—"
            @input="onReadingInput(1, 'dia', $event)"
          />
          <button
            type="button"
            class="bp-input__btn"
            aria-label="第二次舒张压加 2"
            @click="stepDia(1, 1)"
          >
            <el-icon><Plus /></el-icon>
          </button>
        </div>
        <span class="bp-input__unit">mmHg</span>
      </div>
    </div>

    <p v-if="diffGt10" class="bp-form__warn">两次差得有点多，建议再测第三次。</p>
  </div>

  <!-- 第三次读数 -->
  <div v-if="diffGt10" class="bp-form__section">
    <h3 class="bp-form__section-title">
      第三次 <span class="bp-form__section-sub">（选填，填了取三次平均）</span>
    </h3>
    <div class="bp-form__row">
      <div class="bp-input">
        <label class="bp-input__label">收缩压</label>
        <div class="bp-input__group">
          <button
            type="button"
            class="bp-input__btn"
            aria-label="第三次收缩压减 2"
            @click="stepSys(2, -1)"
          >
            <el-icon><Minus /></el-icon>
          </button>
          <input
            :value="readings[2].sys"
            type="text"
            inputmode="numeric"
            class="bp-input__field"
            aria-label="第三次收缩压"
            placeholder="—"
            @input="onReadingInput(2, 'sys', $event)"
          />
          <button
            type="button"
            class="bp-input__btn"
            aria-label="第三次收缩压加 2"
            @click="stepSys(2, 1)"
          >
            <el-icon><Plus /></el-icon>
          </button>
        </div>
        <span class="bp-input__unit">mmHg</span>
      </div>
      <div class="bp-input">
        <label class="bp-input__label">舒张压</label>
        <div class="bp-input__group">
          <button
            type="button"
            class="bp-input__btn"
            aria-label="第三次舒张压减 2"
            @click="stepDia(2, -1)"
          >
            <el-icon><Minus /></el-icon>
          </button>
          <input
            :value="readings[2].dia"
            type="text"
            inputmode="numeric"
            class="bp-input__field"
            aria-label="第三次舒张压"
            placeholder="—"
            @input="onReadingInput(2, 'dia', $event)"
          />
          <button
            type="button"
            class="bp-input__btn"
            aria-label="第三次舒张压加 2"
            @click="stepDia(2, 1)"
          >
            <el-icon><Plus /></el-icon>
          </button>
        </div>
        <span class="bp-input__unit">mmHg</span>
      </div>
    </div>
  </div>
</template>

<style scoped src="./BpEntryDialog.css"></style>
