<script setup lang="ts">
// 手动录入血压弹层（家庭自测口径，适老化）
// - 测量规范灰字（含双臂首测句）+ 高龄脚注
// - 收缩/舒张/hr 大字数字输入 + 大号步进按钮（BP ±2 / hr ±1）
// - 默认带出 bpLog.lastRecord（无则 120/80）
// - 第一次必填；第二次选填（均值，差>10 提示第三测）；第三次选填
// - 范围 70–260 / 40–160（<90/60 偏低可保存）；hr 40–150 可选，<50 灰字不拦截
// - 保存走 bpLog store；保存后黄/橙/红/低四级提示（急症两分支）
// - 弹层焦点陷阱 + Esc（el-dialog 内置）；断连可录

import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useBpLogStore, avgReadings, triageBpLevel } from '@/stores/bpLog'
import { BP_STEP, HR_STEP, HR_REST_LOW } from '@/constants/dict'
import { RED_FLAG_SYMPTOMS, matchRedFlagKeywords } from '@/constants/clinical'
import { classifyBp, isIsolatedLowDiastolic, BP_ISOLATED_LOW_DIA_TEXT } from '@/utils/nutrition'
import { dateStr, formatRelTime } from '@/utils/date'
import type { BpPeriod, BpLevel, BpReading, BpRecord } from '@/types'
import BpReadingSections from './BpReadingSections.vue'
import type { BpReadingInput } from './BpReadingSections.vue'

const props = defineProps<{
  modelValue?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [record: BpRecord]
}>()

const bpLog = useBpLogStore()

// —— 录入状态 ——
// 第一次读数
const sys1 = ref<number | null>(120)
const dia1 = ref<number | null>(80)
const hr = ref<number | null>(null)

// 第二次读数（选填）
const sys2 = ref<number | null>(null)
const dia2 = ref<number | null>(null)

// 第三次读数（选填，仅当两次差>10 时提示填写）
const sys3 = ref<number | null>(null)
const dia3 = ref<number | null>(null)

const period = ref<BpPeriod>('morning')

// 急症红旗症状（仅保存后出现 ≥180/120 时强化提示，勾选不影响 120 按钮）
const redFlags = ref<string[]>([])
// “我没有不舒服”次要分支默认折叠
const showNoDiscomfort = ref(false)

// —— 新字段：臂别（可不选）/ 脉搏是否整齐 / 症状备注 ——
const arm = ref<'left' | 'right' | null>(null)
const pulseRegular = ref<boolean | null>(null)
// 脉搏选项只有显式点选过后才允许出现高亮（初始“没注意”不带 is-active）
const pulseTouched = ref(false)
const symptoms = ref('')
// 红旗症状 chips（存 id，可多选切换）；与手输文本合并去重后写入 symptoms
const selectedSymptomIds = ref<string[]>([])

// —— 旧值防误存：带出上次读数时为 true，改任一读数或心率后置 false ——
const isPrefilled = ref(false)
const prefillLabel = ref('')

// 保存结果
const savedRecord = ref<BpRecord | null>(null)
const saving = ref(false)

// —— 时段默认：中午 12 点前为早起后，之后为睡前 ——
function defaultPeriod(): BpPeriod {
  return new Date().getHours() < 12 ? 'morning' : 'evening'
}

// —— 打开弹层时带出上次读数 ——
async function open() {
  savedRecord.value = null
  redFlags.value = []
  showNoDiscomfort.value = false
  sys2.value = null
  dia2.value = null
  sys3.value = null
  dia3.value = null
  hr.value = null
  period.value = defaultPeriod()
  arm.value = null
  pulseRegular.value = null
  pulseTouched.value = false
  symptoms.value = ''
  selectedSymptomIds.value = []
  isPrefilled.value = false
  prefillLabel.value = ''

  // 确保 records 已加载
  if (!bpLog.loaded) {
    await bpLog.load()
  }
  const last = bpLog.lastRecord()
  if (last) {
    sys1.value = last.sys
    dia1.value = last.dia
    hr.value = last.hr
    // 带出的是旧值：顶部提示防误存，用户改任一读数或心率后消失
    isPrefilled.value = true
    prefillLabel.value = formatRelTime(last.measuredAt, last.period)
  } else {
    sys1.value = 120
    dia1.value = null
  }

  await nextTick()
}

watch(
  () => props.modelValue,
  (openFlag) => {
    if (openFlag) void open()
  },
)

