/**
 * 账号与会话领域类型
 *
 * 账号标识统一为邮箱（验证码经邮件发送，不产生短信费用）：
 * - Account：本机 mock 账号表记录（ndh_accounts_v1），绝不存明文密码；
 * - Session：登录会话（ndh_auth_v1），含不透明 token；
 * - AuthRequest/AuthResponse：注册/密码登录契约；
 * - EmailSendRequest/EmailLoginRequest：邮箱验证码登录契约（未注册邮箱自动建号）。
 */

/** mock 账号表记录（ndh_accounts_v1）：绝不存明文密码 */
export interface Account {
  uid: string
  email: string
  name: string
  passwordHash: string
  salt: string
  createdAt: string
}

/** 会话（ndh_auth_v1 全局键） */
export interface Session {
  uid: string
  email: string
  name: string
  token: string
  loginAt: string
}

/** 登录/注册请求（密码模式） */
export interface AuthRequest {
  email: string
  password: string
  name?: string
}

/** 鉴权响应（注册/登录/验证码登录统一返回） */
export interface AuthResponse {
  token: string
  user: {
    uid: string
    email: string
    name: string
  }
}

/** 发送邮箱验证码请求 */
export interface EmailSendRequest {
  email: string
  /** 场景：login（登录/注册复用）；预留 register 等扩展 */
  scene?: 'login' | 'register'
}

/** 邮箱验证码登录请求 */
export interface EmailLoginRequest {
  email: string
  code: string
}
