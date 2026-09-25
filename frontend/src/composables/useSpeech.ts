import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const SETTINGS_KEY = 'ndh_settings_v1'
// Chrome 在 cancel() 后紧接 speak() 偶发吞句，留一个很短的恢复间隔（≤60ms）
const CANCEL_RESUME_DELAY = 50

/**
 * 读取语音播报开关。
 * 与 GlobalSpeechToggle 的默认值保持一致：无键 / 数据损坏时视为关闭（false）。
 */
function readEnabled(): boolean {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as unknown
    return Boolean(
      raw && typeof raw === 'object' && (raw as { speechEnabled?: boolean }).speechEnabled === true,
    )
  } catch {
    return false
  }
}

/**
 * 写入语音播报开关并通知同页所有 useSpeech 实例即时刷新。
 * 供"未开启时点听一听 → 弹窗引导开启"等场景复用，避免各组件散写存储键。
 * @returns 是否写入成功（隐私模式 / 配额满时返回 false）
 */
export function setSpeechEnabled(value: boolean): boolean {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as unknown
    const base = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...base, speechEnabled: value }))
  } catch {
    return false
  }
  window.dispatchEvent(new Event('ndh-settings-change'))
  return true
}

// ---- 模块级音色预热（全应用只绑定一次，composable 多实例共享）----
const synthSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
let cachedVoices: SpeechSynthesisVoice[] = []
let voicesListenerBound = false

function refreshVoices(): void {
  if (!synthSupported) return
  try {
    cachedVoices = window.speechSynthesis.getVoices() || []
  } catch {
    cachedVoices = []
  }
}

// 部分浏览器首次 getVoices() 返回空数组，voiceschanged 触发后才可用
function ensureVoicesWarm(): void {
  if (!synthSupported || voicesListenerBound) return
  voicesListenerBound = true
  refreshVoices()
  try {
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices)
  } catch {
    // 个别旧内核不支持 addEventListener，pickVoice 在 speak 时仍会实时兜底
  }
}

// 模块初始化即绑定一次（与页面同生命周期，无需 removeEventListener）
ensureVoicesWarm()

export interface SpeakOptions {
  rate?: number
  lang?: string
}

/**
 * 语音播报（SpeechSynthesis）组合式函数。
 * 设置存储于 localStorage 的 ndh_settings_v1 键，组件不依赖任何 store。
 */
export function useSpeech() {
  const supported = synthSupported
  const speaking = ref(false)
  const enabled = ref(readEnabled())

  /** cancel 后延时 speak 的定时器，stop()/连续 speak 时需要作废 */
  let speakTimer: number | null = null

  function clearPendingSpeak(): void {
    if (speakTimer !== null) {
      window.clearTimeout(speakTimer)
      speakTimer = null
    }
  }

  function refresh(): void {
    enabled.value = readEnabled()
  }

  function pickVoice(): SpeechSynthesisVoice | null {
    if (!supported) return null
    // 优先用 voiceschanged 预热缓存；缓存为空时实时再取一次兜底
    const voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices() || []
    return (
      voices.find((voice) => /zh[-_]CN/i.test(voice.lang || '')) ||
      voices.find((voice) => /^zh/i.test(voice.lang || '')) ||
      null
    )
  }

  /**
   * 朗读文本。
   * @returns 是否实际发声（不支持 / 未开启 / 文本为空时返回 false）
   */
  function speak(
    text: string | null | undefined,
    { rate = 0.9, lang = 'zh-CN' }: SpeakOptions = {},
  ): boolean {
    if (!supported) return false
    // 每次发声前现读设置，保证与全局开关实时一致
    refresh()
    if (!enabled.value) return false
    if (text === null || text === undefined || String(text).trim() === '') return false

    const synth = window.speechSynthesis

    const utterance = new SpeechSynthesisUtterance(String(text))
    utterance.rate = rate
    utterance.lang = lang
    const voice = pickVoice()
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang || lang
    }
    utterance.onstart = () => {
      speaking.value = true
    }
    utterance.onend = () => {
      speaking.value = false
    }
    utterance.onerror = () => {
      speaking.value = false
    }

    // 连续触发时作废上一个待播队列；cancel 后稍等一拍再 speak，规避 Chrome 吞句
    clearPendingSpeak()
    synth.cancel()
    speakTimer = window.setTimeout(() => {
      speakTimer = null
      // 等待期间开关被关掉则不再发声
      if (!readEnabled()) return
      synth.speak(utterance)
    }, CANCEL_RESUME_DELAY)
    // 仍保持同步布尔返回（调用方也可 await，非 thenable 值 await 结果不变）
    return true
  }

  function stop(): void {
    if (!supported) return
    clearPendingSpeak()
    window.speechSynthesis.cancel()
    speaking.value = false
  }

  function handleStorage(event: StorageEvent): void {
    // 其他标签页修改设置（key 为 null 表示 localStorage.clear）
    if (!event || event.key === SETTINGS_KEY || event.key === null) {
      refresh()
    }
  }

  function handleSettingsChange(): void {
    refresh()
  }

  onMounted(() => {
    if (!supported) return
    // 再次确保音色已预热（模块级 once 绑定，重复调用无副作用）
    ensureVoicesWarm()
    window.addEventListener('storage', handleStorage)
    window.addEventListener('ndh-settings-change', handleSettingsChange)
  })

  onBeforeUnmount(() => {
    if (!supported) return
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener('ndh-settings-change', handleSettingsChange)
    stop()
  })

  return { supported, speaking, speak, stop }
}

