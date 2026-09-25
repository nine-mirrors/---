// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockRegister, mockLogin, mockSendSmsCode, mockLoginBySms } from '@/mock/auth'
import { MOCK_SMS_CODE } from '@/utils/account'
import { ApiError } from '@/api/http'

/** 内存版 localStorage */
class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  clear(): void {
    this.store.clear()
  }
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() })
})

describe('mock auth', () => {
  it('register 成功并返回 token + user', async () => {
    const res = await mockRegister({ phone: '13800000001', password: '123456', name: '张三' })
    expect(res.token).toMatch(/^[0-9a-f]{64}$/)
    expect(res.user.phone).toBe('13800000001')
    expect(res.user.name).toBe('张三')
    expect(res.user.uid).toBeTruthy()
  })

  it('register 同手机号拒绝（422）', async () => {
    await mockRegister({ phone: '13800000002', password: '123456' })
    await expect(mockRegister({ phone: '13800000002', password: '654321' })).rejects.toMatchObject({
      code: 422,
    })
  })

  it('login 正确密码成功', async () => {
    await mockRegister({ phone: '13800000003', password: 'secret123' })
    const res = await mockLogin({ phone: '13800000003', password: 'secret123' })
    expect(res.user.phone).toBe('13800000003')
  })

  it('login 错误密码拒绝（422）', async () => {
    await mockRegister({ phone: '13800000004', password: 'secret123' })
    await expect(mockLogin({ phone: '13800000004', password: 'wrongpass' })).rejects.toMatchObject({
      code: 422,
    })
  })

  it('login 不存在的账号（404）', async () => {
    await expect(mockLogin({ phone: '13900000000', password: '123456' })).rejects.toMatchObject({
      code: 404,
    })
  })

  it('sendSmsCode 手机号格式校验', async () => {
    await expect(mockSendSmsCode({ phone: '123' })).rejects.toBeInstanceOf(ApiError)
    await expect(mockSendSmsCode({ phone: '13800000005' })).resolves.toEqual({ ok: true })
  })

  it('loginBySms 验证码正确：已注册手机号直接登录', async () => {
    await mockRegister({ phone: '13800000006', password: '123456', name: '老李' })
    const res = await mockLoginBySms({ phone: '13800000006', code: MOCK_SMS_CODE })
    expect(res.user.name).toBe('老李')
    expect(res.user.phone).toBe('13800000006')
  })

  it('loginBySms 验证码正确：未注册手机号自动建号', async () => {
    const res = await mockLoginBySms({ phone: '13700000007', code: MOCK_SMS_CODE })
    expect(res.user.phone).toBe('13700000007')
    expect(res.user.uid).toBeTruthy()
    // 自动建号后 name 为 "用户+后四位"
    expect(res.user.name).toBe('用户0007')
  })

  it('loginBySms 验证码错误拒绝（422）', async () => {
    await expect(mockLoginBySms({ phone: '13800000008', code: '000000' })).rejects.toMatchObject({
      code: 422,
    })
  })
})
