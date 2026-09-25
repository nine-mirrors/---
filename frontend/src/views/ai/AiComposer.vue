<script setup lang="ts">
// 底部输入区：附件（图片 / txt·md 文本文件）+ 普通话语音输入 + 自适应输入框。
// 图片 FileReader 读 dataUrl（随消息入视觉模型，发送前与 meal 图同一套压缩）；
// 文本文件读文本，发送时由页面拼进正文。
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  CircleClose,
  Document,
  Lock,
  Microphone,
  Picture,
  Promotion,
  VideoPause,
} from '@element-plus/icons-vue'
import {
  ACCEPT_IMAGE,
  ACCEPT_TEXT,
  MAX_IMAGE_COUNT,
  MAX_IMAGE_MB,
  MAX_TEXT_FILE_KB,
} from '@/constants/ai'
import { useSpeechRecognition } from '@/composables/useSpeechRecognition'
import { prepareMealImage } from '@/utils/image'
import type { AiAttachment } from '@/types/ai'

/** 图片隐私授权：全局 localStorage 键（不按账号隔离），同意一次后全 App 不再询问 */
const IMAGE_CONSENT_KEY = 'ndh_ai_image_consent_v1'

/** 单次提问全部图片压缩后的体积上限（8MB），防止多模态请求过大 */
const MAX_TOTAL_IMAGE_BYTES = 8 * 1024 * 1024

interface SendPayload {
  text: string
  attachments: AiAttachment[]
  fileTexts: Record<string, string>
}

const props = withDefaults(defineProps<{ sending?: boolean }>(), { sending: false })

const emit = defineEmits<{
  (e: 'send', payload: SendPayload): void
  (e: 'stop'): void
}>()

const text = ref('')
const attachments = ref<AiAttachment[]>([])
/** 文本附件 id -> 读出的文本正文 */
const fileTexts = ref<Record<string, string>>({})
/** 语音识别中的临时文本（只拼显示，不污染已确定文本） */
const interim = ref('')
const composing = ref(false)
const textareaEl = ref<HTMLTextAreaElement | null>(null)
const imageInputEl = ref<HTMLInputElement | null>(null)
const fileInputEl = ref<HTMLInputElement | null>(null)

/* ---------- 语音 ---------- */
const SPEECH_ERROR_MAP: Record<string, string> = {
  'not-allowed': '请在浏览器设置里允许使用麦克风',
  'service-not-allowed': '请在浏览器设置里允许使用麦克风',
  'no-speech': '没听到声音，请再试一次',
  network: '语音识别需要联网，请检查网络',
  'audio-capture': '没有检测到麦克风，请检查设备后再试',
  // 主动 stop 触发，不提示
  aborted: '',
}

/** 曾被拒绝权限 / 浏览器不支持：toast 之外，在麦克风下方常驻一行操作指引（与悬浮面板一致） */
const micBlocked = ref(false)
const { supported, listening, start, stop } = useSpeechRecognition({
  onResult: (result) => {
    if (result.final) {
      const t = result.text
      text.value = text.value ? `${text.value.replace(/\s+$/, '')} ${t} ` : `${t} `
      interim.value = ''
    } else {
      interim.value = result.text
    }
    void autoResize()
  },
  onEnd: () => {
    interim.value = ''
  },
  onError: (code) => {
    interim.value = ''
    const tip = SPEECH_ERROR_MAP[code] ?? '语音没听清，请再试一次'
    if (!tip) return
    // 权限类错误：toast 停留 5 秒，并亮出常驻解锁指引
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      micBlocked.value = true
      ElMessage.warning({ message: tip, duration: 5000 })
    } else {
      ElMessage.warning(tip)
    }
  },
})

/** 点麦克风直接普通话（zh-CN）识别；录音中再点结束。与 AI 悬浮面板完全一致，不再设方言下拉 */
function toggleMic(): void {
  if (listening.value) {
    stop()
    interim.value = ''
    return
  }
  if (!supported) {
    micBlocked.value = true
    ElMessage.warning({
      message: '当前浏览器不支持语音输入，请用 Chrome 或 Edge 打开',
      duration: 5000,
    })
    return
  }
  const ok = start('zh-CN')
  if (!ok) {
    micBlocked.value = true
    ElMessage.warning({ message: '麦克风没有启动，请检查浏览器权限设置', duration: 5000 })
  }
}

function stopListening(): void {
  stop()
  interim.value = ''
}

onBeforeUnmount(() => {
  stop()
})

/* ---------- 附件 ---------- */
function genAttId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function isImageFile(file: File): boolean {
  return (
    /^image\/(jpeg|png|webp|gif)$/i.test(file.type) || /\.(jpe?g|png|webp|gif)$/i.test(file.name)
  )
}

function isTextFile(file: File): boolean {
  return /\.(txt|md)$/i.test(file.name) || /^text\/(plain|markdown)$/i.test(file.type)
}

function readAs(blob: Blob, method: 'readAsDataURL' | 'readAsText'): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    if (method === 'readAsDataURL') reader.readAsDataURL(blob)
    else reader.readAsText(blob)
  })
}

