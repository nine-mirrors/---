/**
 * 电话能力探测：只有真机能处理 tel: 协议。
 *
 * 产品口径：一键拨打 120 / 紧急联系人是急救功能，仅在手机上展示（点击后由系统
 * 唤起拨号盘并填好号码，用户再按一次拨号键即可拨出——这是所有网页/小程序的
 * 系统安全限制）。电脑、桌面化平板没有电话能力，展示拨号按钮只会让老人
 * 误以为按钮坏了，故这些设备一律不渲染拨号入口，只给"请用手机拨打"文字提示。
 */

/**
 * 是否为可直接唤起电话拨号盘的手机设备。
 * iPadOS 13+ 桌面化 UA 不含 iPad，但 iPad 多数无电话能力，归入"不显示拨号"更安全。
 */
export function isPhoneDevice(ua: string = navigator.userAgent): boolean {
  return /Android|iPhone|iPod|Windows Phone|BlackBerry|Mobile\s*Safari/i.test(ua)
}
