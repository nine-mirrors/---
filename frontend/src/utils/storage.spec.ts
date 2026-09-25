// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StorageWriteError, nsRead, nsRemove, nsWrite, readGlobal, writeGlobal } from './storage'
import { AUTH_SESSION_KEY } from './account'

const SESSION = {
  uid: 'u-test',
  phone: '13800000000',
  name: '测试',
  token: 't',
  loginAt: '2025-01-01',
}

beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(SESSION))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('命名空间读写', () => {
  it('nsWrite/nsRead 按 <base>:<uid> 落库与回读', () => {
    nsWrite('ndh_x_v1', { a: 1 })
    expect(window.localStorage.getItem('ndh_x_v1:u-test')).toBe(JSON.stringify({ a: 1 }))
    expect(nsRead<{ a: number }>('ndh_x_v1')).toEqual({ a: 1 })
  })

  it('无会话时 nsWrite 静默不写、nsRead 返回 null', () => {
    window.localStorage.clear()
    expect(() => nsWrite('ndh_x_v1', { a: 1 })).not.toThrow()
    expect(nsRead('ndh_x_v1')).toBeNull()
  })

  it('读取坏 JSON 返回 null 而不抛错', () => {
    window.localStorage.setItem('ndh_bad_v1:u-test', '{不是json')
    expect(nsRead('ndh_bad_v1')).toBeNull()
  })

  it('读取时剥离 R1 废弃字段（含数组元素内）', () => {
    window.localStorage.setItem(
      'ndh_p_v1:u-test',
      JSON.stringify({ name: '张', t2dStatus: 'x', items: [{ gl: 1, keep: 2 }] }),
    )
    expect(nsRead('ndh_p_v1')).toEqual({ name: '张', items: [{ keep: 2 }] })
  })

  it('旧裸键首次读取自动迁移到命名空间并删除裸键', () => {
    window.localStorage.setItem('ndh_legacy_v1', JSON.stringify({ v: 1 }))
    expect(nsRead<{ v: number }>('ndh_legacy_v1')).toEqual({ v: 1 })
    expect(window.localStorage.getItem('ndh_legacy_v1')).toBeNull()
    expect(window.localStorage.getItem('ndh_legacy_v1:u-test')).toBe(JSON.stringify({ v: 1 }))
  })
})

describe('StorageWriteError（二轮 P1：配额满不得假成功）', () => {
  it('nsWrite 配额满时抛 StorageWriteError 且文案不含内部 key', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    let caught: unknown
    try {
      nsWrite('ndh_secret_v1', { big: 'x' })
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(StorageWriteError)
    const message = (caught as Error).message
    expect(message).toContain('存储空间')
    expect(message).not.toContain('ndh_secret_v1')
    expect(message).not.toContain('u-test')
  })

  it('writeGlobal 配额满同样抛 StorageWriteError', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    expect(() => writeGlobal(AUTH_SESSION_KEY, { x: 1 })).toThrow(StorageWriteError)
  })

  it('readGlobal 坏 JSON 返回 null；nsRemove 不存在不抛错', () => {
    expect(readGlobal('不存在的键')).toBeNull()
    expect(() => nsRemove('ndh_x_v1')).not.toThrow()
  })
})
