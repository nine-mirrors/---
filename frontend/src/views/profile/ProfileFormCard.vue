<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import { ACTIVITY_OPTIONS, DENTAL_OPTIONS, TASTE_OPTIONS } from '@/constants/dict'
import {
  COMMON_ALLERGY_TAGS,
  FREQ_OPTIONS,
  OCCUPATION_ACTIVITY,
  OCCUPATIONS,
  STAPLE_PREFS,
  YESNO,
} from '@/constants/onboarding'
import { isPhone } from '@/utils/account'
import { htnConclusionText } from './assessmentText'
import type { HtnDetail, Profile } from '@/types'

/** 画像页可编辑字段子集（保存时由父级整体合并回 Profile） */
type EditableProfile = Pick<
  Profile,
  | 'name'
  | 'age'
  | 'gender'
  | 'heightCm'
  | 'weightKg'
  | 'occupation'
  | 'activity'
  | 'dental'
  | 'taste'
  | 'staplePref'
  | 'eatOutFreq'
  | 'smoke'
  | 'drink'
  | 'allergies'
  | 'renalKRestriction'
  | 'emergencyContactName'
  | 'emergencyContactPhone'
> & {
  htnDetail: HtnDetail | null
}

// 本地编辑态由父级持有（v-model），点“保存”时才统一写入 store
const form = defineModel<EditableProfile>({ required: true })

const props = defineProps<{
  phone?: string
  profile: Profile
}>()

const emit = defineEmits<{
  save: []
}>()

const GENDER_OPTIONS = [
  { value: '男', label: '男' },
  { value: '女', label: '女' },
]

// 控钾三选项：有→true、没有→false、不清楚→null（默认）
const RENAL_OPTIONS = [
  { value: true, label: '有', description: '医生说过肾不好，或需要控制钾' },
  { value: false, label: '没有', description: '肾功能正常，没有这方面问题' },
  { value: null, label: '不清楚', description: '没查过或不太确定' },
]

type OptionEntry = { value: string; label: string }
type OptionFieldKey =
  'activity' | 'dental' | 'taste' | 'staplePref' | 'eatOutFreq' | 'smoke' | 'drink'
type OptionField = {
  key: OptionFieldKey
  label: string
  hint?: string
  options: OptionEntry[]
}

function plainOptions(list: readonly string[]): OptionEntry[] {
  return list.map((value) => ({ value, label: value }))
}

// 统一样式的选项按钮组字段（性别、职业单独排版）
const OPTION_FIELDS: OptionField[] = [
  {
    key: 'activity',
    label: '活动量',
    hint: '平时工作、家务和运动的总量',
    options: ACTIVITY_OPTIONS,
  },
  { key: 'dental', label: '牙口', options: plainOptions(DENTAL_OPTIONS) },
  { key: 'taste', label: '口味', options: plainOptions(TASTE_OPTIONS) },
  { key: 'staplePref', label: '主食偏好', options: plainOptions(STAPLE_PREFS) },
  { key: 'eatOutFreq', label: '外食频率', options: plainOptions(FREQ_OPTIONS) },
  { key: 'smoke', label: '吸烟', options: plainOptions(YESNO) },
  { key: 'drink', label: '饮酒', options: plainOptions(YESNO) },
]

const htnText = computed(() => htnConclusionText(props.profile))
const phoneText = computed(() => props.phone || '未填写')
// 确诊高血压时才显示“规律服药”开关
const showMedicatedSwitch = computed(() => props.profile.htnStatus === 'confirmed')

function setNumber(key: 'age' | 'heightCm' | 'weightKg', raw: unknown) {
  if (raw === '' || raw === null || raw === undefined) {
    form.value[key] = null
    return
  }
  const num = Number(raw)
  if (Number.isFinite(num)) form.value[key] = num
}

// 职业 → 活动量直接同步（other 无映射，保留用户自选）
function chooseOccupation(value: string) {
  form.value.occupation = value
  const mapped = OCCUPATION_ACTIVITY[value]
  if (mapped) form.value.activity = mapped
}

function chooseRenal(value: boolean | null) {
  form.value.renalKRestriction = value
}

// 切换“规律服降压药”：确保 htnDetail 存在后再写 medicated
function toggleMedicated(raw: string | number | boolean) {
  const value = Boolean(raw)
  form.value.htnDetail = { ...(form.value.htnDetail || {}), medicated: value }
}

// 忌口/过敏标签输入
const tagDraft = ref('')

