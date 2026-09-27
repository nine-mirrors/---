/**
 * Auth Mock 实现（FR-48/50）
 *
 * 账号表存全局键 ndh_accounts_v1（Account[]），会话存 ndh_auth_v1（Session）。
 * 账号标识统一为邮箱，验证码经邮件发送（mock 阶段不真发信）：
 * - 密码：WebCrypto SHA-256 + 随机 salt，绝不存明文；
 * - 验证码：固定 MOCK_EMAIL_CODE='123456'；
 * - 验证码登录：未注册邮箱自动建号（name 默认取邮箱“@”前的名称）；
 * - 一键体验：只写 demo 会话，不建账号行。
 */

import { readGlobal, writeGlobal } from '@/utils/storage'
import {
  ACCOUNTS_KEY,
  DEMO_UID,
  MOCK_EMAIL_CODE,
  genMockToken,
  genSalt,
  hashPassword,
  isEmail,
  isEmailCode,
  isPassword,
  verifyPassword,
} from '@/utils/account'
import type {
  Account,
  AuthRequest,
  AuthResponse,
  EmailLoginRequest,
  EmailSendRequest,
} from '@/types/auth'
import { ApiError } from '@/api/http'

const delay = (ms = 300): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** 读取账号表 */
function readAccounts(): Account[] {
  return readGlobal<Account[]>(ACCOUNTS_KEY) || []
}

/** 写入账号表 */
function writeAccounts(accounts: Account[]): void {
  writeGlobal(ACCOUNTS_KEY, accounts)
}

/** 生成 uid（时间戳+随机，避免碰撞） */
function genUid(): string {
  return `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 默认昵称：取邮箱“@”前的本地名（截断到 20 字） */
function nameFromEmail(email: string): string {
  const local = email.split('@')[0] || '用户'
  return local.slice(0, 20)
}

/** 构造返回体 */
function buildResponse(account: Account): AuthResponse {
  return {
    token: genMockToken(),
    user: { uid: account.uid, email: account.email, name: account.name },
  }
}

/** 注册 */
export async function mockRegister(req: AuthRequest): Promise<AuthResponse> {
  await delay()
  const email = req.email.trim().toLowerCase()
  if (!isEmail(email)) throw new ApiError(400, '请输入正确的邮箱地址')
  if (!isPassword(req.password)) throw new ApiError(400, '密码至少 6 位')

  const accounts = readAccounts()
  if (accounts.some((a) => a.email === email)) {
    throw new ApiError(422, '该邮箱已注册，请直接登录')
  }

  const salt = genSalt()
  const passwordHash = await hashPassword(req.password, salt)
  const account: Account = {
    uid: genUid(),
    email,
    name: req.name?.trim() || nameFromEmail(email),
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
  }
  accounts.push(account)
  writeAccounts(accounts)
  return buildResponse(account)
}

/** 密码登录 */
export async function mockLogin(req: AuthRequest): Promise<AuthResponse> {
  await delay()
  const email = req.email.trim().toLowerCase()
  if (!isEmail(email)) throw new ApiError(400, '请输入正确的邮箱地址')
  if (!isPassword(req.password)) throw new ApiError(400, '密码至少 6 位')

  const account = readAccounts().find((a) => a.email === email)
  if (!account) throw new ApiError(404, '账号不存在，请先注册')

  const ok = await verifyPassword(req.password, account.passwordHash, account.salt)
  if (!ok) throw new ApiError(422, '密码错误，请重试')

  return buildResponse(account)
}

/** 发送邮箱验证码（mock：固定 123456，直接返回成功；真实模式由后端发邮件） */
export async function mockSendEmailCode(req: EmailSendRequest): Promise<{ ok: true }> {
  await delay(200)
  if (!isEmail(req.email)) throw new ApiError(400, '请输入正确的邮箱地址')
  // 演示模式不真正发邮件，验证码固定 MOCK_EMAIL_CODE
  return { ok: true }
}

/** 验证码登录：未注册自动建号 */
export async function mockLoginByEmail(req: EmailLoginRequest): Promise<AuthResponse> {
  await delay()
  const email = req.email.trim().toLowerCase()
  if (!isEmail(email)) throw new ApiError(400, '请输入正确的邮箱地址')
  if (!isEmailCode(req.code)) throw new ApiError(400, '请输入 6 位验证码')
  if (req.code !== MOCK_EMAIL_CODE) throw new ApiError(422, '验证码错误或已过期')

  const accounts = readAccounts()
  let account = accounts.find((a) => a.email === email)

  // 未注册邮箱自动建号（FR-50）
  if (!account) {
    account = {
      uid: genUid(),
      email,
      name: nameFromEmail(email),
      passwordHash: '',
      salt: '',
      createdAt: new Date().toISOString(),
    }
    accounts.push(account)
    writeAccounts(accounts)
  }

  return buildResponse(account)
}

/** 退出登录（mock 无服务端会话，直接成功） */
export async function mockLogout(): Promise<{ ok: true }> {
  return { ok: true }
}

/** 获取当前用户（mock：从会话键读取） */
export async function mockGetMe(): Promise<{ uid: string; email: string; name: string }> {
  const session = readGlobal<{ uid: string; email: string; name: string }>('ndh_auth_v1')
  if (!session) throw new ApiError(401, '未登录')
  return { uid: session.uid, email: session.email, name: session.name }
}

/** 演示账号：返回 demo 用户（不建账号行） */
export function getDemoUser(): { uid: string; email: string; name: string } {
  return { uid: DEMO_UID, email: 'wangayi@example.com', name: '王阿姨' }
}
