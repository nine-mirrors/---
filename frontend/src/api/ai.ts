// AI 营养师接口层
//
// 设计说明：
// - VITE_USE_MOCK !== 'false'（默认，含未设置）时走 src/mock/ai.ts 的本地关键词回复；
// - 否则请求 OpenAI 兼容的 /chat/completions（默认 DeepSeek）；
// - 刻意不走 src/api/http.ts 的业务 axios 实例：AI 密钥与业务 Bearer 不同，
//   且 401 拦截会串到登录页，AI 失败应只在聊天面板内提示中文错误；
// - 用原生 fetch + AbortController（20s 超时），零新增运行时依赖。
//
// 安全提示：前端直连 API 密钥仅适合本机演示；正式环境必须由后端代理并保管密钥。

import { HIGH_BP_URGENT_REPLY, MEDICATION_DISCLAIMER } from '@/constants/clinical'
import { mockChat } from '@/mock/ai'
import {
  buildEmergencyReply,
  detectBpCrisis,
  detectEmergencyInput,
  detectUnsafeAdvice,
  withMedicationDisclaimer,
} from '@/utils/aiSafety'
import type { AiContentPart, AiFeedbackRecord, AiMessage, AiTextPart } from '@/types/ai'

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
const DEFAULT_BASE_URL = 'https://api.deepseek.com'
const DEFAULT_MODEL = 'deepseek-flash'
const REQUEST_TIMEOUT_MS = 20000

/** OpenAI 兼容响应的最小结构（只取 choices[0].message.content） */
interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: unknown
    }
  }>
  error?: {
    message?: unknown
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** 非 2xx 状态码统一翻译成中文提示 */
function describeHttpStatus(status: number): string {
  if (status === 401 || status === 403) {
    return 'AI 密钥不对或已失效，请检查 .env.local 里的 VITE_AI_API_KEY'
  }
  if (status === 404) {
    return 'AI 服务地址不对，请检查 VITE_AI_BASE_URL 和模型名'
  }
  if (status === 429) {
    return '现在问的人太多，AI 忙不过来，请稍等一会儿再试'
  }
  if (status >= 500) {
    return 'AI 服务暂时开小差了，请稍后再问一次'
  }
  return `AI 请求失败了（${status}），请稍后再试一次`
}

function isTextPart(part: AiContentPart): part is AiTextPart {
  return part.type === 'text'
}

/**
 * 取最后一条 user 消息的纯文本：content 可能是 string，也可能是多模态 parts
 * （图片消息里仍有 text part）。急症兜底只看文字，图片本身不参与判断。
 */
function lastUserText(messages: AiMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message.role !== 'user') continue
    const { content } = message
    if (typeof content === 'string') return content
    return content
      .filter(isTextPart)
      .map((part) => part.text)
      .join('')
  }
  return ''
}

/**
 * 与 AI 营养师对话
 * @param messages 含 system 提示词与历史消息的完整对话（content 可含图片 parts）
 * @param signal 外部取消信号；传入时完全交由外部控制取消，否则内部保留 20s 超时
 * @returns AI 回复文本
 * @throws Error 未配置密钥 / 网络失败 / 超时 / 非 2xx / 空回复，message 均为中文
 */
export async function chatWithAi(messages: AiMessage[], signal?: AbortSignal): Promise<string> {
  // Mock 自带完整的本地安全路由（红旗短语/数值血压/体位性头晕），直接交它处理。
  if (USE_MOCK) {
    return mockChat(messages)
  }

  // 真实模型路径输入安全兜底：与 mock 同一套识别能力，急症绝不发给模型。
  const userText = lastUserText(messages)
  // 1) 红旗症状短语（含否定豁免）+ 拨打120/叫急救/中风发作/去急诊求助语境
  if (detectEmergencyInput(userText).length > 0) {
    return buildEmergencyReply()
  }
  // 2) 数值血压：≥180/120 按急症固定话术；160-179/100-119 给安静休息5分钟复测提示
  const bp = detectBpCrisis(userText)
  if (bp.emergency) {
    return buildEmergencyReply()
  }
  if (bp.urgent) {
    return HIGH_BP_URGENT_REPLY
  }
  // 2.5) 自行调药请求不发给模型：直接回固定免责话术（否定豁免在识别器内处理）
  if (detectUnsafeAdvice(userText)) {
    return MEDICATION_DISCLAIMER
  }

  const apiKey = import.meta.env.VITE_AI_API_KEY
  if (!apiKey) {
    throw new Error('AI 还没配置接口密钥，请在 .env.local 设置 VITE_AI_API_KEY')
  }

  const baseUrl = (import.meta.env.VITE_AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
  const model = import.meta.env.VITE_AI_MODEL || DEFAULT_MODEL

  // 统一用内部 controller 接 fetch：有外部 signal 就跟着外部取消，否则上 20s 超时，
  // 避免内部 timer 与外部 signal 互相打架。
  const controller = new AbortController()
  const onExternalAbort = (): void => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onExternalAbort, { once: true })
  }
  const timer = signal ? null : window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      // 多模态消息（text/image_url parts）按 DeepSeek/OpenAI 视觉兼容格式直接序列化
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        temperature: 0.7,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    if (isAbortError(err)) {
      throw new Error(signal?.aborted ? '已取消本次提问' : 'AI 想得有点久，超时了，请再试一次')
    }
    throw new Error('网络连不上 AI，请检查网络后再试一次')
  } finally {
    if (timer !== null) window.clearTimeout(timer)
    signal?.removeEventListener('abort', onExternalAbort)
  }

  if (!response.ok) {
    // 尽量带上服务端错误明细，取不到就按状态码给中文提示
    let detail = ''
    try {
      const errBody = (await response.json()) as ChatCompletionResponse | null
      if (errBody?.error && typeof errBody.error.message === 'string') {
        detail = `（${errBody.error.message}）`
      }
    } catch {
      // 错误体不是 JSON：忽略，只用状态码文案
    }
    throw new Error(describeHttpStatus(response.status) + detail)
  }

  const data = (await response.json()) as ChatCompletionResponse
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI 这次没说出内容来，请再问一次')
  }

  const replyText = content.trim()
  // 输出安全兜底：真实模型若给出自行调药/停药/改剂量表述，末尾固定追加用药免责提示
  // （mock 回复本身就是安全口径，不走这里）。
  if (detectUnsafeAdvice(replyText)) {
    return withMedicationDisclaimer(replyText)
  }
  return replyText
}

/**
 * 上报一条点赞/点踩反馈。
 * 反馈记录已由 aiChat store 本地落库（AI_FEEDBACK_BASE），本函数只表示“上报动作完成”。
 *
 * 注意：真实模式也【不再】POST 到 AI 厂商域名下的 /feedback——那是对话厂商的外域，
 * 注定 404 还可能带着 Bearer 密钥乱发。等将来有自己的后端端点时再在此处补发：
 * // TODO(backend): POST `${import.meta.env.VITE_API_BASE_URL}/api/ai/feedback`，失败静默。
 * // 契约登记见 docs/api/_s02-business.md §11。
 */
export async function recordAiFeedback(rec: AiFeedbackRecord): Promise<void> {
  // 与 mock 行为保持一致：本地已落库，这里直接返回成功，不发任何网络请求。
  // 参数当前不外发，保留在签名上供将来后端端点启用时直接使用。
  void rec
  if (USE_MOCK) await delay(200)
}