function addTag() {
  const value = tagDraft.value.trim()
  if (!value) return
  const list = form.value.allergies || []
  if (!list.some((item: string) => item === value)) {
    form.value.allergies = [...list, value]
  }
  tagDraft.value = ''
}

function removeTag(index: number) {
  const list = [...(form.value.allergies || [])]
  list.splice(index, 1)
  form.value.allergies = list
}

function removeLastTag() {
  if (tagDraft.value) return
  const list = [...(form.value.allergies || [])]
  list.pop()
  form.value.allergies = list
}

// 常见忌口/过敏大字 chips：与引导问卷同款，点一下加上、再点一下取消
function hasCommonTag(name: string): boolean {
  return (form.value.allergies || []).some((item: string) => item === name)
}

function toggleCommonTag(name: string) {
  const list = [...(form.value.allergies || [])]
  const index = list.indexOf(name)
  if (index >= 0) {
    list.splice(index, 1)
  } else {
    list.push(name)
  }
  form.value.allergies = list
}

function handleSave() {
  // 紧急联系人：姓名与电话要么都不填（未设置），要么都填且电话为 11 位手机号
  const contactName = form.value.emergencyContactName.trim()
  const contactPhone = form.value.emergencyContactPhone.trim()
  if (contactName || contactPhone) {
    if (!contactName) {
      ElMessage.warning('请填写紧急联系人怎么称呼，比如“儿子小明”')
      return
    }
    if (!isPhone(contactPhone)) {
      ElMessage.warning('紧急联系人的电话请填 11 位手机号，急症时才能一键拨通')
      return
    }
  }
  form.value.emergencyContactName = contactName
  form.value.emergencyContactPhone = contactPhone
  emit('save')
}
</script>