// —— 数值归一：v-model.number 清空输入时会变成 NaN，统一当空值处理 ——
function num(v: number | null): number | null {
  if (v == null || !Number.isFinite(v)) return null
  return v
}

// —— 三次读数（传给 BpReadingSections）——
const readings = computed<[BpReadingInput, BpReadingInput, BpReadingInput]>(() => [
  { sys: sys1.value, dia: dia1.value },
  { sys: sys2.value, dia: dia2.value },
  { sys: sys3.value, dia: dia3.value },
])

function onReadingsUpdate(next: [BpReadingInput, BpReadingInput, BpReadingInput]) {
  // 用户改了读数：带出的旧值已不再是“原数”，撤下防误存提示
  isPrefilled.value = false
  sys1.value = next[0].sys
  dia1.value = next[0].dia
  sys2.value = next[1].sys
  dia2.value = next[1].dia
  sys3.value = next[2].sys
  dia3.value = next[2].dia
}

function onHrUpdate(v: number | null) {
  isPrefilled.value = false
  hr.value = v
}

// 改时段 / 臂别同样说明用户已在操作新一次测量：撤下旧值黄条与防误存按钮文案
function onPeriodChange() {
  isPrefilled.value = false
}

function onArmChange(next: 'left' | 'right') {
  isPrefilled.value = false
  arm.value = arm.value === next ? null : next
}

// 脉搏三选：点过就允许高亮（含显式选“没注意”）
function choosePulseRegular(v: boolean | null) {
  pulseTouched.value = true
  pulseRegular.value = v
}

