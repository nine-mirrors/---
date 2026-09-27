// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockRegister, mockLogin, mockSendEmailCode, mockLoginByEmail } from '@/mock/auth'
import { MOCK_EMAIL_CODE } from '@/utils/account'
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
    const res = await mockRegister({
      email: 'zhangsan@example.com',
      password: '123456',
      name: '张三',
    })
    expect(res.token).toMatch(/^[0-9a-f]{64}$/)
    expect(res.user.email).toBe('zhangsan@example.com')
    expect(res.user.name).toBe('张三')
    expect(res.user.uid).toBeTruthy()
  })

  it('register 同邮箱拒绝（422）', async () => {
    await mockRegister({ email: 'repeat@example.com', password: '123456' })
    await expect(
      mockRegister({ email: 'repeat@example.com', password: '654321' }),
    ).rejects.toMatchObject({
      code: 422,
    })
  })

  it('register 邮箱统一小写存储，大写写法视为同一账号', async () => {
    await mockRegister({ email: 'Case@Example.com', password: '123456' })
    await expect(
      mockRegister({ email: 'case@example.com', password: '654321' }),
    ).rejects.toMatchObject({ code: 422 })
  })

  it('login 正确密码成功', async () => {
    await mockRegister({ email: 'laoli@example.com', password: 'secret123' })
    const res = await mockLogin({ email: 'laoli@example.com', password: 'secret123' })
    expect(res.user.email).toBe('laoli@example.com')
  })

  it('login 错误密码拒绝（422）', async () => {
    await mockRegister({ email: 'wrong@example.com', password: 'secret123' })
    await expect(
      mockLogin({ email: 'wrong@example.com', password: 'wrongpass' }),
    ).rejects.toMatchObject({
      code: 422,
    })
  })

  it('login 不存在的账号（404）', async () => {
    await expect(
      mockLogin({ email: 'nobody@example.com', password: '123456' }),
    ).rejects.toMatchObject({
      code: 404,
    })
  })

  it('sendEmailCode 邮箱格式校验', async () => {
    await expect(mockSendEmailCode({ email: 'not-an-email' })).rejects.toBeInstanceOf(ApiError)
    await expect(mockSendEmailCode({ email: 'a@b.com' })).resolves.toEqual({ ok: true })
  })

  it('loginByEmail 验证码正确：已注册邮箱直接登录', async () => {
    await mockRegister({ email: 'laoli@example.com', password: '123456', name: '老李' })
    const res = await mockLoginByEmail({ email: 'laoli@example.com', code: MOCK_EMAIL_CODE })
    expect(res.user.name).toBe('老李')
    expect(res.user.email).toBe('laoli@example.com')
  })

  it('loginByEmail 验证码正确：未注册邮箱自动建号', async () => {
    const res = await mockLoginByEmail({ email: 'newuser@example.com', code: MOCK_EMAIL_CODE })
    expect(res.user.email).toBe('newuser@example.com')
    expect(res.user.uid).toBeTruthy()
    // 自动建号后 name 为邮箱“@”前的本地名
    expect(res.user.name).toBe('newuser')
  })

  it('loginByEmail 验证码错误拒绝（422）', async () => {
    await expect(
      mockLoginByEmail({ email: 'badcode@example.com', code: '000000' }),
    ).rejects.toMatchObject({
      code: 422,
    })
  })
})
