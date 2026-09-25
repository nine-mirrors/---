<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Microphone } from '@element-plus/icons-vue'
import { useSpeechRecognition } from '@/composables/useSpeechRecognition'

const router = useRouter()
const transcript = ref('')
// 本轮录音是否已收尾（跳转或提示），避免浏览器 onend 与手动结束重复反馈
let settled = false

// 不支持语音识别时按钮不再 v-if 消失，而是置灰可见（见模板 disabled 分支）
const { supported, listening, start, stop, isKeywordHit } = useSpeechRecognition({
  onResult({ final, text }) {
    transcript.value = text
    // 浏览器给出稳定结果后即自动收尾，不必等老人再点一次
    if (final) finalize(text)
  },
  onEnd() {
    // 浏览器自己结束（停顿超时等）：按已经听到的内容正常收尾
    if (!settled) finalize(transcript.value)
  },
  onError(type) {
    // 出错后 composable 内部会自动 stop，这里锁定本轮状态防止重复提示
    settled = true
    let message = '刚才没识别成功，请再试一次'
    if (type === 'not-allowed' || type === 'service-not-allowed') {
      message = '没有麦克风权限，可点浏览器地址栏左侧图标开启'
    } else if (type === 'network') {
      message = '语音识别服务暂时连不上，您也可以直接去食谱页看看'
    } else if (type === 'no-speech') {
      message = '没听清，请点一下按钮再说一次'
    }
    ElMessage.info(message)
  },
})

// 没听到想吃的东西时的统一引导
function showNoIntent() {
  ElMessage({
    message: '没听到想吃的，可以试试问"今晚吃什么"',
    duration: 5000,
  })
}

// 收尾：有关键词带去食谱页；没有（含没出声）给一句可操作的引导
function finalize(text: string) {
  if (settled) return
  settled = true
  stop()
  if (isKeywordHit(text)) {
    ElMessage.success('好的，带您去看看食谱')
    router.push('/recipes')
  } else {
    showNoIntent()
  }
}

// 点击式：第一次点击开始听，再次点击手动结束
function handleToggle() {
  if (!supported) return
  if (listening.value) {
    finalize(transcript.value)
    return
  }
  settled = false
  transcript.value = ''
  start()
}

const buttonText = computed(() => {
  if (!supported) return '语音用不了'
  if (listening.value) return transcript.value || '正在听……点我结束'
  return '点一下说话'
})
</script>

<template>
  <button
    type="button"
    class="voice-btn"
    :class="{ 'voice-btn--listening': listening, 'voice-btn--disabled': !supported }"
    :disabled="!supported"
    :title="supported ? '' : '当前浏览器不支持语音'"
    @click="handleToggle"
    @contextmenu.prevent
  >
    <span class="voice-btn__pulse" aria-hidden="true" />
    <el-icon class="voice-btn__icon" aria-hidden="true"><Microphone /></el-icon>
    <span class="voice-btn__body">
      <span class="voice-btn__text">{{ buttonText }}</span>
      <span v-if="!supported" class="voice-btn__sub">当前浏览器不支持语音</span>
    </span>
  </button>
</template>

<style scoped>
.voice-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  min-height: 56px;
  padding: 6px var(--space-xl);
  font-family: inherit;
  font-size: 1rem;
  color: var(--color-text-secondary);
  background-color: var(--color-bg-card);
  border: 2px solid var(--color-border);
  border-radius: 999px;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  transition:
    border-color 0.2s ease,
    color 0.2s ease,
    background-color 0.2s ease;
}

.voice-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary-dark);
}

.voice-btn__body {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.voice-btn__text {
  line-height: 1.3;
}

.voice-btn__sub {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.voice-btn:disabled,
.voice-btn--disabled {
  cursor: not-allowed;
  color: var(--color-text-secondary);
  background-color: var(--color-bg-warm);
  border-color: var(--color-border);
  opacity: 0.7;
}

.voice-btn:disabled:hover {
  border-color: var(--color-border);
  color: var(--color-text-secondary);
}

.voice-btn__icon {
  font-size: 1.35rem;
}

.voice-btn__pulse {
  position: absolute;
  inset: -2px;
  display: none;
  border: 2px solid var(--color-danger);
  border-radius: inherit;
  pointer-events: none;
}

.voice-btn--listening {
  color: var(--color-danger);
  background-color: #fdecea;
  border-color: var(--color-danger);
}

.voice-btn--listening .voice-btn__icon {
  animation: voice-icon-pulse 1.2s ease-in-out infinite;
}

.voice-btn--listening .voice-btn__pulse {
  display: block;
  animation: voice-ring 1.2s ease-out infinite;
}

@keyframes voice-ring {
  0% {
    transform: scale(1);
    opacity: 0.6;
  }
  100% {
    transform: scale(1.28);
    opacity: 0;
  }
}

@keyframes voice-icon-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.18);
  }
}
</style>
