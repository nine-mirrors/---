/**
 * Auth API 层（FR-30/48/50）
 *
 * VITE_USE_MOCK !== 'false' 走本地 mock（src/mock/auth.ts），
 * 否则走真实后端 axios 实例。两条路径函数签名与返回结构一致。
 *
 * 端点：
 * - POST /api/auth/register   {phone,password,name?}      → {token,user}
 * - POST /api/auth/login      {phone,password}            → {token,user}
 * - POST /api/auth/sms/send   {phone,scene}               → {ok}
 * - POST /api/auth/login/sms  {phone,code}                → {token,user}（未注册自动建号）
 * - POST /api/auth/logout     {}                          → {ok}
 * - GET  /api/auth/me         -                           → {uid,phone,name}
 */

import http from './http'
import {
  mockRegister,
  mockLogin,
  mockSendSmsCode,
  mockLoginBySms,
  mockLogout,
  mockGetMe,
} from '@/mock/auth'
import type { AuthRequest, AuthResponse, SmsLoginRequest, SmsSendRequest } from '@/types/auth'

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

export async function register(req: AuthRequest): Promise<AuthResponse> {
  if (USE_MOCK) return mockRegister(req)
  return http.post<AuthResponse>('/api/auth/register', req)
}

export async function login(req: AuthRequest): Promise<AuthResponse> {
  if (USE_MOCK) return mockLogin(req)
  return http.post<AuthResponse>('/api/auth/login', req)
}

export async function sendSmsCode(req: SmsSendRequest): Promise<{ ok: true }> {
  if (USE_MOCK) return mockSendSmsCode(req)
  return http.post<{ ok: true }>('/api/auth/sms/send', req)
}

export async function loginBySms(req: SmsLoginRequest): Promise<AuthResponse> {
  if (USE_MOCK) return mockLoginBySms(req)
  return http.post<AuthResponse>('/api/auth/login/sms', req)
}

export async function logout(): Promise<{ ok: true }> {
  if (USE_MOCK) return mockLogout()
  return http.post<{ ok: true }>('/api/auth/logout')
}

export async function getMe(): Promise<{ uid: string; phone: string; name: string }> {
  if (USE_MOCK) return mockGetMe()
  return http.get<{ uid: string; phone: string; name: string }>('/api/auth/me')
}
