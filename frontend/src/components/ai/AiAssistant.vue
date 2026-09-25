<script setup lang="ts">
// AI 营养师悬浮球 + 聊天面板
// - 登录/引导页不渲染（由 App.vue v-if 控制）；消息仅会话内保留，刷新即清空；
// - 每次发问经 @/utils/aiChat 的 readAiContext 现场读上下文，拼到 system prompt，禁止本地再抄一份；
// - 真实/Mock 由 src/api/ai.ts 按 VITE_USE_MOCK 决定，错误一律转中文并可"再试一次"；
// - 气泡里的“拨打 120”急症语境由 aiSafety.renderAiRichText 渲染为 tel:120 链接，严禁 v-html。
// - 首次访问只在悬浮球旁显示 8 秒小气泡引导（ndh_ai_bubble_seen_v1），不再自动展开大面板。

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type VNodeChild } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ChatDotRound,
  Close,
  Lock,
  Microphone,
  Promotion,
  RefreshRight,
  VideoPause,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { chatWithAi } from '@/api/ai'
import { buildSystemPrompt } from '@/utils/aiPrompt'
import { readAiContext } from '@/utils/aiChat'
import { renderAiRichText } from '@/utils/aiSafety'
import { useSpeechRecognition } from '@/composables/useSpeechRecognition'
import { useSpeech, requestSpeak } from '@/composables/useSpeech'
import type { AiMessage } from '@/types/ai'

/** 气泡消息：只含老人与 AI 的对话，system prompt 不进消息流 */
interface UiMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * assistant 气泡正文：统一走 aiSafety 的安全迷你 markdown（h() VNode，严禁 v-html）。
 * “拨打 120”急症语境由 renderAiRichText(linkify120) 渲染为 tel:120 链接，本组件不再自留正则。
 */
const AssistantRich = (props: { content: string }): VNodeChild =>
  renderAiRichText(props.content, { linkify120: true })

/** 首次引导气泡：全局 localStorage 键（气泡消失/点球打开面板后写入） */
const BUBBLE_SEEN_KEY = 'ndh_ai_bubble_seen_v1'

/** 首次引导气泡停留时长：8 秒 */
const COACH_VISIBLE_MS = 8000

const QUICK_QUESTIONS = ['这顿饭太咸怎么办', '今晚吃什么好', '血压高要少吃什么', '这个软件怎么用']

const WELCOME =
  '您好，我是您的AI营养师。吃咸了、血压高、不知道吃啥、软件不会用，都可以点下面的问题问我。'

const route = useRoute()
const router = useRouter()

// /ai 是全屏完整对话页：该页面不渲染悬浮球与面板
const hidden = computed(() => route.path === '/ai')

const open = ref(false)
const input = ref('')
const sending = ref(false)
const errorMsg = ref('')
const greeted = ref(false)
const messages = ref<UiMessage[]>([])

const listEl = ref<HTMLElement | null>(null)
const closeBtnEl = ref<HTMLButtonElement | null>(null)

/* ---------- AI 回答朗读：面板内共用一个朗读实例，记录正在读第几条 ---------- */
const {
  supported: speechSupported,
  speaking: speechSpeaking,
  speak: speechPlay,
  stop: speechStop,
} = useSpeech()
const speakingIdx = ref<number | null>(null)

watch(speechSpeaking, (on) => {
  if (!on) speakingIdx.value = null
})

function toggleReadAloud(index: number, content: string): void {
  if (speechSpeaking.value && speakingIdx.value === index) {
    speechStop()
    return
  }
  speakingIdx.value = index
  void requestSpeak(
    { supported: speechSupported, speaking: speechSpeaking, speak: speechPlay, stop: speechStop },
    content,
    { rate: 0.9, lang: 'zh-CN' },
  )
}

/* ---------- 麦克风：直接普通话，不设方言二级菜单 ---------- */
const MIC_ERROR_MAP: Record<string, string> = {
  'not-allowed': '请在浏览器设置里允许使用麦克风',
  'service-not-allowed': '请在浏览器设置里允许使用麦克风',
  'no-speech': '没听到声音，请再试一次',
  network: '语音识别需要联网，请检查网络',
  'audio-capture': '没有检测到麦克风，请检查设备后再试',
  // 主动 stop 触发，不提示
  aborted: '',
}

