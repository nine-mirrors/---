// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// speechSynthesis 在 jsdom 中不存在；模块在 import 时判定 supported，
// 因此必须先装好假实现，再动态导入被测模块。
class FakeUtterance {
  text: string
  lang = ''
  rate = 1
  voice: unknown = null
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(text: string) {
    this.text = text
  }
}

const speak = vi.fn()
const cancel = vi.fn()

;(globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = FakeUtterance
Object.defineProperty(window, 'speechSynthesis', {
  configurable: true,
  value: {
    speak,
    cancel,
    getVoices: () => [{ lang: 'zh-CN', name: 'Fake 中文', voiceURI: '' }],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
})

const { announce, setSpeechEnabled } = await import('./useSpeech')

describe('announce 系统级即时播报', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    speak.mockClear()
    cancel.mockClear()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('语音开关未打开：不发声且返回 false（不打扰、不弹引导）', () => {
    expect(announce('网络连不上')).toBe(false)
    expect(cancel).not.toHaveBeenCalled()
    expect(speak).not.toHaveBeenCalled()
  })

  it('开关已打开：cancel 一拍后入队朗读，文案/语言/语速正确', () => {
    setSpeechEnabled(true)
    const ok = announce('网络或页面出了点小问题，请稍后再试。')
    expect(ok).toBe(true)
    expect(cancel).toHaveBeenCalledTimes(1)
    // 50ms 恢复间隔内还不 speak
    expect(speak).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60)
    expect(speak).toHaveBeenCalledTimes(1)
    const utterance = speak.mock.calls[0][0] as FakeUtterance
    expect(utterance.text).toBe('网络或页面出了点小问题，请稍后再试。')
    expect(utterance.lang).toBe('zh-CN')
    expect(utterance.rate).toBe(0.9)
  })

  it('空文本 / 空白文本：返回 false 且不 speak', () => {
    setSpeechEnabled(true)
    expect(announce('   ')).toBe(false)
    expect(announce(undefined)).toBe(false)
    vi.advanceTimersByTime(60)
    expect(speak).not.toHaveBeenCalled()
  })

  it('连续触发：作废上一个待播队列，最终只读最后一条', () => {
    setSpeechEnabled(true)
    announce('第一条')
    announce('第二条')
    expect(cancel).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(60)
    expect(speak).toHaveBeenCalledTimes(1)
    expect((speak.mock.calls[0][0] as FakeUtterance).text).toBe('第二条')
  })
})
