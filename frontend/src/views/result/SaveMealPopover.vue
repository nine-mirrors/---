<script setup lang="ts">
import { computed } from 'vue'
import { Select, Check, Refresh } from '@element-plus/icons-vue'

const props = withDefaults(
  defineProps<{
    /** 弹层是否打开（el-popover 手动受控） */
    modelValue?: boolean
    /** 保存请求进行中：按钮 loading，禁止重复提交 */
    saving?: boolean
  }>(),
  { modelValue: false, saving: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  select: [adoptedHealthy: boolean]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

// adoptedHealthy=false：就按这餐保存；true：换成推荐搭配保存
function choose(adoptedHealthy: boolean) {
  if (props.saving) return
  emit('select', adoptedHealthy)
}
</script>

<template>
  <el-popover
    v-model:visible="visible"
    placement="top"
    :width="320"
    trigger="click"
    popper-class="save-meal-popover"
  >
    <template #reference>
      <el-button
        type="primary"
        class="nd-big-btn save-meal-btn"
        :loading="saving"
        :disabled="saving"
      >
        <el-icon v-if="!saving" class="save-meal-btn__icon"><Select /></el-icon>
        <span>保存这餐</span>
      </el-button>
    </template>

    <div class="save-pop">
      <p class="save-pop__title">按哪个版本记到今天？</p>
      <button type="button" class="save-pop__option" :disabled="saving" @click="choose(false)">
        <el-icon class="save-pop__option-icon"><Check /></el-icon>
        <span class="save-pop__option-text">
          <span class="save-pop__option-name">就按现在这样保存（推荐）</span>
          <span class="save-pop__option-desc">如实记录刚才识别到的饭菜</span>
        </span>
      </button>
      <button
        type="button"
        class="save-pop__option save-pop__option--primary"
        :disabled="saving"
        @click="choose(true)"
      >
        <el-icon class="save-pop__option-icon"><Refresh /></el-icon>
        <span class="save-pop__option-text">
          <span class="save-pop__option-name">想看看更清淡的搭配？</span>
          <span class="save-pop__option-desc">按建议的减盐做法记录这一餐</span>
        </span>
      </button>
      <el-button link class="save-pop__cancel" :disabled="saving" @click="visible = false">
        取消
      </el-button>
    </div>
  </el-popover>
</template>

<style scoped>
.save-meal-btn {
  width: 100%;
}

.save-meal-btn__icon {
  margin-right: var(--space-sm);
}

.save-pop {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.save-pop__title {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: 700;
  color: var(--color-text);
}

.save-pop__option {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  width: 100%;
  padding: var(--space-md);
  text-align: left;
  background-color: var(--color-bg-card);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.save-pop__option:hover:not(:disabled) {
  border-color: var(--color-primary);
  background-color: var(--color-success-bg);
}

.save-pop__option:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.save-pop__option--primary {
  border-color: color-mix(in srgb, var(--color-primary) 50%, var(--color-border));
  background-color: color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-card));
}

.save-pop__option-icon {
  flex-shrink: 0;
  margin-top: 2px;
  font-size: var(--font-size-lg);
  color: var(--color-primary);
}

.save-pop__option-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.save-pop__option-name {
  font-size: var(--font-size-base);
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-text);
}

.save-pop__option-desc {
  font-size: var(--font-size-sm);
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.save-pop__cancel {
  align-self: center;
  height: auto;
  padding: var(--space-xs) var(--space-md);
  font-size: var(--font-size-sm);
}
</style>
