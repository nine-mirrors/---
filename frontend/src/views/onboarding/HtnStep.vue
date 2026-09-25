<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Upload } from '@element-plus/icons-vue'
import BigOptionButton from '@/components/common/BigOptionButton.vue'
import { HTN_DURATION, HTN_OPTIONS } from '@/constants/onboarding'
import { useDraft } from './useDraft'
import type { HtnStatus } from '@/types'

const draft = useDraft()

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

const HTN_CARDS = HTN_OPTIONS.map((option) => {
  if (option.value === 'confirmed') {
    return { ...option, icon: 'Flag', description: '医生已经确诊过，正在吃药或监测' }
  }
  if (option.value === 'none') {
    return { ...option, icon: 'Aim', description: '没听医生说过，体检血压也正常' }
  }
  return { ...option, icon: 'Search', description: '没怎么量过，或者有时高有时正常' }
})

const fileInput = ref<HTMLInputElement | null>(null)
const fileName = ref(draft.htnDetail.records[0]?.name || '')
// ObjectURL 只活在组件里，绝不写进 draft；重进步骤无法重建，仅回显文件名
const previewUrl = ref('')

function chooseHtn(value: HtnStatus) {
  draft.htnStatus = value
  if (value !== 'confirmed') {
    draft.htnDetail.duration = ''
    draft.htnDetail.medicated = false
    clearFile()
  }
}

function toggleDuration(item: string) {
  draft.htnDetail.duration = draft.htnDetail.duration === item ? '' : item
}

function pickFile() {
  fileInput.value?.click()
}

function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  clearFile()
  previewUrl.value = URL.createObjectURL(file)
  fileName.value = file.name
  // 只暂存文件名与类型，禁止保存文件内容/base64
  draft.htnDetail.records = [{ name: file.name, type: file.type }]
}

function clearFile() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
  fileName.value = ''
  draft.htnDetail.records = []
  if (fileInput.value) fileInput.value.value = ''
}

watch(
  () => draft.htnStatus,
  (value) => {
    if (value !== 'confirmed' && previewUrl.value) clearFile()
  },
)

onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <div class="htn-step">
    <h2 class="q-title">您有没有被医生说过血压高呀？</h2>
    <div class="htn-options">
      <BigOptionButton
        v-for="option in HTN_CARDS"
        :key="option.value"
        :label="option.label"
        :description="option.description"
        :icon="option.icon"
        :model-value="draft.htnStatus === option.value"
        @click="chooseHtn(option.value)"
      />
    </div>

    <div v-if="draft.htnStatus === 'confirmed'" class="htn-extra">
      <p class="field-label">确诊多久啦？（可以不选）</p>
      <div class="duration-row">
        <button
          v-for="item in HTN_DURATION"
          :key="item"
          type="button"
          class="duration-btn"
          :class="{ 'is-selected': draft.htnDetail.duration === item }"
          :aria-pressed="draft.htnDetail.duration === item"
          @click="toggleDuration(item)"
        >
          {{ item }}
        </button>
      </div>

      <div class="switch-row">
        <span class="field-label switch-row__label">平时规律吃降压药吗？</span>
        <el-switch
          v-model="draft.htnDetail.medicated"
          class="med-switch"
          size="large"
          inline-prompt
          active-text="是"
          inactive-text="否"
        />
      </div>

      <div class="upload-box">
        <p class="field-label">有病历或体检报告可以选一份（不用也行）</p>
        <input
          ref="fileInput"
          type="file"
          accept="image/*,.pdf"
          class="upload-native"
          @change="onFileChange"
        />
        <button type="button" class="upload-btn" @click="pickFile">
          <el-icon aria-hidden="true"><Upload /></el-icon>
          选一份图片或 PDF
        </button>
        <div v-if="fileName" class="upload-file">
          <span class="upload-file__name" :title="fileName">{{ fileName }}</span>
          <a
            v-if="previewUrl"
            :href="previewUrl"
            target="_blank"
            rel="noopener"
            class="upload-file__link"
          >
            在新标签预览
          </a>
          <button type="button" class="upload-file__remove" @click="clearFile">移除</button>
        </div>
        <p class="demo-note">
          {{
            USE_MOCK
              ? '演示版资料仅保存在这台电脑上，不会上传到服务器'
              : '病历资料只用于辅助记录，不会上传到服务器'
          }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.htn-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.htn-extra {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  margin-top: var(--space-xl);
  padding-top: var(--space-xl);
  border-top: 1px dashed var(--color-border);
}

.field-label {
  margin: 0 0 var(--space-md);
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-text);
}

.duration-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
}

.duration-btn {
  flex: 1;
  min-width: 132px;
  min-height: 48px;
  padding: 0 var(--space-lg);
  font-family: inherit;
  font-size: var(--font-size-base);
  color: var(--color-text);
  background-color: var(--color-bg-card);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.duration-btn:hover {
  border-color: var(--color-primary);
}

.duration-btn.is-selected {
  font-weight: 600;
  color: var(--color-primary-dark);
  background-color: color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-card));
  border-color: var(--color-primary);
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
}

.switch-row__label {
  margin: 0;
}

.med-switch {
  --el-switch-on-color: var(--color-primary);
  flex-shrink: 0;
}

.upload-box {
  padding: var(--space-lg);
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.upload-native {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  min-height: 48px;
  padding: 0 var(--space-lg);
  font-family: inherit;
  font-size: var(--font-size-base);
  color: var(--color-primary-dark);
  background-color: var(--color-bg-card);
  border: 2px dashed var(--color-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.upload-btn:hover {
  background-color: color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-card));
}

.upload-file {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-md);
  margin-top: var(--space-md);
  font-size: var(--font-size-base);
}

.upload-file__name {
  max-width: 280px;
  overflow: hidden;
  color: var(--color-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-file__link {
  font-weight: 600;
}

.upload-file__remove {
  position: relative;
  padding: 4px var(--space-sm);
  font-family: inherit;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
}

/* 适老热区：透明伪元素把点按区扩到 ≥44px，文字视觉尺寸不变 */
.upload-file__remove::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 44px;
  height: 44px;
  transform: translate(-50%, -50%);
}

.demo-note {
  margin: var(--space-md) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}
</style>
