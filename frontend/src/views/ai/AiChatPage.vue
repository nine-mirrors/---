<script setup lang="ts">
// AI 营养师完整对话页（/ai，全屏无 layout）
// 编排层：会话侧栏 + 消息列 + 输入区；数据全部走 useAiChatStore（按账号本地持久化）。
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Delete, Plus } from '@element-plus/icons-vue'
import { chatWithAi } from '@/api/ai'
import { useAiChatStore } from '@/stores/aiChat'
import { buildRequestMessages, readAiContext } from '@/utils/aiChat'
import { pad2 } from '@/utils/date'
import AiMessageList from './AiMessageList.vue'
import AiComposer from './AiComposer.vue'
import type { AiAttachment, AiFeedback, ChatMessage } from '@/types/ai'

/** 输入区上抛的发送载荷：附件 + 文本文件读出的正文（id -> 文本） */
interface ComposerPayload {
  text: string
  attachments: AiAttachment[]
  fileTexts: Record<string, string>
}

const QUICK_QUESTIONS = ['这顿饭太咸怎么办', '今晚吃什么好', '血压高要少吃什么', '这个软件怎么用']

const router = useRouter()
const store = useAiChatStore()

const sending = ref(false)
const drawerOpen = ref(false)
const scrollEl = ref<HTMLElement | null>(null)
let abortController: AbortController | null = null

const currentConv = computed(() => store.current)
const messages = computed<ChatMessage[]>(() => currentConv.value?.messages ?? [])
const showWelcome = computed(() => messages.value.length === 0)

/** 最后一条 assistant 消息可"重新生成"（发送中/等待中/出错中不显示） */
const lastAssistantId = computed(() => {
  if (sending.value) return ''
  const list = messages.value
  const last = list[list.length - 1]
  return last && last.role === 'assistant' && !last.pending && !last.error ? last.id : ''
})

onMounted(() => {
  store.restore()
  // 上次刷新/关闭时若有请求未完成，残留的 pending 气泡转为失败态，老人可点"重新发送"
  for (const conv of store.conversations) {
    for (const msg of conv.messages) {
      if (msg.pending) store.patchMessage(conv.id, msg.id, { pending: false, error: true })
    }
  }
  store.ensureCurrent()
  void scrollToBottom()
})

watch(
  () => store.currentId,
  () => {
    drawerOpen.value = false
    void scrollToBottom()
  },
)

async function scrollToBottom(): Promise<void> {
  await nextTick()
  const el = scrollEl.value
  if (el) el.scrollTop = el.scrollHeight
}

/** src/utils/date.ts 没有日期时间格式化函数，按约定侧栏只显示 MM-DD */
function formatConvTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function convTitle(title: string): string {
  return title || '新对话'
}

function startNewConversation(): void {
  store.newConversation()
  drawerOpen.value = false
  void scrollToBottom()
}

function selectConversation(id: string): void {
  store.selectConversation(id)
}

function deleteConversation(id: string): void {
  store.deleteConversation(id)
}

function backToApp(): void {
  void router.push('/')
}

/** 文本文件正文在发送前并入消息文本：【文件：name 内容】 */
function composeText(payload: ComposerPayload): string {
  let text = payload.text.trim()
  for (const att of payload.attachments) {
    if (att.kind !== 'file') continue
    const block = `【文件：${att.name} 内容】\n${payload.fileTexts[att.id] ?? ''}`
    text = text ? `${text}\n\n${block}` : block
  }
  return text
}

/**
 * store 未暴露"删除单条消息"接口；setup store 暴露的 conversations 是响应式数组，
 * 可直接 splice，再借 patchMessage（找不到消息也会执行 persist）完成落盘。
 */
function removeMessage(convId: string, msgId: string): void {
  const conv = store.conversations.find((c) => c.id === convId)
  const idx = conv?.messages.findIndex((m) => m.id === msgId) ?? -1
  if (conv && idx !== -1) {
    conv.messages.splice(idx, 1)
    store.patchMessage(convId, msgId, { pending: false })
  }
}

async function sendMessage(payload: ComposerPayload): Promise<void> {
  if (sending.value) return
  const conv = store.ensureCurrent()
  const content = composeText(payload)
  const hasImage = payload.attachments.some((a) => a.kind === 'image')
  if (!content.trim() && !hasImage) return

  store.addMessage(conv.id, {
    role: 'user',
    content,
    attachments: payload.attachments.length ? payload.attachments : undefined,
  })
  drawerOpen.value = false
  await requestAssistant(conv.id)
}

function askQuick(question: string): void {
  void sendMessage({ text: question, attachments: [], fileTexts: {} })
}

/** 追加 pending 气泡并发起请求；用于首次发问与"重新生成" */
async function requestAssistant(convId: string): Promise<void> {
  const pendingMsg = store.addMessage(convId, {
    role: 'assistant',
    content: '',
    pending: true,
  })
  await runAssistantRequest(convId, pendingMsg.id)
}