// 红旗症状 chip 多选切换
function toggleSymptomChip(id: string) {
  const list = selectedSymptomIds.value
  selectedSymptomIds.value = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

const hasSelectedSymptom = computed(() => selectedSymptomIds.value.length > 0)

// —— 收集有效读数 ——
function collectReadings(): BpReading[] {
  const list: BpReading[] = []
  const s1 = num(sys1.value)
  const d1 = num(dia1.value)
  const s2 = num(sys2.value)
  const d2 = num(dia2.value)
  const s3 = num(sys3.value)
  const d3 = num(dia3.value)
  if (s1 != null && d1 != null) list.push({ sys: s1, dia: d1 })
  if (s2 != null && d2 != null) list.push({ sys: s2, dia: d2 })
  if (s3 != null && d3 != null) list.push({ sys: s3, dia: d3 })
  return list
}

// 两次读数差 >10 提示第三测
const diffGt10 = computed(() => {
  const s1 = num(sys1.value)
  const d1 = num(dia1.value)
  const s2 = num(sys2.value)
  const d2 = num(dia2.value)
  if (s1 == null || d1 == null || s2 == null || d2 == null) return false
  const dSys = Math.abs(s1 - s2)
  const dDia = Math.abs(d1 - d2)
  return dSys > 10 || dDia > 10
})

// 校验
const sys1Error = computed(() => {
  const v = num(sys1.value)
  if (v == null) return '请填收缩压'
  if (v < 70 || v > 260) return '收缩压需在 70–260 之间'
  return ''
})
const dia1Error = computed(() => {
  const v = num(dia1.value)
  if (v == null) return '请填舒张压'
  if (v < 40 || v > 160) return '舒张压需在 40–160 之间'
  return ''
})
const hrError = computed(() => {
  const v = num(hr.value)
  if (v == null) return ''
  if (v < 40 || v > 150) return '心率需在 40–150 之间'
  return ''
})

const canSave = computed(() => !sys1Error.value && !dia1Error.value && !hrError.value)

// 真正的低血压分级（与 dict classifyBp 同口径）：SBP<90，或 SBP≥135 伴 DBP<60
const isLow = computed(() => {
  const s = num(sys1.value)
  const d = num(dia1.value)
  if (s == null || d == null) return false
  return classifyBp(s, d) === 'low'
})

// 孤立性低压（高压正常、仅舒张压低）：不给红色警告，只给中性说明
const isIsolatedLow = computed(() => {
  const s = num(sys1.value)
  const d = num(dia1.value)
  if (s == null || d == null) return false
  return isIsolatedLowDiastolic(s, d)
})

// 低心率灰字
const hrLow = computed(() => {
  const v = num(hr.value)
  return v != null && v < HR_REST_LOW
})

// 分级结果：均值分级 + 任一原始读数急症阈值取高者（急症不被均值稀释）
const savedLevel = computed<BpLevel | null>(() => {
  if (!savedRecord.value) return null
  return triageBpLevel(savedRecord.value.readings, savedRecord.value.sys, savedRecord.value.dia)
})

const hasRedFlag = computed(() => redFlags.value.length > 0)

// chips 选中的大白话 label 与手输文本合并去重
function buildSymptomsText(): string {
  const typed = symptoms.value.trim()
  const labels = RED_FLAG_SYMPTOMS.filter((s) => selectedSymptomIds.value.includes(s.id)).map(
    (s) => s.label,
  )
  const parts = [typed, ...labels.filter((label) => !typed.includes(label))].filter(Boolean)
  return Array.from(new Set(parts)).join('；')
}

// —— 保存 ——
async function handleSave() {
  if (!canSave.value) {
    ElMessage.warning('请先把上面的数值填对')
    return
  }
  const validReadings = collectReadings()
  if (!validReadings.length) return

  const { sys: avgSys, dia: avgDia } = avgReadings(validReadings)
  const mergedSymptoms = buildSymptomsText()

  // 症状文本命中红旗关键词、但本次读数（含任一原始读数）未到急症：
  // 先二次确认，避免老人把危险症状当普通备注存下而不求助
  const triageLevel = triageBpLevel(validReadings, avgSys, avgDia)
  if (
    mergedSymptoms &&
    triageLevel !== 'emergency' &&
    matchRedFlagKeywords(mergedSymptoms).length
  ) {
    try {
      await ElMessageBox.confirm(
        '您备注了胸痛/喘憋等危险情况。如果现在人不舒服，请先拨打 120；确定要保存吗？',
        '安全提醒',
        {
          confirmButtonText: '确定保存',
          cancelButtonText: '先不保存',
          type: 'warning',
          // 适老：确认弹窗按钮保持大号可点
          roundButton: true,
        },
      )
    } catch {
      return
    }
  }

  const now = new Date()
  saving.value = true
  try {
    // 统一走 store：内部算均值、调 createBpLog、成功后 unshift 内存记录
    const record = await bpLog.addRecord({
      measuredAt: now.toISOString(),
      date: dateStr(now),
      period: period.value,
      readings: validReadings,
      hr: hr.value ?? null,
      source: 'manual',
      arm: arm.value,
      pulseRegular: pulseRegular.value,
      ...(mergedSymptoms ? { symptoms: mergedSymptoms } : {}),
    })
    savedRecord.value = record
    emit('saved', record)
  } catch {
    ElMessage.error('保存失败了，重试一下')
  } finally {
    saving.value = false
  }
}

function handleClose() {
  emit('update:modelValue', false)
}

// —— 分级提示文案 ——
interface LevelTip {
  tone: 'green' | 'yellow' | 'orange' | 'red' | 'low'
  title: string
  text: string
}

const levelTip = computed<LevelTip | null>(() => {
  const lvl = savedLevel.value
  if (!lvl || !savedRecord.value) return null
  switch (lvl) {
    case 'normal':
      return {
        tone: 'green',
        title: '这次血压挺好',
        text: '继续保持清淡饮食、规律作息和散步。',
      }
    case 'high':
      return {
        tone: 'yellow',
        title: '这次有点高',
        text: '先安静休息 5 分钟再测一次。连续几天都高，记得带着记录找大夫看看。',
      }
    case 'urgent':
      return {
        tone: 'orange',
        title: '这个数值偏高',
        text: '先安静坐着休息 5 分钟再测一次，仍这么高就尽快联系医生或今天去门诊，别自己加药或停药。',
      }
    case 'low':
      return {
        tone: 'low',
        title: '这次血压偏低',
        text: '要是头晕、眼前发黑，先躺下歇会儿、起身慢一点。正在吃降压药的话别自己停药，把数值告诉医生。',
      }
    case 'emergency':
      return {
        tone: 'red',
        title: '血压很高，需要马上处理',
        text: '',
      }
    default:
      return null
  }
})

// 保存记录的相对时间
const savedRelTime = computed(() => {
  if (!savedRecord.value) return ''
  return formatRelTime(savedRecord.value.measuredAt, savedRecord.value.period)
})
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="记一下血压"
    width="min(560px, 94vw)"
    class="bp-entry-dialog"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
    @closed="handleClose"
  >
    <div v-if="!savedRecord" class="bp-form">
      <!-- 旧值防误存：带出的是上次读数，提醒改成刚量的新数 -->
      <p v-if="isPrefilled" class="bp-form__prefill">
        这是{{ prefillLabel }}的 {{ sys1 }}/{{ dia1 }}，今天量完请改成新数字
      </p>

      <!-- 测量规范 -->
      <div class="bp-form__spec">
        <p>先坐下歇 5 分钟，别说话，手臂放在桌上跟胸口齐平；测前 30 分钟别抽烟、喝茶咖啡。</p>
        <p>第一次量建议左右胳膊各量一次，以后量数值高的那只。</p>
      </div>
      <BpReadingSections
        :readings="readings"
        :hr="hr"
        :bp-step="BP_STEP"
        :hr-step="HR_STEP"
        :diff-gt10="diffGt10"
        :sys1-error="sys1Error"
        :dia1-error="dia1Error"
        :hr-error="hrError"
        :hr-low="hrLow"
        @update:readings="onReadingsUpdate"
        @update:hr="onHrUpdate"
      />

      <!-- 时段 -->
      <div class="bp-form__section">
        <h3 class="bp-form__section-title">时段</h3>
        <el-radio-group
          v-model="period"
          size="large"
          class="bp-form__period"
          @change="onPeriodChange"
        >
          <el-radio-button value="morning">早起后</el-radio-button>
          <el-radio-button value="evening">睡前</el-radio-button>
        </el-radio-group>
        <p class="bp-form__period-note">早起后 = 吃药、吃早饭前；睡前 = 晚上洗漱后。</p>
      </div>

      <!-- 臂别（可不选，再点一次可取消） -->
      <div class="bp-form__section">
        <h3 class="bp-form__section-title">
          量的哪只胳膊
          <span class="bp-form__section-sub">（选填，以后固定量数值高的那只）</span>
        </h3>
        <div class="bp-form__seg">
          <button
            type="button"
            class="bp-form__seg-btn"
            :class="{ 'is-active': arm === 'left' }"
            :aria-pressed="arm === 'left'"
            @click="onArmChange('left')"
          >
            左胳膊
          </button>
          <button
            type="button"
            class="bp-form__seg-btn"
            :class="{ 'is-active': arm === 'right' }"
            :aria-pressed="arm === 'right'"
            @click="onArmChange('right')"
          >
            右胳膊
          </button>
        </div>
      </div>

      <!-- 脉搏是否整齐 -->
      <div class="bp-form__section">
        <h3 class="bp-form__section-title">脉搏齐不齐</h3>
        <div class="bp-form__seg bp-form__seg--three">
          <button
            type="button"
            class="bp-form__seg-btn"
            :class="{ 'is-active': pulseTouched && pulseRegular === true }"
            :aria-pressed="pulseTouched && pulseRegular === true"
            @click="choosePulseRegular(true)"
          >
            整齐
          </button>
          <button
            type="button"
            class="bp-form__seg-btn"
            :class="{ 'is-active': pulseTouched && pulseRegular === false }"
            :aria-pressed="pulseTouched && pulseRegular === false"
            @click="choosePulseRegular(false)"
          >
            不整齐
          </button>
          <button
            type="button"
            class="bp-form__seg-btn"
            :class="{ 'is-active': pulseTouched && pulseRegular === null }"
            :aria-pressed="pulseTouched && pulseRegular === null"
            @click="choosePulseRegular(null)"
          >
            没注意
          </button>
        </div>
      </div>

      <!-- 症状备注（选填）：红旗症状大按钮 + 自由文本 -->
      <div class="bp-form__section">
        <h3 class="bp-form__section-title">
          当时有什么不舒服
          <span class="bp-form__section-sub">（选填，有的话点一下）</span>
        </h3>
        <div class="bp-form__chips" role="group" aria-label="红旗症状快速选择">
          <button
            v-for="symptom in RED_FLAG_SYMPTOMS"
            :key="symptom.id"
            type="button"
            class="bp-form__chip"
            :class="{ 'is-active': selectedSymptomIds.includes(symptom.id) }"
            :aria-pressed="selectedSymptomIds.includes(symptom.id)"
            @click="toggleSymptomChip(symptom.id)"
          >
            {{ symptom.label }}
          </button>
        </div>
        <el-input
          v-model="symptoms"
          type="textarea"
          :rows="2"
          maxlength="100"
          show-word-limit
          size="large"
          placeholder="也可以自己写，比如头痛、胸闷……没有就不填"
        />
        <!-- 点中任一红旗症状：立即提示先打 120（不拦截保存，只强提醒） -->
        <p v-if="hasSelectedSymptom" class="bp-form__symptom-warn">
          <span class="bp-form__symptom-warn-text">出现这些情况可能很危险，建议先拨打 120</span>
          <a class="bp-form__symptom-call" href="tel:120"> 立即拨打 120 </a>
        </p>
      </div>

      <!-- 偏低提示：仅真正低血压分级才给警告 -->
      <p v-if="isLow" class="bp-form__low-note">
        这次数值偏低（低于 90/60）。要是头晕、眼前发黑先躺下歇会儿；正在吃降压药的话
        <strong>别自己停药</strong>，把数值告诉医生。
      </p>
      <!-- 孤立性低压（高压正常、仅低压低）：中性说明，不做红色警告 -->
      <p v-else-if="isIsolatedLow" class="bp-form__low-note bp-form__low-note--neutral">
        {{ BP_ISOLATED_LOW_DIA_TEXT }}
      </p>

      <!-- 高龄脚注（固定灰字） -->
      <p class="bp-form__elder-note">
        80 岁以上的长辈，医生定的血压目标可能宽松一些，按大夫交代的来。
      </p>

      <div class="bp-form__actions">
        <el-button size="large" @click="handleClose">取消</el-button>
        <el-button
          type="primary"
          size="large"
          :loading="saving"
          :disabled="!canSave"
          @click="handleSave"
        >
          {{ isPrefilled ? '这是我刚量的新数，保存' : '保存' }}
        </el-button>
      </div>
    </div>

    <!-- 保存后结果 -->
    <div v-else class="bp-result">
      <p class="bp-result__time">{{ savedRelTime }} 记录</p>
      <div class="bp-result__value">
        <span class="bp-result__num">{{ savedRecord?.sys }}</span>
        <span class="bp-result__slash">/</span>
        <span class="bp-result__num">{{ savedRecord?.dia }}</span>
        <span class="bp-result__unit">mmHg</span>
        <span v-if="savedRecord?.hr" class="bp-result__hr">心率 {{ savedRecord.hr }} 次/分</span>
      </div>

      <!-- 急症：120 红钮在底部 sticky 操作区无条件常显（见下方 actions），勾选症状仅作强化提示 -->
      <template v-if="savedLevel === 'emergency'">
        <div class="bp-result__tip bp-result__tip--red">
          <p class="bp-result__tip-title">{{ levelTip?.title }}</p>

          <p class="bp-result__q">有下面任何一种情况，别等，先打 120</p>
          <el-checkbox-group v-model="redFlags" class="bp-result__flags">
            <el-checkbox
              v-for="symptom in RED_FLAG_SYMPTOMS"
              :key="symptom.id"
              :label="symptom.id"
              size="large"
            >
              {{ symptom.label }}
            </el-checkbox>
          </el-checkbox-group>
          <p v-if="hasRedFlag" class="bp-result__warn">别自己开车去，让家人陪着或等救护车。</p>

          <!-- 次要分支：确认没有不舒服时展开，默认折叠 -->
          <button
            type="button"
            class="bp-result__minor"
            :aria-expanded="showNoDiscomfort"
            @click="showNoDiscomfort = !showNoDiscomfort"
          >
            {{ showNoDiscomfort ? '收起' : '我没有不舒服' }}
          </button>
          <div v-if="showNoDiscomfort" class="bp-result__deep">
            <p>
              没有不舒服也别大意：先<strong>安静坐着休息，别自己加药，也别开车</strong>； 5
              分钟后再量一次，还是 ≥180/120，也要去急诊。
            </p>
          </div>
        </div>
      </template>

      <div v-else class="bp-result__tip" :class="`bp-result__tip--${levelTip?.tone}`">
        <p class="bp-result__tip-title">{{ levelTip?.title }}</p>
        <p class="bp-result__tip-text">{{ levelTip?.text }}</p>
      </div>

      <!-- 脉搏不整齐：提示可能房颤，建议心电图 -->
      <p v-if="savedRecord?.pulseRegular === false" class="bp-result__pulse-warn">
        脉搏不整齐可能是房颤，建议去医院做个心电图
      </p>

      <!-- 底部 sticky 操作区：急症时 tel:120 红钮常显，与“好的”并排 -->
      <div class="bp-result__actions">
        <a
          v-if="savedLevel === 'emergency'"
          class="bp-result__call"
          href="tel:120"
          aria-label="血压很高，人不舒服先打 120"
        >
          血压很高，先打 120
        </a>
        <el-button size="large" @click="handleClose">好的</el-button>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped src="./BpEntryDialog.css"></style>
