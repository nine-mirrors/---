import { onBeforeUnmount, ref } from 'vue'

const KEYWORD_REGEXP = /吃|饿|食谱|菜单|饭|菜/

export interface SpeechRecognizedResult {
  /** false=识别中临时文本，true=稳定最终结果 */
  final: boolean
  text: string
}

export interface UseSpeechRecognitionOptions {
  onResult?: (result: SpeechRecognizedResult) => void
  onEnd?: () => void
  /** 识别出错回调（入参为浏览器 error code），出错后会自动 stop */
  onError?: (error: string) => void
}

/**
 * 语音识别（Web Speech API）组合式函数。
 */
export function useSpeechRecognition({
  onResult,
  onEnd,
  onError,
}: UseSpeechRecognitionOptions = {}) {
  const supported = Boolean(
    typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition),
  )

  const listening = ref(false)

  let recognition: SpeechRecognition | null = null

  /**
   * 开始识别。
   * @param lang BCP-47 语种，默认普通话 zh-CN；浏览器对方言支持有限，带乡音说普通话更稳
   */
  function start(lang = 'zh-CN'): boolean {
    if (!supported) return false

    const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!RecognitionCtor) return false

    stop()

    const instance = new RecognitionCtor()
    instance.lang = lang
    instance.interimResults = true
    instance.continuous = true
    instance.maxAlternatives = 1

    instance.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = ''
      let finalText = ''
      for (let i = event.resultIndex || 0; i < event.results.length; i += 1) {
        const result = event.results[i]
        const transcript = (result[0] && result[0].transcript) || ''
        if (result.isFinal) {
          finalText += transcript
        } else {
          interimText += transcript
        }
      }
      if (interimText && typeof onResult === 'function') {
        onResult({ final: false, text: interimText })
      }
      if (finalText && typeof onResult === 'function') {
        onResult({ final: true, text: finalText.trim() })
      }
    }

    instance.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (typeof onError === 'function') {
        onError((event && event.error) || 'error')
      }
      stop()
    }

    instance.onend = () => {
      listening.value = false
      if (typeof onEnd === 'function') {
        onEnd()
      }
    }

    try {
      instance.start()
      recognition = instance
      listening.value = true
    } catch {
      // start 可能因重复启动抛错，忽略即可
      listening.value = false
      return false
    }
    return true
  }

  function stop(): void {
    if (recognition) {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      try {
        recognition.abort()
      } catch {
        // 忽略已停止状态下的异常
      }
      recognition = null
    }
    listening.value = false
  }

  /**
   * 关键词命中判断（点餐/饮食意图）。
   */
  function isKeywordHit(text: string): boolean {
    return KEYWORD_REGEXP.test(text || '')
  }

  onBeforeUnmount(() => {
    stop()
  })

  return { supported, listening, start, stop, isKeywordHit }
}
