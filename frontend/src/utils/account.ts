/**
 * 账号工具：密码散列、命名空间拼键、校验、mock 常量
 *
 * - 零运行时依赖：WebCrypto SHA-256 + 每账号随机 salt；
 * - verifyPassword 做常量时间字节比较，防时序侧信道；
 * - namespacedKey 统一业务键命名空间（:<uid> 后缀）。
 */

/** 一键体验固定演示 uid（与任何注册账号物理隔离） */
export const DEMO_UID = 'demo'

/** mock 验证码固定码（FR-50） */
export const MOCK_SMS_CODE = '123456'

/** 会话全局键（含 token） */
export const AUTH_SESSION_KEY = 'ndh_auth_v1'

/** mock 账号表全局键 */
export const ACCOUNTS_KEY = 'ndh_accounts_v1'

/**
 * 生成 16 字节随机 salt（hex）
 * 优先用 WebCrypto getRandomValues；测试环境兜底用 Math.random。
 */
export function genSalt(): string {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 密码散列：SHA-256(password + ':' + salt) → hex
 * 使用 WebCrypto，异步；不存明文。
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${password}:${salt}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 常量时间比较两个 hex 字符串
 * 通过逐字节 XOR 累积差异，避免短路返回造成时序泄露。
 */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * 密码校验：重新散列后常量时间比较
 */
export async function verifyPassword(
  password: string,
  hash: string,
  salt: string,
): Promise<boolean> {
  const computed = await hashPassword(password, salt)
  return timingSafeEqualHex(computed, hash)
}

/**
 * 命名空间键：<base>:<uid>
 * 业务 localStorage 一律经此函数拼键，禁止裸键。
 */
export function namespacedKey(base: string, uid: string): string {
  return `${base}:${uid}`
}

/**
 * 生成 mock 会话 token（随机 32 hex）
 * 真实模式 token 由后端返回，前端不解析。
 */
export function genMockToken(): string {
  const bytes = new Uint8Array(32)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** 手机号格式：1 开头 11 位数字 */
export function isPhone(phone: string): boolean {
  return /^1\d{10}$/.test(phone)
}

/** 密码格式：≥6 位 */
export function isPassword(password: string): boolean {
  return typeof password === 'string' && password.length >= 6
}

/** 验证码格式：6 位数字 */
export function isSmsCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}
