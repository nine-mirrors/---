<script setup lang="ts">
// 消息列：user 右主色气泡 / assistant 左白底 + 圆形 AI 头像；
// pending 三点动画、error 中文提示与"重新发送"；普通消息透传给 AiMessageBubble。
import AiMessageBubble from './AiMessageBubble.vue'
import type { AiFeedback, ChatMessage } from '@/types/ai'

defineProps<{
  messages: ChatMessage[]
  /** 可"重新生成"的 assistant 消息 id（最后一条） */
  lastAssistantId?: string
}>()

const emit = defineEmits<{
  (e: 'retry', msg: ChatMessage): void
  (e: 'regenerate', msg: ChatMessage): void
  (e: 'feedback', msg: ChatMessage, feedback: AiFeedback): void
}>()
</script>

<template>
  <div class="msg-list">
    <div
      v-for="msg in messages"
      :key="msg.id"
      class="msg-row"
      :class="msg.role === 'user' ? 'is-user' : 'is-ai'"
    >
      <span v-if="msg.role === 'assistant'" class="msg-row__avatar" aria-hidden="true">AI</span>

      <!-- 等待中 -->
      <div
        v-if="msg.pending"
        class="msg-bubble msg-bubble--ai msg-typing"
        role="status"
        aria-live="polite"
      >
        <span class="msg-typing__text">正在想</span>
        <span class="msg-typing__dots" aria-hidden="true"><i></i><i></i><i></i></span>
      </div>

      <!-- 失败 -->
      <div v-else-if="msg.error" class="msg-error" role="alert">
        <p class="msg-error__text">刚才网络不太顺，回复没有发出来。</p>
        <button type="button" class="msg-error__btn" @click="emit('retry', msg)">重新发送</button>
      </div>

      <!-- 正常气泡 -->
      <AiMessageBubble
        v-else
        :message="msg"
        :can-regenerate="msg.id === lastAssistantId"
        @regenerate="emit('regenerate', msg)"
        @feedback="(feedback) => emit('feedback', msg, feedback)"
      />
    </div>
  </div>
</template>

<style scoped src="./AiMessageList.css"></style>