const micInterim = ref('')
/** 曾被拒绝权限 / 浏览器不支持：toast 之外，在麦克风下方常驻一行操作指引 */
const micBlocked = ref(false)
const {
  supported: micSupported,
  listening: micListening,
  start: startMic,
  stop: stopMic,
} = useSpeechRecognition({
  onResult: (result) => {
    if (result.final) {
      const t = result.text
      input.value = input.value ? `${input.value.replace(/\s+$/, '')} ${t} ` : `${t} `
      micInterim.value = ''
    } else {
      micInterim.value = result.text
    }
  },
  onEnd: () => {
    micInterim.value = ''
  },
  onError: (code) => {
    micInterim.value = ''
    const tip = MIC_ERROR_MAP[code] ?? '语音没听清，请再试一次'
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

function toggleMic(): void {
  if (micListening.value) {
    stopMic()
    micInterim.value = ''
    return
  }
  if (!micSupported) {
    micBlocked.value = true
    ElMessage.warning({
      message: '当前浏览器不支持语音输入，请用 Chrome 或 Edge 打开',
      duration: 5000,
    })
    return
  }
  const ok = startMic('zh-CN')
  if (!ok) {
    micBlocked.value = true
    ElMessage.warning({ message: '麦克风没有启动，请检查浏览器权限设置', duration: 5000 })
  }
}

async function scrollToBottom(): Promise<void> {
  await nextTick()
  const el = listEl.value
  if (el) el.scrollTop = el.scrollHeight
}

function ask(question: string): void {
  const content = question.trim()
  if (!content || sending.value) return

  if (micListening.value) stopMic()
  errorMsg.value = ''
  messages.value.push({ role: 'user', content })
  input.value = ''
  sending.value = true
  void scrollToBottom()

  ;(async () => {
    try {
      const ctx = await readAiContext()
      const payload: AiMessage[] = [
        { role: 'system', content: buildSystemPrompt(ctx) },
        ...messages.value,
      ]
      const reply = await chatWithAi(payload)
      messages.value.push({ role: 'assistant', content: reply })
    } catch (err) {
      errorMsg.value = err instanceof Error ? err.message : 'AI 暂时连不上，请稍后再试'
    } finally {
      sending.value = false
      void scrollToBottom()
    }
  })()
}

function sendInput(): void {
  ask(input.value)
}

function askQuick(question: string): void {
  ask(question)
}

/** 失败重发：撤掉最后一条用户气泡后用原内容重新提问，避免气泡重复 */
function retry(): void {
  if (sending.value) return
  for (let i = messages.value.length - 1; i >= 0; i -= 1) {
    if (messages.value[i].role === 'user') {
      const [lastUser] = messages.value.splice(i, 1)
      ask(lastUser.content)
      return
    }
  }
}

function hasSeenBubble(): boolean {
  try {
    return window.localStorage.getItem(BUBBLE_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function markBubbleSeen(): void {
  try {
    window.localStorage.setItem(BUBBLE_SEEN_KEY, '1')
  } catch {
    // 隐私模式写不进就不记住，不影响使用
  }
}

/** 首次访问：悬浮球旁的小气泡引导（不再自动展开 70vh 大面板） */
const showCoach = ref(false)
let coachTimer: ReturnType<typeof setTimeout> | null = null

/* ---------- 悬浮球拖拽：可移动、松手吸附左右边缘、位置跨会话记忆 ---------- */
/** 位置持久化键（全局，与演示账号无关） */
const FAB_POS_KEY = 'ndh_ai_fab_pos_v1'
/** 距屏幕边缘的留白（与默认 right:12 视觉一致） */
const EDGE_GAP = 12
/** 位移不超过该阈值仍视为点击，避免老人手指轻微抖动就打不开面板 */
const DRAG_THRESHOLD = 8
/** 窄屏底部需让开的 tabbar 高度（与 CSS var(--tabbar-height) 兜底一致） */
const TABBAR_RESERVE = 76

const fabEl = ref<HTMLButtonElement | null>(null)
/** 一旦用户拖过（或读到已存位置），改用 left/top 定位，置空则回退默认 right/bottom */
const fabStyle = ref<{ left: string; top: string } | null>(null)
/** 吸附在哪一侧：决定"问 AI"胶囊在球的哪一边，保证始终圆球贴边 */
const fabEdge = ref<'left' | 'right'>('right')
const dragging = ref(false)
/** pointerup 判定为拖拽后，抑制浏览器补发的 click，防止拖完意外打开面板 */
let suppressClick = false

interface DragState {
  pointerId: number
  startX: number
  startY: number
  originLeft: number
  originTop: number
  moved: boolean
}
let drag: DragState | null = null

function readFabPos(): { left?: unknown; top?: unknown } | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(FAB_POS_KEY) || 'null') as unknown
    if (raw && typeof raw === 'object') return raw as { left?: unknown; top?: unknown }
  } catch {
    // 读不到就用默认位置
  }
  return null
}

/** 把期望位置限制在可视区内（窄屏底部避开 tabbar） */
function clampFab(left: number, top: number): { left: number; top: number } {
  const width = fabEl.value?.offsetWidth ?? 120
  const height = fabEl.value?.offsetHeight ?? 56
  // 与 BottomTab 断点一致：<1200px 底部有 tabbar，悬浮球需要避让
  const bottomReserve = window.innerWidth < 1200 ? TABBAR_RESERVE : EDGE_GAP
  const maxTop = Math.max(EDGE_GAP, window.innerHeight - height - bottomReserve)
  return {
    left: Math.min(
      Math.max(left, EDGE_GAP),
      Math.max(EDGE_GAP, window.innerWidth - width - EDGE_GAP),
    ),
    top: Math.min(Math.max(top, EDGE_GAP), maxTop),
  }
}

function applyFabPos(left: number, top: number): void {
  const clamped = clampFab(left, top)
  fabStyle.value = { left: `${Math.round(clamped.left)}px`, top: `${Math.round(clamped.top)}px` }
  const width = fabEl.value?.offsetWidth ?? 120
  fabEdge.value = clamped.left + width / 2 < window.innerWidth / 2 ? 'left' : 'right'
}

function onFabPointerDown(event: PointerEvent): void {
  if (!fabEl.value || event.button !== 0) return
  const rect = fabEl.value.getBoundingClientRect()
  drag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originLeft: rect.left,
    originTop: rect.top,
    moved: false,
  }
  try {
    fabEl.value.setPointerCapture(event.pointerId)
  } catch {
    // 个别旧内核不支持 pointer capture：拖拽逻辑仍可在文档流事件下工作
  }
}

function onFabPointerMove(event: PointerEvent): void {
  if (!drag || event.pointerId !== drag.pointerId) return
  const dx = event.clientX - drag.startX
  const dy = event.clientY - drag.startY
  if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
  if (!drag.moved) {
    drag.moved = true
    dragging.value = true
    // 球被拖走后，固定在右下角的首次引导气泡失去指向，直接结束引导
    dismissCoach()
  }
  applyFabPos(drag.originLeft + dx, drag.originTop + dy)
}

function finishFabDrag(event: PointerEvent): void {
  if (!drag || event.pointerId !== drag.pointerId) return
  const wasMoved = drag.moved
  drag = null
  dragging.value = false
  if (fabEl.value) {
    try {
      fabEl.value.releasePointerCapture(event.pointerId)
    } catch {
      // 未持有 capture 时忽略
    }
  }
  if (!wasMoved || !fabEl.value) return

  suppressClick = true
  // 松手后吸附到较近一侧的左/右边缘，竖向保持落点
  const rect = fabEl.value.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const targetLeft =
    centerX < window.innerWidth / 2 ? EDGE_GAP : window.innerWidth - rect.width - EDGE_GAP
  const clamped = clampFab(targetLeft, rect.top)
  applyFabPos(clamped.left, clamped.top)
  try {
    window.localStorage.setItem(FAB_POS_KEY, JSON.stringify(clamped))
  } catch {
    // 隐私模式记不住也不影响本次使用
  }
}

/** 点击与拖拽共用入口：只有"没发生拖拽"的点击才打开面板 */
function onFabClick(): void {
  if (suppressClick) {
    suppressClick = false
    return
  }
  openPanel()
}

/** 窗口尺寸变化（旋转屏 / 拖窗）时把记忆位置重新夹回可视区 */
function handleWindowResize(): void {
  if (!fabStyle.value || !fabEl.value) return
  const rect = fabEl.value.getBoundingClientRect()
  applyFabPos(rect.left, rect.top)
}

function clearCoachTimer(): void {
  if (coachTimer !== null) {
    clearTimeout(coachTimer)
    coachTimer = null
  }
}

/** 关闭首次引导气泡并记住：8 秒自动消失、点关闭、点球打开面板都会调用 */
function dismissCoach(): void {
  if (!showCoach.value && coachTimer === null) return
  showCoach.value = false
  clearCoachTimer()
  markBubbleSeen()
}

function openPanel(shouldFocus = true): void {
  if (!greeted.value) {
    messages.value.push({ role: 'assistant', content: WELCOME })
    greeted.value = true
  }
  open.value = true
  // 用户点球进入面板：引导气泡完成使命，立即消失并记住
  dismissCoach()
  void nextTick(() => {
    if (shouldFocus) closeBtnEl.value?.focus()
    void scrollToBottom()
  })
}

function closePanel(): void {
  open.value = false
  // 关面板同时停止朗读，避免人走了声音还在读
  speechStop()
  // 用户关过一次面板，本设备以后也不再弹引导
  markBubbleSeen()
}

/** 跳转到全屏完整对话页（跳转后本组件因 v-if 卸载，面板自然消失） */
function openFullPage(): void {
  void router.push('/ai')
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) {
    event.stopPropagation()
    closePanel()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onDocumentKeydown)
  // 首次访问（全局键不存在）：只在悬浮球旁显示 8 秒小气泡引导，不再自动展开大面板
  if (!hidden.value && !hasSeenBubble()) {
    showCoach.value = true
    coachTimer = setTimeout(dismissCoach, COACH_VISIBLE_MS)
  }
  // 恢复上次拖拽后的悬浮球位置（DOM 渲染后读取尺寸做边界校正）
  const saved = readFabPos()
  if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
    void nextTick(() => applyFabPos(saved.left as number, saved.top as number))
  }
  window.addEventListener('resize', handleWindowResize)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocumentKeydown)
  window.removeEventListener('resize', handleWindowResize)
  clearCoachTimer()
  stopMic()
})
</script>

