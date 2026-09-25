// AI 独立页：现场上下文读取 + 请求消息组装
// readAiContext 逻辑从 AiAssistant.vue 原样搬出（profile/meals/bpLog），供独立页与悬浮球复用。

import { useBpLogStore } from '@/stores/bpLog'
import { useMealsStore } from '@/stores/meals'
import { useProfileStore } from '@/stores/profile'
import { todayStr } from '@/utils/date'
import { buildSystemPrompt } from '@/utils/aiPrompt'
import type { AiChatContext, AiContentPart, AiConversation, AiMessage } from '@/types/ai'

/** 现场读取用户画像 / 今日钠摄入 / 最近血压；任何一项读不到都降级为无上下文 */
export async function readAiContext(): Promise<AiChatContext | null> {
  try {
    const profileStore = useProfileStore()
    const mealsStore = useMealsStore()
    const bpLogStore = useBpLogStore()

    const today = todayStr()
    const todaysMeals = mealsStore.meals.filter((m) => m.date === today)
    const todayNa = todaysMeals.length
      ? Math.round(todaysMeals.reduce((sum, m) => sum + (m.totals?.Na ?? 0), 0))
      : null

    // 血压记录可能尚未加载（如登录页直接发问）：尝试拉近 7 天，失败就留空
    if (!bpLogStore.loaded) {
      await bpLogStore.recordsOfLast7().catch(() => undefined)
    }
    const latest = bpLogStore.lastRecord()

    return {
      name: profileStore.profile.name || '',
      age: profileStore.profile.age ?? null,
      htnStatus: profileStore.profile.htnStatus,
      renalKRestriction: profileStore.profile.renalKRestriction,
      medicated: profileStore.profile.htnDetail?.medicated === true,
      todayNa,
      latestBp: latest ? `${latest.sys}/${latest.dia}` : null,
    }
  } catch (err) {
    console.warn('[ai] 读取用户上下文失败，本次以无上下文对话', err)
    return null
  }
}

/** 把一条 user 气泡消息组装成 string 或多模态 parts（文本 + 图片 dataUrl） */
function userContent(
  content: string,
  attachments: AiConversation['messages'][number]['attachments'],
): string | AiContentPart[] {
  const parts: AiContentPart[] = []
  if (content) parts.push({ type: 'text', text: content })
  for (const att of attachments ?? []) {
    // 文本文件内容由 UI 在发送前并入 content；图片仅在有内存 dataUrl 时才入请求
    if (att.kind === 'image' && att.dataUrl) {
      parts.push({ type: 'image_url', image_url: { url: att.dataUrl } })
    }
  }
  if (parts.length === 1 && parts[0].type === 'text') return content
  return parts
}

/**
 * 组装发往 AI 的完整消息：[system, ...历史]。
 * 历史过滤 pending/error，以及既无文本又无图片的空消息；assistant 永远用 string。
 */
export function buildRequestMessages(conv: AiConversation, ctx: AiChatContext | null): AiMessage[] {
  const history: AiMessage[] = []
  for (const msg of conv.messages) {
    if (msg.pending || msg.error) continue
    const text = msg.content ?? ''
    if (msg.role === 'user') {
      const hasImage = msg.attachments?.some((a) => a.kind === 'image' && a.dataUrl) === true
      if (!text.trim() && !hasImage) continue
      history.push({ role: 'user', content: userContent(text, msg.attachments) })
    } else {
      if (!text.trim()) continue
      history.push({ role: 'assistant', content: text })
    }
  }
  return [{ role: 'system', content: buildSystemPrompt(ctx) }, ...history]
}
