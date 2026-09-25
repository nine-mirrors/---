/**
 * AI 营养师相关类型
 *
 * 对话消息结构对齐 OpenAI Chat Completions 兼容协议：
 * - system：系统提示词（身份、口径、语气）
 * - user：老人提问（可多模态：文本 + 图片）
 * - assistant：AI 回复
 */

import type { HtnStatus } from './index'

/** 对话角色 */
export type AiRole = 'system' | 'user' | 'assistant'

/** 反馈态度：up=赞 / down=踩 */
export type AiFeedback = 'up' | 'down'

/** 附件类型（图片走多模态；文本文件内容由 UI 在发送前并入消息文本） */
export type AiAttachmentKind = 'image' | 'file'

/** 多模态消息分片 */
export interface AiTextPart {
  type: 'text'
  text: string
}

export interface AiImagePart {
  type: 'image_url'
  image_url: {
    url: string
  }
}

export type AiContentPart = AiTextPart | AiImagePart

/** 发往 AI 接口的一条消息；content 为纯文本时可直接传 string（兼容旧调用） */
export interface AiMessage {
  role: AiRole
  content: string | AiContentPart[]
}

/**
 * 用户上传的附件（图片 / 文本文件）。
 * dataUrl 只存在内存里用于预览与当次请求，写入 localStorage 前必须剥离。
 */
export interface AiAttachment {
  id: string
  kind: AiAttachmentKind
  name: string
  mimeType: string
  /** 字节数 */
  size: number
  /** data URL（base64）；仅内存态，持久化前剥离 */
  dataUrl?: string
}

/** 会话内气泡消息（老人 / AI，不含 system prompt） */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  attachments?: AiAttachment[]
  /** up/down，再点同值取消为 null；未评价为 undefined */
  feedback?: AiFeedback | null
  /** 等待 AI 回复中（请求组装时会被过滤） */
  pending?: boolean
  /** 发送失败（请求组装时会被过滤） */
  error?: boolean
}

/** 一段持久化会话 */
export interface AiConversation {
  id: string
  /** 首条 user 消息前 16 字自动生成，之前为空串 */
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

/** 一条点赞/点踩反馈（本地留存一份，同时 fire-and-forget 上报） */
export interface AiFeedbackRecord {
  id: string
  conversationId: string
  messageId: string
  /** 该 assistant 消息之前最近一条 user 消息文本 */
  question: string
  answer: string
  feedback: AiFeedback
  at: string
}

/**
 * 组装系统提示词时使用的用户上下文摘要（从 profile / meals / bpLog store 现场读取）
 */
export interface AiChatContext {
  /** 称呼（可能为空串） */
  name: string
  /** 年龄，画像未填为 null */
  age: number | null
  /** 高血压状态：confirmed/high_risk/mild_risk/none/unsure/null */
  htnStatus: HtnStatus
  /** 肾不好/需控钾三态：true=控钾、false=正常、null=不清楚 */
  renalKRestriction: boolean | null
  /** 是否正在规律服用降压药 */
  medicated: boolean
  /** 今日已摄入钠（mg），今天还没记餐为 null */
  todayNa: number | null
  /** 最近一次血压，形如 "128/82"，没有记录为 null */
  latestBp: string | null
}

/** AI 回复内容（真实接口响应解包后的形态） */
export interface AiReply {
  content: string
}