<template>
  <!-- 首次访问小气泡引导：悬浮球旁显示，8 秒自动消失 / 点关闭 / 点球进入面板后消失 -->
  <transition name="ai-coach-fade">
    <div v-if="!hidden && !open && showCoach" class="ai-coach" role="status">
      <p class="ai-coach__text">想问今晚吃什么？点我就行</p>
      <button type="button" class="ai-coach__close" aria-label="关闭这条提示" @click="dismissCoach">
        <el-icon :size="18" aria-hidden="true"><Close /></el-icon>
      </button>
    </div>
  </transition>

  <!-- 右下角悬浮球：56px 圆球 + 右侧浅底“问 AI”文字胶囊（所有断点都显示文字，
       极窄屏缩短为“问AI”）；z-index 低于 el-dialog(2000+)。整体一个按钮，整块可点 -->
  <button
    v-if="!hidden && !open"
    ref="fabEl"
    type="button"
    class="ai-fab"
    :class="[`is-edge-${fabEdge}`, { 'is-placed': !!fabStyle, 'is-dragging': dragging }]"
    :style="fabStyle ?? undefined"
    aria-label="AI 营养师，有问题点这里问；按住可拖动位置"
    @pointerdown="onFabPointerDown"
    @pointermove="onFabPointerMove"
    @pointerup="finishFabDrag"
    @pointercancel="finishFabDrag"
    @click="onFabClick"
  >
    <span class="ai-fab__ball">
      <el-icon :size="28" aria-hidden="true"><ChatDotRound /></el-icon>
    </span>
    <span class="ai-fab__label">
      <span class="ai-fab__label-full">问 AI</span>
      <span class="ai-fab__label-short">问AI</span>
    </span>
  </button>

  <transition name="ai-pop">
    <section v-if="!hidden && open" class="ai-panel" role="dialog" aria-label="AI 营养师对话窗口">
      <header class="ai-panel__header">
        <div class="ai-panel__heading">
          <p class="ai-panel__title">AI 营养师</p>
          <p class="ai-panel__subtitle">不懂就问我</p>
        </div>
        <div class="ai-panel__header-actions">
          <button type="button" class="ai-panel__fullpage" @click="openFullPage">完整页面 ⇒</button>
          <button
            ref="closeBtnEl"
            type="button"
            class="ai-panel__close"
            aria-label="关闭对话"
            @click="closePanel"
          >
            <el-icon :size="22" aria-hidden="true"><Close /></el-icon>
          </button>
        </div>
      </header>

      <div ref="listEl" class="ai-panel__messages" aria-live="polite">
        <div
          v-for="(message, index) in messages"
          :key="index"
          class="ai-msg"
          :class="message.role === 'user' ? 'is-user' : 'is-ai'"
        >
          <!-- assistant 正文走 aiSafety 安全迷你 markdown（仅 tel:120 急症链接，禁 v-html）；
               user 气泡整段纯文本 -->
          <div class="ai-msg__bubble">
            <AssistantRich v-if="message.role === 'assistant'" :content="message.content" />
            <template v-else>{{ message.content }}</template>
          </div>
          <!-- AI 回答可朗读：正在读的那条显示"停止朗读" -->
          <div v-if="message.role === 'assistant'" class="ai-msg__tools">
            <button
              type="button"
              class="ai-msg__speak"
              :class="{ 'is-on': speechSpeaking && speakingIdx === index }"
              :aria-label="speechSpeaking && speakingIdx === index ? '停止朗读' : '朗读这条回答'"
              @click="toggleReadAloud(index, message.content)"
            >
              <el-icon aria-hidden="true"
                ><VideoPause v-if="speechSpeaking && speakingIdx === index" /><Microphone v-else
              /></el-icon>
              <span>{{ speechSpeaking && speakingIdx === index ? '停止朗读' : '朗读' }}</span>
            </button>
          </div>
        </div>

        <div v-if="sending" class="ai-msg is-ai">
          <p class="ai-msg__bubble ai-msg__typing" role="status" aria-live="polite">
            <span class="ai-msg__typing-text">AI 正在想</span>
            <span class="ai-msg__typing-dots" aria-hidden="true"><i></i><i></i><i></i></span>
          </p>
        </div>

        <div v-if="errorMsg" class="ai-error" role="alert">
          <p class="ai-error__text">{{ errorMsg }}</p>
          <button type="button" class="ai-error__btn" @click="retry">
            <el-icon aria-hidden="true"><RefreshRight /></el-icon>
            <span>再试一次</span>
          </button>
        </div>
      </div>

      <div class="ai-panel__chips" role="group" aria-label="常见问题，点一下直接问">
        <button
          v-for="question in QUICK_QUESTIONS"
          :key="question"
          type="button"
          class="ai-chip"
          :disabled="sending"
          @click="askQuick(question)"
        >
          {{ question }}
        </button>
      </div>

      <!-- 普通话语音输入：点击直接开始，录音中再点结束，不设方言二级菜单 -->
      <p v-if="micListening" class="ai-panel__mic-hint" aria-live="polite">
        <span class="ai-panel__mic-dot" aria-hidden="true"></span>
        正在听您说普通话…{{ micInterim ? `（${micInterim}）` : '' }}
      </p>

      <div class="ai-panel__input-bar">
        <button
          type="button"
          class="ai-panel__mic"
          :class="{ 'is-recording': micListening }"
          :aria-label="micListening ? '正在听，点我说完了' : '点我用普通话说话'"
          :title="micListening ? '点我说完了' : '普通话语音输入'"
          @click="toggleMic"
        >
          <el-icon :size="22" aria-hidden="true"><Microphone /></el-icon>
        </button>
        <el-input
          v-model="input"
          size="large"
          placeholder="写一句话问我，比如：今晚吃什么"
          clearable
          aria-label="输入要问 AI 营养师的话"
          @keydown.enter="sendInput"
        />
        <el-button
          type="primary"
          size="large"
          class="ai-panel__send"
          :disabled="sending || !input.trim()"
          @click="sendInput"
        >
          <el-icon aria-hidden="true"><Promotion /></el-icon>
          <span>发送</span>
        </el-button>
      </div>

      <!-- 麦克风被拒 / 不支持时常驻的解锁指引（小字，125% 下仍可读） -->
      <p v-if="micBlocked" class="ai-panel__mic-blocked">
        <el-icon class="ai-panel__mic-blocked-icon" aria-hidden="true"><Lock /></el-icon>
        <span>说不了话？点浏览器地址栏左边的锁形图标，把麦克风改成允许，再刷新页面</span>
      </p>

      <!-- 常驻免责小字 -->
      <p class="ai-panel__disclaimer">AI 建议仅供参考，不能代替医生诊断</p>
    </section>
  </transition>
</template>

<style scoped src="./AiAssistant.css"></style>
