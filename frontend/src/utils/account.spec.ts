import { describe, it, expect } from 'vitest'
import {
  DEMO_UID,
  MOCK_SMS_CODE,
  hashPassword,
  verifyPassword,
  namespacedKey,
  genMockToken,
  isPhone,
  isPassword,
  isSmsCode,
  genSalt,
} from '@/utils/account'

describe('account utils', () => {
  it('常量正确：DEMO_UID=demo，MOCK_SMS_CODE=123456', () => {
    expect(DEMO_UID).toBe('demo')
    expect(MOCK_SMS_CODE).toBe('123456')
  })

  it('hashPassword：同密码同 salt 产出一致散列', async () => {
    const salt = genSalt()
    const h1 = await hashPassword('abc123', salt)
    const h2 = await hashPassword('abc123', salt)
    expect(h1).toBe(h2)
    expect(h1).toMatch(/^[0-9a-f]{64}$/)
  })

  it('hashPassword：不同 salt 产出不同散列（加盐有效）', async () => {
    const h1 = await hashPassword('abc123', 'salt-a')
    const h2 = await hashPassword('abc123', 'salt-b')
    expect(h1).not.toBe(h2)
  })

  it('verifyPassword：正确密码返回 true', async () => {
    const salt = genSalt()
    const hash = await hashPassword('mypassword', salt)
    expect(await verifyPassword('mypassword', hash, salt)).toBe(true)
  })

  it('verifyPassword：错误密码返回 false', async () => {
    const salt = genSalt()
    const hash = await hashPassword('mypassword', salt)
    expect(await verifyPassword('wrongpassword', hash, salt)).toBe(false)
  })

  it('namespacedKey：两 uid 键不交叉', () => {
    const k1 = namespacedKey('ndh_profile_v1', 'uid-001')
    const k2 = namespacedKey('ndh_profile_v1', 'uid-002')
    expect(k1).toBe('ndh_profile_v1:uid-001')
    expect(k2).toBe('ndh_profile_v1:uid-002')
    expect(k1).not.toBe(k2)
    // 同 uid 不同 base 也不交叉
    expect(namespacedKey('ndh_meals_v1', 'uid-001')).not.toBe(k1)
  })

  it('genMockToken：产出 64 位 hex 且不重复', () => {
    const t1 = genMockToken()
    const t2 = genMockToken()
    expect(t1).toMatch(/^[0-9a-f]{64}$/)
    expect(t2).toMatch(/^[0-9a-f]{64}$/)
    expect(t1).not.toBe(t2)
  })

  it('isPhone：11 位 1 开头为合法', () => {
    expect(isPhone('13800000000')).toBe(true)
    expect(isPhone('1380000000')).toBe(false) // 10 位
    expect(isPhone('23800000000')).toBe(false) // 非 1 开头
    expect(isPhone('1380000000a')).toBe(false) // 含字母
    expect(isPhone('')).toBe(false)
  })

  it('isPassword：≥6 位为合法', () => {
    expect(isPassword('123456')).toBe(true)
    expect(isPassword('12345')).toBe(false)
    expect(isPassword('')).toBe(false)
  })

  it('isSmsCode：6 位数字为合法', () => {
    expect(isSmsCode('123456')).toBe(true)
    expect(isSmsCode('12345')).toBe(false)
    expect(isSmsCode('1234567')).toBe(false)
    expect(isSmsCode('12345a')).toBe(false)
  })
})