<template>
  <section class="nd-card form-card">
    <h2 class="form-card__title">个人信息</h2>

    <div class="field">
      <label class="field__label" for="profile-name">昵称</label>
      <el-input
        id="profile-name"
        v-model="form.name"
        class="field__control"
        size="large"
        maxlength="20"
      />
    </div>

    <div class="field">
      <span class="field__label">手机号</span>
      <el-input
        :model-value="phoneText"
        class="field__control field__control--readonly"
        size="large"
        readonly
      >
        <template #suffix><span class="field__suffix">登录账号</span></template>
      </el-input>
    </div>

    <!-- 紧急联系人：健康页急症面板里与“拨打 120”并列一键拨打 -->
    <div class="field">
      <label class="field__label" for="profile-emergency-name">紧急联系人</label>
      <span class="field__hint">不舒服时可以一键打给 TA，填子女或常陪您去医院的家人</span>
      <el-input
        id="profile-emergency-name"
        v-model="form.emergencyContactName"
        class="field__control"
        size="large"
        maxlength="20"
        placeholder="怎么称呼，如：儿子小明"
      />
      <el-input
        :model-value="form.emergencyContactPhone"
        class="field__control"
        size="large"
        type="tel"
        maxlength="11"
        aria-label="紧急联系人手机号"
        placeholder="TA 的 11 位手机号"
        @update:model-value="(v: string) => (form.emergencyContactPhone = v.replace(/\D/g, ''))"
      />
    </div>

    <div class="field">
      <label class="field__label" for="profile-age">年龄</label>
      <el-input
        id="profile-age"
        :model-value="form.age ?? ''"
        class="field__control"
        size="large"
        type="number"
        :min="40"
        :max="100"
        @update:model-value="(v: string | number) => setNumber('age', v)"
      >
        <template #suffix><span class="field__suffix">岁（40–100）</span></template>
      </el-input>
    </div>

    <div class="field">
      <span class="field__label">性别</span>
      <div class="option-group">
        <button
          v-for="option in GENDER_OPTIONS"
          :key="option.value"
          type="button"
          class="option-btn"
          :class="{ 'is-active': form.gender === option.value }"
          :aria-pressed="form.gender === option.value"
          @click="form.gender = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div class="field">
      <span class="field__label">身高 / 体重</span>
      <div class="num-grid">
        <el-input
          :model-value="form.heightCm ?? ''"
          class="field__control"
          size="large"
          type="number"
          :min="50"
          :max="250"
          :step="0.1"
          @update:model-value="(v: string | number) => setNumber('heightCm', v)"
        >
          <template #suffix><span class="field__suffix">cm</span></template>
        </el-input>
        <el-input
          :model-value="form.weightKg ?? ''"
          class="field__control"
          size="large"
          type="number"
          :min="20"
          :max="250"
          :step="0.1"
          @update:model-value="(v: string | number) => setNumber('weightKg', v)"
        >
          <template #suffix><span class="field__suffix">kg</span></template>
        </el-input>
      </div>
    </div>

    <div class="field">
      <span class="field__label">职业</span>
      <div class="option-group option-group--stacked">
        <button
          v-for="occupation in OCCUPATIONS"
          :key="occupation.value"
          type="button"
          class="option-btn"
          :class="{ 'is-active': form.occupation === occupation.value }"
          :aria-pressed="form.occupation === occupation.value"
          @click="chooseOccupation(occupation.value)"
        >
          {{ occupation.label }}
        </button>
      </div>
    </div>

    <div v-for="item in OPTION_FIELDS" :key="item.key" class="field">
      <span class="field__label">{{ item.label }}</span>
      <span v-if="item.hint" class="field__hint">{{ item.hint }}</span>
      <div class="option-group">
        <button
          v-for="option in item.options"
          :key="option.value"
          type="button"
          class="option-btn"
          :class="{ 'is-active': form[item.key] === option.value }"
          :aria-pressed="form[item.key] === option.value"
          @click="form[item.key] = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <!-- 控钾三选一（R2.2：肾不好/需控钾，含低钠盐） -->
    <div class="field">
      <span class="field__label">肾不好 / 需控钾（含低钠盐）</span>
      <span class="field__hint">选“有”时，营养建议会去掉补钾类提醒，具体量请遵医嘱</span>
      <div class="option-group option-group--stacked">
        <button
          v-for="option in RENAL_OPTIONS"
          :key="String(option.value)"
          type="button"
          class="option-btn"
          :class="{ 'is-active': form.renalKRestriction === option.value }"
          :aria-pressed="form.renalKRestriction === option.value"
          @click="chooseRenal(option.value)"
        >
          <span class="option-btn__label">{{ option.label }}</span>
          <span class="option-btn__desc">{{ option.description }}</span>
        </button>
      </div>
    </div>

    <div class="field">
      <span class="field__label">忌口 / 过敏</span>
      <span class="field__hint">没有可以不填，输入后按回车添加，如：花生、海鲜、辣</span>
      <div class="tag-editor">
        <span v-for="(tag, index) in form.allergies" :key="`${tag}-${index}`" class="tag-chip">
          <span class="tag-chip__text">{{ tag }}</span>
          <button
            type="button"
            class="tag-chip__remove"
            :aria-label="`删除忌口 ${tag}`"
            @click="removeTag(index)"
          >
            <el-icon aria-hidden="true"><Close /></el-icon>
          </button>
        </span>
        <input
          v-model="tagDraft"
          class="tag-editor__input"
          type="text"
          placeholder="添加忌口或过敏原"
          maxlength="12"
          @keydown.enter.prevent="addTag"
          @keydown.delete="removeLastTag"
          @blur="addTag"
        />
      </div>
      <!-- 常见忌口/过敏大字 chips：点一下加上、再点一下取消 -->
      <p class="tag-quick-label">常见的，点一下就加上（再点一下取消）</p>
      <div class="tag-quick">
        <button
          v-for="name in COMMON_ALLERGY_TAGS"
          :key="name"
          type="button"
          class="tag-quick__chip"
          :class="{ 'is-active': hasCommonTag(name) }"
          :aria-pressed="hasCommonTag(name)"
          @click="toggleCommonTag(name)"
        >
          {{ name }}
        </button>
      </div>
    </div>

    <div class="field">
      <span class="field__label">病史（来自健康测评）</span>
      <div class="history-box">
        <div class="history-row">
          <span class="history-row__label">血压评估</span>
          <span class="history-row__value">{{ htnText }}</span>
        </div>
        <div v-if="showMedicatedSwitch" class="history-row history-row--switch">
          <span class="history-row__label">规律服降压药</span>
          <el-switch
            :model-value="!!form.htnDetail?.medicated"
            class="med-switch"
            size="large"
            inline-prompt
            active-text="是"
            inactive-text="否"
            @update:model-value="(v: string | number | boolean) => toggleMedicated(v)"
          />
        </div>
        <p class="history-note">病史信息通过健康测评填写，如需修改请点上方“重新进行健康测评”。</p>
      </div>
    </div>

    <el-button type="primary" class="form-card__save" size="large" @click="handleSave">
      保存
    </el-button>
  </section>
</template>

<style scoped src="./ProfileFormCard.css"></style>
