/**
 * Auth API 层（FR-30/48/50）
 *
 * VITE_USE_MOCK !== 'false' 走本地 mock（src/mock/auth.ts），
 * 否则走真实后端 axios 实例。两条路径函数签名与返回结构一致。
 *
 * 端点（账号标识统一为邮箱，验证码经邮件发送）：
 * - POST /api/auth/register    {email,password,name?}     → {token,user}
 * - POST /api/auth/login       {email,password}           → {token,user}
 * - POST /api/auth/email/send  {email,scene}              → {ok}
 * - POST /api/auth/login/email {email,code}               → {token,user}（未注册自动建号）
 * - POST /api/auth/logout      {}                         → {ok}
 * - GET  /api/auth/me          -                          → {uid,email,name}
 */

import http from './http'
import {
  mockRegister,
  mockLogin,
  mockSendEmailCode,
  mockLoginByEmail,
  mockLogout,
  mockGetMe,
} from '@/mock/auth'
import type { AuthRequest, AuthResponse, EmailLoginRequest, EmailSendRequest } from '@/types/auth'

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

export async function register(req: AuthRequest): Promise<AuthResponse> {
  if (USE_MOCK) return mockRegister(req)
  return http.post<AuthResponse>('/api/auth/register', req)
}

export async function login(req: AuthRequest): Promise<AuthResponse> {
  if (USE_MOCK) return mockLogin(req)
  return http.post<AuthResponse>('/api/auth/login', req)
}

export async function sendEmailCode(req: EmailSendRequest): Promise<{ ok: true }> {
  if (USE_MOCK) return mockSendEmailCode(req)
  return http.post<{ ok: true }>('/api/auth/email/send', req)
}

export async function loginByEmail(req: EmailLoginRequest): Promise<AuthResponse> {
  if (USE_MOCK) return mockLoginByEmail(req)
  return http.post<AuthResponse>('/api/auth/login/email', req)
}

export async function logout(): Promise<{ ok: true }> {
  if (USE_MOCK) return mockLogout()
  return http.post<{ ok: true }>('/api/auth/logout', {})
}

export async function getMe(): Promise<{ uid: string; email: string; name: string }> {
  if (USE_MOCK) return mockGetMe()
  return http.get<{ uid: string; email: string; name: string }>('/api/auth/me')
}
