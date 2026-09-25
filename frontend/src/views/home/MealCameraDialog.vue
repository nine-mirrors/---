<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Picture, Refresh } from '@element-plus/icons-vue'
import { useCamera } from '@/composables/useCamera'

const props = defineProps<{
  modelValue?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  captured: [payload: { dataUrl: string; file: File }]
}>()

const { active, error, start, capture, loadFromFile, stop } = useCamera()

const videoRef = ref<HTMLVideoElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const starting = ref(false)

/** 拍照后的待确认照片：未点“用这张”前不提交 */
const previewShot = ref<{ dataUrl: string; file: File } | null>(null)

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) {
      stop()
      previewShot.value = null
      return
    }
    previewShot.value = null
    await nextTick()
    starting.value = true
    await start(videoRef.value)
    starting.value = false
  },
)

function closeDialog() {
  emit('update:modelValue', false)
}

// canvas 抓帧得到的 dataUrl 转回 File，供真实接口 multipart 上传
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [head, base64] = dataUrl.split(',')
  const mimeMatch = /data:(.*?);base64/.exec(head)
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new File([bytes], filename, { type: mime })
}

function handleShutter() {
  const shot = capture(videoRef.value)
  if (!shot) {
    ElMessage.warning('画面还没准备好，请稍等一下再按快门')
    return
  }
  const file = dataUrlToFile(shot.dataUrl, `meal_${Date.now()}.jpg`)
  // 先给老人看照片，确认后才提交识别
  previewShot.value = { file, ...shot }
}

// 预览步主按钮：用这张，走原有 captured 提交流
function confirmPreview() {
  if (!previewShot.value) return
  emit('captured', { ...previewShot.value })
  closeDialog()
}

// 预览步次按钮：丢掉这张，回到取景流重拍
async function retakePreview() {
  previewShot.value = null
  // 正常情况下摄像头流一直在跑；若已停（如被系统回收）则重新拉起
  if (!active.value) {
    await retryCamera()
  }
}

function pickFromAlbum() {
  fileInputRef.value?.click()
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files && input.files[0]
  input.value = ''
  if (!file) return
  try {
    const shot = await loadFromFile(file)
    emit('captured', { file, ...shot })
    closeDialog()
  } catch {
    ElMessage.error('这张图片读不出来，换一张试试')
  }
}

async function retryCamera() {
  starting.value = true
  await start(videoRef.value)
  starting.value = false
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="拍一张今天的饭菜"
    width="min(720px, 92vw)"
    :close-on-click-modal="false"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="camera-dialog__body">
      <div v-if="error" class="camera-dialog__fallback">
        <p class="camera-dialog__fallback-text">{{ error.message }}</p>
        <button type="button" class="camera-dialog__album-primary" @click="pickFromAlbum">
          <el-icon aria-hidden="true"><Picture /></el-icon>
          <span>从相册选择照片</span>
        </button>
        <button type="button" class="camera-dialog__retry" @click="retryCamera">
          <el-icon aria-hidden="true"><Refresh /></el-icon>
          <span>再试一次摄像头</span>
        </button>
      </div>

      <div v-else class="camera-dialog__stage-wrap">
        <div class="camera-dialog__stage">
          <video ref="videoRef" class="camera-dialog__video" autoplay muted playsinline />
          <p v-if="starting" class="camera-dialog__starting">正在打开摄像头…</p>
          <div v-if="previewShot" class="camera-dialog__preview">
            <img :src="previewShot.dataUrl" alt="刚拍好的饭菜照片，确认后开始识别" />
          </div>
        </div>

        <!-- 取景流：快门 -->
        <div v-if="!previewShot" class="camera-dialog__actions">
          <button
            type="button"
            class="camera-dialog__shutter"
            aria-label="拍照"
            :disabled="starting || !active"
            @click="handleShutter"
          >
            <span class="camera-dialog__shutter-inner" />
          </button>
        </div>

        <!-- 预览流：确认 / 重拍，两个 56px 大按钮 -->
        <div v-else class="camera-dialog__preview-actions">
          <button type="button" class="camera-dialog__confirm" @click="confirmPreview">
            用这张，开始识别
          </button>
          <button type="button" class="camera-dialog__retake-shot" @click="retakePreview">
            重拍一张
          </button>
        </div>
      </div>

      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        class="camera-dialog__file"
        @change="handleFileChange"
      />
    </div>

    <template #footer>
      <button
        v-if="!error"
        type="button"
        class="camera-dialog__album-footer"
        @click="pickFromAlbum"
      >
        <el-icon aria-hidden="true"><Picture /></el-icon>
        <span>从相册选一张</span>
      </button>
    </template>
  </el-dialog>
</template>

<style scoped>
.camera-dialog__body {
  margin: 0;
}

.camera-dialog__stage-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.camera-dialog__stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background-color: #211f1b;
  border-radius: var(--radius-md);
}

