/**
 * 拨号服务：tel: 协议唤起 + "非手机设备"全局兜底
 *
 * 背景：网页只能通过 `tel:` 链接请求系统处理，能不能真正打电话取决于设备：
 * - 手机浏览器：唤起系统拨号盘并自动填好号码（出于安全，网页无法直接拨出，
 *   用户需再按一次拨号键）；
 * - 电脑/部分平板：大多没有注册 tel: 处理器，点击后要么弹"去商店找应用"，
 *   要么静默无反应——老人会以为按钮坏了（实测同一点击重复 7 次）。
 * 全应用拨号入口统一调 dial()：手机直接唤起，非手机把号码写入 dialState，
 * 由挂在 App 根部的 DialFallbackDialog 弹大字号码窗 + 一键复制。
 */
import { reactive } from 'vue'

/**
 * 是否为可直接唤起电话拨号盘的手机设备。
 * iPadOS 13+ 桌面化 UA 不含 iPad，但 iPad 多数无电话能力，归入"兜底弹窗"更安全。
 */
export function isPhoneDevice(ua: string = navigator.userAgent): boolean {
  return /Android|iPhone|iPod|Windows Phone|BlackBerry|Mobile\s*Safari/i.test(ua)
}

/** 拼 tel: 协议链接（号码原样透传，格式由调用方保证） */
export function telHref(phone: string): string {
  return `tel:${phone}`
}

/**
 * 直接发起 tel: 唤起。
 * @returns true=已在手机上发起；false=当前设备无法处理 tel:
 */
export function requestDial(phone: string): boolean {
  if (!isPhoneDevice()) return false
  window.location.href = telHref(phone)
  return true
}

export interface DialTarget {
  phone: string
  /** 紧急联系人姓名（120 入口不需要） */
  name?: string
  /** 120 急救入口：兜底弹窗使用更强的警示文案 */
  isEmergency120?: boolean
}

interface DialState {
  /** 非手机设备待展示的号码窗；null=不展示 */
  prompt: DialTarget | null
  /** 手机端每次成功唤起拨号盘时刷新，供全局组件提示"再按一下拨号键" */
  launchedAt: number
}

export const dialState = reactive<DialState>({ prompt: null, launchedAt: 0 })

/**
 * 全应用统一拨号入口。
 * @returns true=已唤起手机拨号盘；false=已置兜底弹窗状态
 */
export function dial(phone: string, opts: Omit<DialTarget, 'phone'> = {}): boolean {
  if (requestDial(phone)) {
    dialState.launchedAt = Date.now()
    return true
  }
  dialState.prompt = { phone, isEmergency120: false, ...opts }
  return false
}

export function closeDialPrompt(): void {
  dialState.prompt = null
}

/**
 * 复制电话号码：优先 Clipboard API（需安全上下文 https/localhost），
 * 旧 webview / http 内网场景退回 execCommand。
 * @returns 是否复制成功
 */
export async function copyPhone(phone: string): Promise<boolean> {
  const text = phone.trim()
  if (!text) return false

  if (navigator.clipboard?.writeText) {
    // 个别环境（未聚焦窗口/权限查询卡住）writeText 可能迟迟不 settle，
    // 1.5s 超时后退回 execCommand，避免按钮一直无反馈
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        navigator.clipboard.writeText(text),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('clipboard write timeout')), 1500)
        }),
      ])
      return true
    } catch {
      // 权限拒绝、非安全上下文或超时，走兜底
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-9999px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
