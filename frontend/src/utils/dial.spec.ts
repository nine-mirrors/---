// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { isPhoneDevice } from './dial'

describe('isPhoneDevice 电话能力探测', () => {
  it('安卓手机 UA 判定为手机（可显示拨号入口）', () => {
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

  it('iPod / Windows Phone 判定为手机', () => {
    expect(isPhoneDevice('Mozilla/5.0 (iPod; CPU iPod OS 15_0 like Mac OS X) Mobile')).toBe(true)
    expect(isPhoneDevice('Mozilla/5.0 (Windows Phone 10.0; Android 4.0) Edge/15')).toBe(true)
  })

  it('Windows / macOS 桌面浏览器判定为非手机（隐藏拨号按钮）', () => {
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

  it('桌面化 iPad UA（无 iPad/Mobile 关键词）归入非手机，不显示拨号入口', () => {
    expect(
      isPhoneDevice(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17 Safari/605.1.15',
      ),
    ).toBe(false)
  })

  it('默认取 navigator.userAgent，桌面 headless 判定为非手机', () => {
    expect(isPhoneDevice()).toBe(false)
  })
})