/* ---------- 图片隐私授权（全局只问一次） ---------- */
function hasImageConsent(): boolean {
  try {
    return window.localStorage.getItem(IMAGE_CONSENT_KEY) === '1'
  } catch {
    return false
  }
}

function saveImageConsent(): void {
  try {
    window.localStorage.setItem(IMAGE_CONSENT_KEY, '1')
  } catch {
    // 隐私模式等写入失败：本次已获口头同意，照常继续，下次再问
  }
}

/**
 * 首次点图片附件：先弹隐私授权。
 * 同意 → 写全局键并打开图片选择；拒绝（关闭/点“再想想”）→ 不打开文件选择。
 */
async function pickImage(): Promise<void> {
  if (props.sending) return
  if (!hasImageConsent()) {
    try {
      await ElMessageBox.confirm(
        '照片会发给 AI 营养师帮您看，不会公开给别人。还要继续吗？',
        '使用照片前问您一句',
        {
          confirmButtonText: '继续',
          cancelButtonText: '再想想',
          type: 'warning',
          closeOnClickModal: false,
        },
      )
    } catch {
      return
    }
    saveImageConsent()
  }
  imageInputEl.value?.click()
}

function pickTextFile(): void {
  if (props.sending) return
  fileInputEl.value?.click()
}

async function addFile(file: File): Promise<void> {
  if (isImageFile(file)) {
    const imageCount = attachments.value.filter((a) => a.kind === 'image').length
    if (imageCount >= MAX_IMAGE_COUNT) {
      ElMessage.warning(`最多只能发 ${MAX_IMAGE_COUNT} 张图片`)
      return
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      ElMessage.warning(`每张图片不能超过 ${MAX_IMAGE_MB}MB，「${file.name}」太大了`)
      return
    }
    try {
      // 入附件前统一压缩（最长边 1024、JPEG 0.8、EXIF 校正）；压缩失败回退原图，不阻断流程
      let blob: Blob = file
      try {
        blob = await prepareMealImage(file)
      } catch {
        blob = file
      }

      const usedBytes = attachments.value
        .filter((a) => a.kind === 'image')
        .reduce((sum, a) => sum + a.size, 0)
      if (usedBytes + blob.size > MAX_TOTAL_IMAGE_BYTES) {
        ElMessage.warning('图片加起来太大了，请删掉一张或换张小一点的再发')
        return
      }

      const dataUrl = await readAs(blob, 'readAsDataURL')
      attachments.value.push({
        id: genAttId(),
        kind: 'image',
        name: file.name,
        mimeType: blob.type || file.type || 'image/jpeg',
        size: blob.size,
        dataUrl,
      })
    } catch {
      ElMessage.warning('图片读不出来，请换一张试试')
    }
    return
  }

  if (isTextFile(file)) {
    if (file.size > MAX_TEXT_FILE_KB * 1024) {
      ElMessage.warning(`文字文件不能超过 ${MAX_TEXT_FILE_KB}KB，「${file.name}」太大了`)
      return
    }
    try {
      const content = await readAs(file, 'readAsText')
      const att: AiAttachment = {
        id: genAttId(),
        kind: 'file',
        name: file.name,
        mimeType: file.type || 'text/plain',
        size: file.size,
      }
      attachments.value.push(att)
      fileTexts.value[att.id] = content
    } catch {
      ElMessage.warning('文件读不出来，请换一个试试')
    }
    return
  }

  ElMessage.warning('目前支持图片和 txt/md 文字文件')
}

async function onFilesChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  for (const file of files) {
    // 逐个校验，保证超限文件之外的图片/文件仍能正常加入
    await addFile(file)
  }
}

function removeAtt(id: string): void {
  attachments.value = attachments.value.filter((a) => a.id !== id)
  delete fileTexts.value[id]
}