async function runAssistantRequest(convId: string, pendingMsgId: string): Promise<void> {
  const controller = new AbortController()
  abortController = controller
  sending.value = true
  void scrollToBottom()
  try {
    const ctx = await readAiContext()
    const conv = store.conversations.find((c) => c.id === convId)
    if (!conv) {
      removeMessage(convId, pendingMsgId)
      return
    }
    const reply = await chatWithAi(buildRequestMessages(conv, ctx), controller.signal)
    store.patchMessage(convId, pendingMsgId, { content: reply, pending: false })
  } catch (err) {
    // 用户主动停止：移除等待气泡，不算报错
    if (controller.signal.aborted) {
      removeMessage(convId, pendingMsgId)
    } else {
      store.patchMessage(convId, pendingMsgId, { pending: false, error: true })
      console.warn('[ai-chat] 请求失败', err)
    }
  } finally {
    if (abortController === controller) abortController = null
    sending.value = false
    void scrollToBottom()
  }
}

/** 点"停止"：中止进行中的请求（pending 气泡会在 catch 里移除） */
function stopGenerate(): void {
  abortController?.abort()
}

/** 失败气泡上的"重新发送"：把该气泡变回 pending，用同一 user 问题重发 */
function retryMessage(msg: ChatMessage): void {
  if (sending.value) return
  const conv = store.ensureCurrent()
  store.patchMessage(conv.id, msg.id, { pending: true, error: false, content: '' })
  void runAssistantRequest(conv.id, msg.id)
}

/** 重新生成：删掉最后一条 assistant 回复，用同一 user 问题重新请求 */
function regenerate(msg: ChatMessage): void {
  if (sending.value) return
  const conv = store.ensureCurrent()
  removeMessage(conv.id, msg.id)
  void requestAssistant(conv.id)
}

function onFeedback(msg: ChatMessage, feedback: AiFeedback): void {
  const conv = store.ensureCurrent()
  const cancelling = msg.feedback === feedback
  store.setFeedback(conv.id, msg.id, feedback)
  ElMessage.success(cancelling ? '已取消反馈' : '谢谢您的反馈，会帮我把回答练得更好')
}
</script>

<template>
  <div class="ai-chat" :class="{ 'is-drawer-open': drawerOpen }">
    <!-- 窄屏抽屉遮罩：点击收起侧栏 -->
    <button
      type="button"
      class="ai-chat__mask"
      aria-label="收起会话列表"
      tabindex="-1"
      @click="drawerOpen = false"
    />

    <!-- 左侧会话栏 -->
    <aside class="ai-chat__sidebar" aria-label="历史对话列表">
      <button type="button" class="ai-chat__new" @click="startNewConversation">
        <el-icon aria-hidden="true"><Plus /></el-icon>
        <span>新建对话</span>
      </button>

      <ul class="ai-chat__conv-list">
        <li v-if="store.conversations.length === 0" class="ai-chat__conv-empty">还没有对话</li>
        <li v-for="conv in store.conversations" :key="conv.id">
          <div
            class="ai-chat__conv"
            :class="{ 'is-active': conv.id === store.currentId }"
            role="button"
            tabindex="0"
            @click="selectConversation(conv.id)"
            @keydown.enter="selectConversation(conv.id)"
          >
            <span class="ai-chat__conv-title">{{ convTitle(conv.title) }}</span>
            <span class="ai-chat__conv-time">{{ formatConvTime(conv.updatedAt) }}</span>

            <el-popconfirm
              title="删除这段对话？"
              confirm-button-text="删除"
              cancel-button-text="取消"
              placement="right"
              @confirm="deleteConversation(conv.id)"
            >
              <template #reference>
                <button
                  type="button"
                  class="ai-chat__conv-delete"
                  aria-label="删除这段对话"
                  @click.stop
                >
                  <el-icon :size="18" aria-hidden="true"><Delete /></el-icon>
                </button>
              </template>
            </el-popconfirm>
          </div>
        </li>
      </ul>

      <button type="button" class="ai-chat__back" @click="backToApp">返回应用</button>
    </aside>

    <!-- 主区 -->
    <section class="ai-chat__main">
      <header class="ai-chat__topbar">
        <button
          type="button"
          class="ai-chat__hamburger"
          aria-label="打开会话列表"
          @click="drawerOpen = true"
        >
          <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <div class="ai-chat__heading">
          <h1 class="ai-chat__title">AI 营养师</h1>
          <p class="ai-chat__subtitle">不懂就问我</p>
        </div>
      </header>

      <div ref="scrollEl" class="ai-chat__scroll">
        <!-- 空会话欢迎卡片 -->
        <div v-if="showWelcome" class="ai-chat__welcome">
          <p class="ai-chat__welcome-greeting">您好，我是您的 AI 营养师</p>
          <p class="ai-chat__welcome-desc">
            吃咸了、血压高、不知道吃什么、软件不会用，都可以点下面的问题直接问我。
          </p>
          <div class="ai-chat__suggestions" role="group" aria-label="常见问题，点一下直接问">
            <button
              v-for="question in QUICK_QUESTIONS"
              :key="question"
              type="button"
              class="ai-chat__suggestion"
              :disabled="sending"
              @click="askQuick(question)"
            >
              {{ question }}
            </button>
          </div>
        </div>

        <!-- 消息列 -->
        <div v-else class="ai-chat__messages">
          <AiMessageList
            :messages="messages"
            :last-assistant-id="lastAssistantId"
            @retry="retryMessage"
            @regenerate="regenerate"
            @feedback="onFeedback"
          />
        </div>
      </div>

      <AiComposer :sending="sending" @send="sendMessage" @stop="stopGenerate" />
    </section>
  </div>
</template>

<style scoped src="./ai-chat.css"></style>