.camera-dialog__video {
  display: block;
  width: 100%;
  max-width: 720px;
  max-height: 58vh;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  background-color: #211f1b;
}

.camera-dialog__starting {
  position: absolute;
  margin: 0;
  padding: var(--space-sm) var(--space-lg);
  font-size: 1rem;
  color: #fff;
  background-color: rgba(0, 0, 0, 0.45);
  border-radius: 999px;
}

.camera-dialog__actions {
  display: flex;
  justify-content: center;
}

.camera-dialog__preview {
  position: absolute;
  inset: 0;
  z-index: 1;
  background-color: #211f1b;
}

.camera-dialog__preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.camera-dialog__preview-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.camera-dialog__confirm,
.camera-dialog__retake-shot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 56px;
  padding: 0 var(--space-xl);
  font-family: inherit;
  font-size: 1.1rem;
  font-weight: 700;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.camera-dialog__confirm {
  color: var(--color-text-inverse);
  background-color: var(--color-primary);
  border: 2px solid var(--color-primary);
}

.camera-dialog__confirm:hover {
  background-color: var(--color-primary-dark);
  border-color: var(--color-primary-dark);
}

.camera-dialog__retake-shot {
  color: var(--color-primary-dark);
  background-color: var(--color-bg-card);
  border: 2px solid var(--color-primary);
}

.camera-dialog__retake-shot:hover {
  background-color: color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-card));
}

.camera-dialog__shutter {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76px;
  height: 76px;
  padding: 0;
  background-color: transparent;
  border: 4px solid var(--color-primary);
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.camera-dialog__shutter:hover {
  transform: scale(1.05);
}

.camera-dialog__shutter:active {
  transform: scale(0.95);
}

.camera-dialog__shutter:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.camera-dialog__shutter-inner {
  display: block;
  width: 58px;
  height: 58px;
  background-color: #fff;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  transition: background-color 0.15s ease;
}

.camera-dialog__shutter:active .camera-dialog__shutter-inner {
  background-color: var(--color-primary);
}

.camera-dialog__fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-lg) 0;
  text-align: center;
}

.camera-dialog__fallback-text {
  margin: 0;
  font-size: 1.05rem;
  color: var(--color-text-secondary);
}

.camera-dialog__album-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  min-height: 52px;
  padding: 0 var(--space-xl);
  font-family: inherit;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-text-inverse);
  background-color: var(--color-primary);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.camera-dialog__album-primary:hover {
  background-color: var(--color-primary-dark);
}

.camera-dialog__retry {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  min-height: 44px;
  padding: 0 var(--space-md);
  font-family: inherit;
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  background: none;
  border: none;
  cursor: pointer;
}

.camera-dialog__album-footer {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  min-height: 44px;
  padding: 0 var(--space-lg);
  font-family: inherit;
  font-size: 1rem;
  color: var(--color-primary-dark);
  background: none;
  border: none;
  cursor: pointer;
}

.camera-dialog__file {
  display: none;
}
</style>
