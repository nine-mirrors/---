/**
 * 账号与会话领域类型（Task 12a）
 *
 * - Account：本机 mock 账号表记录（ndh_accounts_v1），绝不存明文密码；
 * - Session：登录会话（ndh_auth_v1），含不透明 token；
 * - AuthRequest/AuthResponse：注册/密码登录契约；
 * - SmsSendRequest/SmsLoginRequest：验证码登录契约（未注册手机号自动建号）。
 */

/** mock 账号表记录（ndh_accounts_v1）：绝不存明文密码 */
export interface Account {
  uid: string
  phone: string
  name: string
  passwordHash: string
  salt: string
  createdAt: string
}

/** 会话（ndh_auth_v1 全局键） */
export interface Session {
  uid: string
  phone: string
  name: string
  token: string
  loginAt: string
}

/** 登录/注册请求（密码模式） */
export interface AuthRequest {
  phone: string
  password: string
  name?: string
}

/** 鉴权响应（注册/登录/验证码登录统一返回） */
export interface AuthResponse {
  token: string
  user: {
    uid: string
    phone: string
    name: string
  }
}

/** 发送验证码请求 */
export interface SmsSendRequest {
  phone: string
  /** 场景：login（登录/注册复用）；预留 register 等扩展 */
  scene?: 'login' | 'register'
}

/** 验证码登录请求 */
export interface SmsLoginRequest {
  phone: string
  code: string
}
