// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  closeDialPrompt,
  copyPhone,
  dial,
  dialState,
  isPhoneDevice,
  requestDial,
  telHref,
} from './dial'

describe('dial utils', () => {
  describe('isPhoneDevice', () => {
    it('安卓手机 UA 判定为手机', () => {
      expect(
        isPhoneDevice(
          'Mozilla/5.0 (Linux; Android 14; PHB110) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
        ),
      ).toBe(true)
    })

    it('iPhone UA 判定为手机', () => {
      expect(
        isPhoneDevice(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
        ),
      ).toBe(true)
    })

    it('Windows / macOS 桌面浏览器判定为非手机', () => {
      expect(
        isPhoneDevice(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129 Safari/537.36 Edg/129',
        ),
      ).toBe(false)
      expect(
        isPhoneDevice(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17 Safari/605.1.15',
        ),
      ).toBe(false)
    })

    it('桌面化 iPad UA（无 iPad/Mobile 关键词）归入非手机，走兜底弹窗', () => {
      expect(
        isPhoneDevice(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17 Safari/605.1.15',
        ),
      ).toBe(false)
    })
  })

  it('telHref：拼出 tel: 链接', () => {
    expect(telHref('120')).toBe('tel:120')
    expect(telHref('13540787433')).toBe('tel:13540787433')
  })

  it('requestDial：非手机返回 false 且不导航', () => {
    vi.stubGlobal('navigator', { userAgent: 'Windows NT 10.0; Win64; x64 Chrome/129' })
    const hrefSet = vi.fn()
    vi.stubGlobal('location', {
      set href(v: string) {
        hrefSet(v)
      },
    })
    expect(requestDial('13540787433')).toBe(false)
    expect(hrefSet).not.toHaveBeenCalled()
  })

  it('requestDial：手机 UA 导航到 tel: 并返回 true', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile Safari',
    })
    const hrefSet = vi.fn()
    vi.stubGlobal('location', {
      set href(v: string) {
        hrefSet(v)
      },
    })
    expect(requestDial('13540787433')).toBe(true)
    expect(hrefSet).toHaveBeenCalledWith('tel:13540787433')
  })

  describe('dial 全局服务', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
      dialState.prompt = null
      dialState.launchedAt = 0
    })

    it('非手机：写入兜底弹窗状态，不导航', () => {
      vi.stubGlobal('navigator', { userAgent: 'Windows NT 10.0; Win64; x64 Chrome/129' })
      const hrefSet = vi.fn()
      vi.stubGlobal('location', {
        set href(v: string) {
          hrefSet(v)
        },
      })
      expect(dial('13540787433', { name: '老王' })).toBe(false)
      expect(hrefSet).not.toHaveBeenCalled()
      expect(dialState.prompt).toEqual({
        phone: '13540787433',
        name: '老王',
        isEmergency120: false,
      })
    })

    it('120 入口弹窗带急救标记', () => {
      vi.stubGlobal('navigator', { userAgent: 'Macintosh; Intel Mac OS X 10_15 Safari' })
      vi.stubGlobal('location', { href: '' })
      dial('120', { isEmergency120: true })
      expect(dialState.prompt).toEqual({ phone: '120', isEmergency120: true })
    })

    it('手机：唤起 tel: 并刷新 launchedAt，不弹窗', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile Safari',
      })
      const hrefSet = vi.fn()
      vi.stubGlobal('location', {
        set href(v: string) {
          hrefSet(v)
        },
      })
      expect(dial('120', { isEmergency120: true })).toBe(true)
      expect(hrefSet).toHaveBeenCalledWith('tel:120')
      expect(dialState.prompt).toBeNull()
      expect(dialState.launchedAt).toBeGreaterThan(0)
    })

    it('closeDialPrompt 关闭弹窗', () => {
      vi.stubGlobal('navigator', { userAgent: 'Windows Chrome' })
      vi.stubGlobal('location', { href: '' })
      dial('120')
      expect(dialState.prompt).not.toBeNull()
      closeDialPrompt()
      expect(dialState.prompt).toBeNull()
    })
  })

  describe('copyPhone', () => {
    beforeEach(() => {
      vi.unstubAllGlobals()
    })
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('空串返回 false', async () => {
      expect(await copyPhone('   ')).toBe(false)
    })

    it('Clipboard API 可用时写入号码', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      })
      expect(await copyPhone('  13540787433  ')).toBe(true)
      expect(writeText).toHaveBeenCalledWith('13540787433')
    })

    it('writeText 长时间不返回时超时退回 execCommand', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => new Promise(() => {}) }, // 永不 settle
      })
      const exec = vi.fn().mockReturnValue(true)
      Object.defineProperty(document, 'execCommand', { configurable: true, value: exec })
      expect(await copyPhone('13800138000')).toBe(true)
      expect(exec).toHaveBeenCalledWith('copy')
    })

    it('Clipboard API 抛错时退回 execCommand 兜底', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      })
      // jsdom 26 已不实现 execCommand，直接打桩模拟旧 webview
      const exec = vi.fn().mockReturnValue(true)
      Object.defineProperty(document, 'execCommand', { configurable: true, value: exec })
      expect(await copyPhone('120')).toBe(true)
      expect(exec).toHaveBeenCalledWith('copy')
    })
  })
})