/** announce() 的 cancel→speak 恢复定时器（模块级单通道） */
let announceTimer: number | null = null

/**
 * 非组件场景的即时播报（全局错误处理、路由加载失败、网络异常等系统级提醒）：
 * - 仅当语音播报开关已打开时发声，绝不弹引导框、不打扰未开启的用户；
 * - best-effort：不支持 / 空文本 / 被自动播放策略拦截时静默返回 false。
 * @returns 是否已送入朗读队列
 */
export function announce(
  text: string | null | undefined,
  { rate = 0.9, lang = 'zh-CN' }: SpeakOptions = {},
): boolean {
  if (!synthSupported) return false
  if (!readEnabled()) return false
  if (text === null || text === undefined || String(text).trim() === '') return false

  const synth = window.speechSynthesis
  const utterance = new SpeechSynthesisUtterance(String(text))
  utterance.rate = rate
  utterance.lang = lang
  const voices = cachedVoices.length ? cachedVoices : synth.getVoices() || []
  const voice =
    voices.find((item) => /zh[-_]CN/i.test(item.lang || '')) ||
    voices.find((item) => /^zh/i.test(item.lang || '')) ||
    null
  if (voice) {
    utterance.voice = voice
    utterance.lang = voice.lang || lang
  }

  // 与 useSpeech.speak 同样的 cancel→延时一拍→speak，规避 Chrome 连续触发吞句
  if (announceTimer !== null) window.clearTimeout(announceTimer)
  synth.cancel()
  announceTimer = window.setTimeout(() => {
    announceTimer = null
    if (readEnabled()) synth.speak(utterance)
  }, CANCEL_RESUME_DELAY)
  return true
}

/** useSpeech() 返回值的最小结构，供 requestSpeak 解耦组件实例 */
export interface SpeechController {
  supported: boolean
  speaking: Ref<boolean>
  speak: (text: string | null | undefined, options?: SpeakOptions) => boolean
  stop: () => void
}

/**
 * 统一的"朗读这一段"入口：
 * - 正在读 → 停止；
 * - 开关已开 / 直接朗读成功 → 返回 true；
 * - 开关未开 → 弹适老大按钮确认框，确认后一键开启并朗读；取消则什么都不做。
 * 结果页"听一听"、AI 气泡"朗读"等所有需要 TTS 的位置共用这一条路径，
 * 避免每个组件各写一份"开关没开怎么办"。
 */
export async function requestSpeak(
  controller: SpeechController,
  text: string | null | undefined,
  options: SpeakOptions = {},
): Promise<boolean> {
  if (!controller.supported) {
    ElMessage.info('当前浏览器不支持语音播报')
    return false
  }
  if (controller.speaking.value) {
    controller.stop()
    return true
  }
  if (controller.speak(text, options)) return true

  try {
    await ElMessageBox.confirm(
      '语音播报还没打开。现在打开后，就能直接朗读这条内容。要打开吗？',
      '语音播报',
      {
        confirmButtonText: '打开并朗读',
        cancelButtonText: '暂不打开',
        type: 'info',
      },
    )
  } catch {
    return false
  }

  if (!setSpeechEnabled(true)) {
    ElMessage.error('浏览器存储不可用，设置没法保存')
    return false
  }
  // 设置事件同步刷新本实例后立即朗读（仍在用户点击链路内，符合浏览器自动播放策略）
  return controller.speak(text, options)
}