function formatKb(size: number): string {
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

/* ---------- 输入框 ---------- */
const displayText = computed(() => {
  if (!interim.value) return text.value
  const sep = text.value && !/\s$/.test(text.value) ? ' ' : ''
  return text.value + sep + interim.value
})

async function autoResize(): Promise<void> {
  await nextTick()
  const el = textareaEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 180)}px`
}

function onInput(event: Event): Promise<void> | void {
  const el = event.target as HTMLTextAreaElement
  let value = el.value
  // 语音 interim 只是临时尾巴，手动输入时把它从已确定文本里剥掉
  if (interim.value) {
    const sep = text.value && !/\s$/.test(text.value) ? ' ' : ''
    const suffix = sep + interim.value
    if (value.endsWith(suffix)) value = value.slice(0, value.length - suffix.length)
  }
  text.value = value
  return autoResize()
}

const canSend = computed(
  () => !props.sending && (text.value.trim().length > 0 || attachments.value.length > 0),
)

function doSend(): void {
  if (props.sending) return
  const content = text.value.trim()
  if (!content && attachments.value.length === 0) return
  if (listening.value) stop()
  emit('send', {
    text: content,
    attachments: attachments.value,
    fileTexts: { ...fileTexts.value },
  })
  text.value = ''
  interim.value = ''
  attachments.value = []
  fileTexts.value = {}
  void autoResize()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !composing.value) {
    event.preventDefault()
    doSend()
  }
}
</script>

<template>
  <div class="composer">
    <div class="composer__inner">
      <!-- 已选附件 -->
      <div v-if="attachments.length" class="composer__atts">
        <div v-for="att in attachments" :key="att.id" class="composer__att">
          <template v-if="att.kind === 'image'">
            <img v-if="att.dataUrl" class="composer__att-img" :src="att.dataUrl" :alt="att.name" />
            <span v-else class="composer__att-file-icon"
              ><el-icon><Picture /></el-icon
            ></span>
          </template>
          <template v-else>
            <span class="composer__att-file-icon"
              ><el-icon><Document /></el-icon
            ></span>
            <span class="composer__att-name">{{ att.name }}</span>
            <span class="composer__att-size">{{ formatKb(att.size) }}</span>
          </template>
          <button
            type="button"
            class="composer__att-remove"
            :aria-label="`移除附件 ${att.name}`"
            @click="removeAtt(att.id)"
          >
            <el-icon><CircleClose /></el-icon>
          </button>
        </div>
      </div>

      <!-- 语音状态：文案/视觉与 AI 悬浮面板一致 -->
      <p v-if="listening" class="composer__listening" aria-live="polite">
        <span class="composer__listening-dot" aria-hidden="true"></span>
        正在听您说普通话…（点我说完了）
      </p>

      <div class="composer__bar">
        <!-- 图片按钮：首次使用先弹隐私授权，同意后才打开文件选择 -->
        <button
          type="button"
          class="composer__icon-btn"
          aria-label="添加图片"
          title="发一张饭菜照片给 AI 看"
          :disabled="sending"
          @click="pickImage"
        >
          <el-icon :size="22" aria-hidden="true"><Picture /></el-icon>
        </button>
        <input
          ref="imageInputEl"
          type="file"
          class="composer__file-input"
          multiple
          :accept="ACCEPT_IMAGE"
          @change="onFilesChange"
        />

        <!-- 文字文件按钮：txt / md，无需图片授权 -->
        <button
          type="button"
          class="composer__icon-btn"
          aria-label="添加 txt 或 md 文字文件"
          title="添加 txt/md 文字文件"
          :disabled="sending"
          @click="pickTextFile"
        >
          <el-icon :size="22" aria-hidden="true"><Document /></el-icon>
        </button>
        <input
          ref="fileInputEl"
          type="file"
          class="composer__file-input"
          multiple
          :accept="ACCEPT_TEXT"
          @change="onFilesChange"
        />

        <!-- 自适应输入框：Enter 发送 / Shift+Enter 换行 -->
        <textarea
          id="ai-question-input"
          ref="textareaEl"
          name="aiQuestion"
          class="composer__textarea"
          rows="1"
          :value="displayText"
          placeholder="问问吃什么、血压怎么管，或这个软件怎么用"
          aria-label="输入要问 AI 营养师的话"
          @input="onInput"
          @keydown="onKeydown"
          @compositionstart="composing = true"
          @compositionend="composing = false"
        ></textarea>

        <!-- 麦克风：点击直接普通话识别，录音中为红色脉动停止键（与悬浮面板一致，无方言下拉） -->
        <button
          type="button"
          class="composer__mic"
          :class="{ 'is-recording': listening }"
          :aria-label="listening ? '正在听，点我说完了' : '点我用普通话说话'"
          :title="listening ? '点我说完了' : '普通话语音输入'"
          @click="listening ? stopListening() : toggleMic()"
        >
          <el-icon :size="22" aria-hidden="true"><Microphone /></el-icon>
        </button>

        <!-- 发送 / 停止 -->
        <button
          v-if="sending"
          type="button"
          class="composer__stop"
          aria-label="停止生成"
          @click="emit('stop')"
        >
          <el-icon :size="20" aria-hidden="true"><VideoPause /></el-icon>
          <span>停止</span>
        </button>
        <button
          v-else
          type="button"
          class="composer__send"
          aria-label="发送"
          :disabled="!canSend"
          @click="doSend"
        >
          <el-icon :size="22" aria-hidden="true"><Promotion /></el-icon>
        </button>
      </div>

      <!-- 麦克风被拒 / 不支持时常驻的解锁指引（与悬浮面板同一文案，125% 下仍可读） -->
      <p v-if="micBlocked" class="composer__mic-blocked">
        <el-icon class="composer__mic-blocked-icon" aria-hidden="true"><Lock /></el-icon>
        <span>说不了话？点浏览器地址栏左边的锁形图标，把麦克风改成允许，再刷新页面</span>
      </p>

      <p class="composer__hint">说普通话就行，带家乡口音也可以试试。内容仅供参考，急症请拨120。</p>
    </div>
  </div>
</template>

<style scoped src="./AiComposer.css"></style>
