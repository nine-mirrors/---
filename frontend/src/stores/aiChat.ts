// AI 独立页会话 store：多会话 + 消息/反馈持久化（nsRead/nsWrite，按 uid 隔离）
// 附件 dataUrl 仅内存态，persist 前深拷贝剥离，保护 localStorage 容量。

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { recordAiFeedback } from '@/api/ai'
import { AI_CHATS_BASE, AI_FEEDBACK_BASE } from '@/constants/ai'
import { nsRead, nsWrite } from '@/utils/storage'
import type { AiConversation, AiFeedback, AiFeedbackRecord, ChatMessage } from '@/types/ai'

/** 持久化失败每会话只提示一次，避免连发消息连弹 */
let storageWarned = false
function warnStorageFull(): void {
  if (storageWarned) return
  storageWarned = true
  console.warn('[aiChat] localStorage 持久化失败，刷新后内容可能丢失')
  try {
    ElMessage.warning({
      message: '手机存储空间可能满了，新的对话刷新后可能丢失，请清理一点空间。',
      duration: 5000,
    })
  } catch {
    /* ElMessage 不可用时静默 */
  }
}

/** nsWrite 失败不炸交互（内存态仍在），转为一次性人话提示 */
function safeNsWrite<T>(base: string, value: T): void {
  try {
    nsWrite(base, value)
  } catch {
    warnStorageFull()
  }
}

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

export const useAiChatStore = defineStore('aiChat', () => {
  const conversations = ref<AiConversation[]>([])
  const currentId = ref('')
  const loaded = ref(false)

  const current = computed<AiConversation | null>(
    () => conversations.value.find((c) => c.id === currentId.value) ?? null,
  )

  /** 深拷贝后剥离所有附件 dataUrl，再落 localStorage */
  function persist(): void {
    const clone = JSON.parse(JSON.stringify(conversations.value)) as AiConversation[]
    for (const conv of clone) {
      for (const msg of conv.messages) {
        msg.attachments?.forEach((att) => {
          delete att.dataUrl
        })
      }
    }
    safeNsWrite<AiConversation[]>(AI_CHATS_BASE, clone)
  }

  function newConversation(): AiConversation {
    const now = nowIso()
    const conv: AiConversation = {
      id: genId(),
      title: '',
      messages: [],
      createdAt: now,
      updatedAt: now,
    }
    conversations.value.unshift(conv)
    currentId.value = conv.id
    persist()
    return conv
  }

  /** 从 localStorage 恢复；有 loaded 守卫，重复调用不重复读 */
  function restore(): void {
    if (loaded.value) return
    const saved = nsRead<AiConversation[]>(AI_CHATS_BASE)
    if (Array.isArray(saved) && saved.length > 0) {
      conversations.value = saved
      currentId.value = saved[0]?.id ?? ''
    } else {
      conversations.value = []
      currentId.value = ''
    }
    if (!currentId.value) newConversation()
    loaded.value = true
  }

  /** 写操作统一入口：确保已 restore 且当前会话存在，返回当前会话 */
  function ensureCurrent(): AiConversation {
    restore()
    const found = conversations.value.find((c) => c.id === currentId.value)
    if (found) return found
    return conversations.value[0] ?? newConversation()
  }

  function selectConversation(id: string): void {
    restore()
    if (conversations.value.some((c) => c.id === id)) currentId.value = id
  }

  /** 删除会话；删的是当前会话时自动新建空会话 */
  function deleteConversation(id: string): void {
    restore()
    const idx = conversations.value.findIndex((c) => c.id === id)
    if (idx === -1) return
    conversations.value.splice(idx, 1)
    if (currentId.value === id) {
      if (conversations.value.length > 0) currentId.value = conversations.value[0].id
      else newConversation()
    }
    persist()
  }

  /**
   * 追加一条消息（自动补 id/createdAt、更新 updatedAt、首条 user 消息前 16 字做标题）
   * convId 找不到时容错写入当前会话
   */
  function addMessage(convId: string, msg: Omit<ChatMessage, 'id' | 'createdAt'>): ChatMessage {
    const conv = conversations.value.find((c) => c.id === convId) ?? ensureCurrent()
    const full: ChatMessage = { ...msg, id: genId(), createdAt: nowIso() }
    conv.messages.push(full)
    conv.updatedAt = full.createdAt
    if (!conv.title && full.role === 'user' && full.content) {
      conv.title = full.content.slice(0, 16)
    }
    persist()
    return full
  }

  function patchMessage(convId: string, msgId: string, patch: Partial<ChatMessage>): void {
    const conv = conversations.value.find((c) => c.id === convId) ?? ensureCurrent()
    const msg = conv.messages.find((m) => m.id === msgId)
    if (msg) Object.assign(msg, patch)
    persist()
  }

  /** 点赞/点踩；再点同值取消为 null。同步落本地反馈表，fire-and-forget 上报，不阻塞 UI */
  function setFeedback(convId: string, msgId: string, feedback: AiFeedback): void {
    const conv = conversations.value.find((c) => c.id === convId) ?? ensureCurrent()
    const idx = conv.messages.findIndex((m) => m.id === msgId)
    if (idx === -1) return
    const msg = conv.messages[idx]
    const next: AiFeedback | null = msg.feedback === feedback ? null : feedback
    msg.feedback = next
    persist()

    const records = nsRead<AiFeedbackRecord[]>(AI_FEEDBACK_BASE) ?? []
    const recIdx = records.findIndex((r) => r.conversationId === conv.id && r.messageId === msgId)
    if (next === null) {
      if (recIdx !== -1) records.splice(recIdx, 1)
      safeNsWrite(AI_FEEDBACK_BASE, records)
      return
    }

    // question=本条 assistant 消息之前最近一条 user 消息
    let question = ''
    for (let i = idx - 1; i >= 0; i -= 1) {
      if (conv.messages[i].role === 'user') {
        question = conv.messages[i].content
        break
      }
    }
    const record: AiFeedbackRecord = {
      id: recIdx !== -1 ? records[recIdx].id : genId(),
      conversationId: conv.id,
      messageId: msgId,
      question,
      answer: msg.content,
      feedback: next,
      at: nowIso(),
    }
    if (recIdx !== -1) records[recIdx] = record
    else records.push(record)
    safeNsWrite(AI_FEEDBACK_BASE, records)

    void recordAiFeedback(record).catch((err) => console.warn('[aiChat] 反馈上报失败', err))
  }

  return {
    conversations,
    currentId,
    loaded,
    current,
    restore,
    newConversation,
    selectConversation,
    deleteConversation,
    ensureCurrent,
    addMessage,
    patchMessage,
    setFeedback,
  }
})
