<script setup lang="ts">
// 健康指标手动录入弹层（没有手环/体脂秤也能自己记）
// - 单指标单输入：心率 / 步数 / 睡眠 / 体重，规则按 metric 切换
// - 适老化：420px 弹层、大号数字输入、右侧加大步进按钮、56px 主保存按钮
// - 打开时带出 initial；体重缺省取画像 weightKg；Enter 可提交
// - 保存走 saveManualMetric（写当天 day + manual 标记并持久化），成功后提示并 emit

import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { isApiError } from '@/api/http'
import { saveManualMetric } from '@/api'
import type { ManualMetric, ManualMetricInput } from '@/types'
import { useProfileStore } from '@/stores/profile'

const props = defineProps<{
  modelValue: boolean
  metric: ManualMetric
  initial?: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [payload: { metric: ManualMetric; value: number }]
}>()

const profileStore = useProfileStore()

interface MetricConfig {
  title: string
  label: string
  min: number
  max: number
  step: number
  /** undefined = 不限制小数位（心率可能带出 69.3 这种设备值） */
  precision?: number
  unit: string
  tip?: string
  placeholder: string
  success: string
}

const CONFIGS: Record<ManualMetric, MetricConfig> = {
  hr: {
    title: '记录今天的静息心率',
    label: '静息心率',
    min: 40,
    max: 180,
    step: 1,
    unit: '次/分',
    tip: '安静坐 5 分钟后再测更准',
    placeholder: '请输入心率',
    success: '已记下您今天的静息心率',
  },
  steps: {
    title: '记录今天的步数',
    label: '今日步数',
    min: 0,
    max: 30000,
    step: 100,
    precision: 0,
    unit: '步',
    placeholder: '请输入步数',
    success: '已记下您今天的步数',
  },
  sleep: {
    title: '记录今天的睡眠',
    label: '昨晚睡眠',
    min: 3,
    max: 12,
    step: 0.5,
    precision: 1,
    unit: '小时',
    tip: '填昨晚一共睡了几个小时就行',
    placeholder: '请输入小时数',
    success: '已记下您昨晚的睡眠',
  },
  weight: {
    title: '记录今天的体重',
    label: '体重',
    min: 30,
    max: 150,
    step: 0.1,
    precision: 1,
    unit: 'kg',
    placeholder: '请输入体重',
    success: '已记下您今天的体重',
  },
}

const config = computed(() => CONFIGS[props.metric])

const value = ref<number | null>(null)
const saving = ref(false)

// 每次打开重新带出初值；体重没有 initial 时回落画像体重
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    if (props.initial != null && Number.isFinite(Number(props.initial))) {
      value.value = Number(props.initial)
    } else if (props.metric === 'weight') {
      const w = Number(profileStore.profile.weightKg)
      value.value = Number.isFinite(w) && w > 0 ? w : null
    } else {
      value.value = null
    }
  },
)

const canSave = computed(() => value.value != null && Number.isFinite(value.value))

function close() {
  emit('update:modelValue', false)
}

// Enter（form submit）与点保存都走这里
async function handleSave() {
  const v = value.value
  if (v == null || !Number.isFinite(v)) {
    ElMessage.warning('请先填一个数值')
    return
  }
  saving.value = true
  try {
    await saveManualMetric(null, { [props.metric]: v } as ManualMetricInput)
    ElMessage.success(config.value.success)
    emit('saved', { metric: props.metric, value: v })
    emit('update:modelValue', false)
  } catch (err) {
    ElMessage.error(isApiError(err) ? err.message : '暂时没能保存，请稍后再试')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="config.title"
    width="min(420px, 94vw)"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <!-- 表单包裹：输入框内按 Enter 即触发提交 -->
    <form class="manual-form" @submit.prevent="handleSave">
      <label class="manual-form__label" for="manual-metric-input">{{ config.label }}</label>
      <div class="manual-form__row">
        <el-input-number
          id="manual-metric-input"
          v-model="value"
          class="manual-form__input"
          size="large"
          controls-position="right"
          :min="config.min"
          :max="config.max"
          :step="config.step"
          :precision="config.precision"
          :placeholder="config.placeholder"
        />
        <span class="manual-form__unit">{{ config.unit }}</span>
      </div>
      <p class="manual-form__range">范围 {{ config.min }}–{{ config.max }} {{ config.unit }}</p>
      <p v-if="config.tip" class="manual-form__tip">{{ config.tip }}</p>
    </form>

    <template #footer>
      <div class="manual-form__actions">
        <el-button size="large" class="manual-form__cancel" @click="close">取消</el-button>
        <el-button
          type="primary"
          size="large"
          class="manual-form__save"
          :loading="saving"
          :disabled="!canSave"
          @click="handleSave"
        >
          保存
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.manual-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding-top: var(--space-xs);
}

.manual-form__label {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text);
}

.manual-form__row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.manual-form__input {
  flex: 1;
  width: 100%;
}

/* 大号数字输入框 */
.manual-form__input :deep(.el-input__inner) {
  height: 52px;
  font-size: 1.5rem;
  font-weight: 700;
}

/* 右侧步进按钮加大，方便长辈点按 */
.manual-form__input :deep(.el-input-number__increase),
.manual-form__input :deep(.el-input-number__decrease) {
  width: 44px;
  font-size: 1.4rem;
}

.manual-form__unit {
  font-size: var(--font-size-lg);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.manual-form__range,
.manual-form__tip {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.manual-form__actions {
  display: flex;
  gap: var(--space-md);
}

.manual-form__cancel {
  min-width: 96px;
  min-height: var(--control-touch);
}

/* 主保存按钮 56px 高、主色 */
.manual-form__save {
  flex: 1;
  height: 56px;
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
}
</style>
