<script setup lang="ts">
// 单条气泡：附件渲染（图片缩略图 84px 可 el-image 预览 / 文件 chip）+ 正文；
// assistant 非 pending 气泡下挂赞、踩（二态高亮）与"重新生成"。
// 正文统一走 aiSafety 的安全迷你 markdown（h() VNode，严禁 v-html/innerHTML）：
// 只认 **加粗**、无序列表、有序列表、空行分段；120 仅在急症语境生成 tel:120 链接。
import { computed, h, type VNodeChild } from 'vue'
import { Document, Picture, RefreshRight, VideoPause } from '@element-plus/icons-vue'
import { renderAiRichText } from '@/utils/aiSafety'
import { useSpeech, requestSpeak } from '@/composables/useSpeech'
import type { AiAttachment, AiFeedback, ChatMessage } from '@/types/ai'

const props = defineProps<{
  message: ChatMessage
  canRegenerate?: boolean
}>()

const emit = defineEmits<{
  (e: 'feedback', feedback: AiFeedback): void
  (e: 'regenerate'): void
}>()

/**
 * 正文渲染函数组件：scoped 样式下 h() 产出的内部节点不带 data-v 作用域，
 * 相关内部样式在 CSS 里统一用 :deep(.ai-md__*) 命中。
 */
const BubbleRich = (renderProps: { content: string; linkify: boolean }): VNodeChild =>
  h(
    'div',
    { class: 'msg-bubble__text' },
    renderAiRichText(renderProps.content, { linkify120: renderProps.linkify }),
  )

const imageAtts = computed<AiAttachment[]>(() =>
  (props.message.attachments ?? []).filter((a) => a.kind === 'image'),
)
const fileAtts = computed<AiAttachment[]>(() =>
  (props.message.attachments ?? []).filter((a) => a.kind === 'file'),
)
/** 刷新后 dataUrl 已被剥离，只剩没有图可预览的历史图片 */
const previewUrls = computed<string[]>(() =>
  imageAtts.value.map((a) => a.dataUrl).filter((u): u is string => Boolean(u)),
)

function formatKb(size: number): string {
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

/* ---------- 朗读本条 AI 回答（每条气泡各自持有朗读状态） ---------- */
const { supported: speechSupported, speaking, speak, stop } = useSpeech()

function toggleReadAloud(): void {
  void requestSpeak({ supported: speechSupported, speaking, speak, stop }, props.message.content, {
    rate: 0.9,
    lang: 'zh-CN',
  })
}
</script>

<template>
  <div class="msg-bubble" :class="message.role === 'user' ? 'msg-bubble--user' : 'msg-bubble--ai'">
    <!-- 附件 -->
    <div v-if="imageAtts.length || fileAtts.length" class="msg-att">
      <div v-for="att in imageAtts" :key="att.id" class="msg-att__img">
        <el-image
          v-if="att.dataUrl"
          :src="att.dataUrl"
          :preview-src-list="previewUrls"
          :initial-index="previewUrls.indexOf(att.dataUrl)"
          preview-teleported
          fit="cover"
          class="msg-att__img-el"
          :aria-label="`点击预览图片：${att.name}`"
        />
        <span v-else class="msg-att__img-missing" title="图片只在本次对话中保留，刷新后不可预览">
          <el-icon aria-hidden="true"><Picture /></el-icon>
        </span>
      </div>
      <div v-for="att in fileAtts" :key="att.id" class="msg-filechip">
        <el-icon class="msg-filechip__icon" aria-hidden="true"><Document /></el-icon>
        <span class="msg-filechip__name">{{ att.name }}</span>
        <span class="msg-filechip__size">{{ formatKb(att.size) }}</span>
      </div>
    </div>

    <!-- 正文：安全迷你 markdown（h() VNode）；tel:120 链接只在 assistant 消息里生成 -->
    <BubbleRich
      v-if="message.content"
      :content="message.content"
      :linkify="message.role === 'assistant'"
    />

    <!-- assistant 操作行（pending/error 由列表组件处理，不会走到这里） -->
    <div v-if="message.role === 'assistant'" class="msg-actions">
      <button
        type="button"
        class="msg-action"
        :class="{ 'is-active-speak': speaking }"
        :aria-label="speaking ? '停止朗读这条回答' : '朗读这条回答'"
        :aria-pressed="speaking"
        @click="toggleReadAloud"
      >
        <el-icon v-if="speaking" aria-hidden="true"><VideoPause /></el-icon>
        <svg
          v-else
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M11 5 6 9H3v6h3l5 4z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.4 5.6a9 9 0 0 1 0 12.8" />
        </svg>
        <span class="msg-action__label">{{ speaking ? '停止' : '朗读' }}</span>
      </button>
      <button
        type="button"
        class="msg-action"
        :class="{ 'is-active-up': message.feedback === 'up' }"
        :aria-label="message.feedback === 'up' ? '取消：这个回答有用' : '这个回答有用'"
        :aria-pressed="message.feedback === 'up'"
        @click="emit('feedback', 'up')"
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3z" />
          <path
            d="M7 10l4.2-7.4a1.8 1.8 0 0 1 3.1 1.9L14 9h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 18.3 20H7"
          />
        </svg>
        <span class="msg-action__label">有用</span>
      </button>
      <button
        type="button"
        class="msg-action"
        :class="{ 'is-active-down': message.feedback === 'down' }"
        :aria-label="message.feedback === 'down' ? '取消：这个回答没用' : '这个回答没用'"
        :aria-pressed="message.feedback === 'down'"
        @click="emit('feedback', 'down')"
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M17 14V3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3z" />
          <path
            d="M17 14l-4.2 7.4a1.8 1.8 0 0 1-3.1-1.9L10 15H4.5a2 2 0 0 1-2-2.3l1.2-7A2 2 0 0 1 5.7 4H17"
          />
        </svg>
        <span class="msg-action__label">没用</span>
      </button>
      <button v-if="canRegenerate" type="button" class="msg-regenerate" @click="emit('regenerate')">
        <el-icon aria-hidden="true"><RefreshRight /></el-icon>
        <span>重新生成</span>
      </button>
    </div>
  </div>
</template>

<style scoped src="./AiMessageBubble.css"></style>
