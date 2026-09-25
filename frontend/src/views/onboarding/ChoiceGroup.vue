<script setup lang="ts">
import { computed } from 'vue'
import BigOptionButton from '@/components/common/BigOptionButton.vue'

type ChoiceOption = {
  value?: string
  label: string
  description?: string
  icon?: string
}

const props = withDefaults(
  defineProps<{
    /** 单选为字符串，多选为字符串数组 */
    modelValue?: string | string[]
    /** 支持纯字符串数组或 { value, label, description, icon } */
    options: Array<string | ChoiceOption>
    multiple?: boolean
    /** danger：红旗症状暖红描边 */
    type?: string
    columns?: number
  }>(),
  {
    modelValue: '',
    multiple: false,
    type: 'default',
    columns: 3,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | string[]]
}>()

const items = computed(() =>
  props.options.map(
    (option): { value: string; label: string; description: string; icon: string } =>
      typeof option === 'string'
        ? { value: option, label: option, description: '', icon: '' }
        : {
            value: option.value ?? option.label,
            label: option.label,
            description: option.description || '',
            icon: option.icon || '',
          },
  ),
)

function isSelected(value: string): boolean {
  return props.multiple
    ? Array.isArray(props.modelValue) && props.modelValue.includes(value)
    : props.modelValue === value
}

function choose(value: string) {
  if (props.multiple) {
    const current = Array.isArray(props.modelValue) ? props.modelValue : []
    const next = [...current]
    const index = next.indexOf(value)
    if (index >= 0) {
      next.splice(index, 1)
    } else {
      next.push(value)
    }
    emit('update:modelValue', next)
    return
  }
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="choice-group" :style="{ '--choice-cols': columns }">
    <BigOptionButton
      v-for="item in items"
      :key="item.value"
      :label="item.label"
      :description="item.description"
      :icon="item.icon"
      :type="type"
      :model-value="isSelected(item.value)"
      @click="choose(item.value)"
    />
  </div>
</template>

<style scoped>
.choice-group {
  display: grid;
  grid-template-columns: repeat(var(--choice-cols), minmax(0, 1fr));
  gap: var(--space-md);
}

@media (max-width: 600px) {
  .choice-group {
    grid-template-columns: 1fr;
  }
}
</style>
