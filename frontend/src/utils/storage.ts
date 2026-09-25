/**
 * localStorage 命名空间封装（Task 12a 重写）
 *
 * 接口（钉死给 12b）：
 * - nsRead<T>(base): T|null —— 读 <base>:<uid>，uid 取自当前会话；无会话返回 null
 * - nsWrite<T>(base, v): void —— 写 <base>:<uid>；配额满/隐私模式抛 StorageWriteError
 * - nsRemove(base): void —— 删 <base>:<uid>
 * - readGlobal<T>/writeGlobal<T>/removeGlobal —— 全局键（仅 accounts/auth 用）
 *
 * 迁移：
 * - 读取时剥离废弃字段（t2dStatus/sweetFreq/gl）；
 * - 旧裸键（无 :<uid> 后缀）首次兜底读入当前 uid 命名空间并删除裸键，不丢数据。
 */

import { AUTH_SESSION_KEY } from '@/utils/account'
import type { Session } from '@/types/auth'

/** 写入失败（存储配额满 / 隐私模式禁止写入）：调用方必须提示用户，不能假装成功 */
export class StorageWriteError extends Error {
  constructor(key: string, cause?: unknown) {
    super('内容没有保存成功：手机存储空间可能已满，请清理一点空间后再试一次')
    this.name = 'StorageWriteError'
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause
    console.warn('[storage] 写入失败', key, cause)
  }
}

/** 需要从业务数据中剥离的 R1 废弃字段 */
const DEPRECATED_FIELDS = ['t2dStatus', 'sweetFreq', 'gl'] as const

/** 从对象（含数组元素）中递归剥离废弃字段 */
function stripDeprecated(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripDeprecated)
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if ((DEPRECATED_FIELDS as readonly string[]).includes(k)) continue
      result[k] = stripDeprecated(v)
    }
    return result
  }
  return value
}

/** 读取当前会话 uid；无会话返回 null */
function currentUid(): string | null {
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as Session | null
    if (session && typeof session.uid === 'string' && session.uid) return session.uid
    return null
  } catch {
    return null
  }
}

/**
 * 全局键读取（仅 accounts/auth 等非业务数据使用）
 */
export function readGlobal<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw == null || raw === '') return null
    return JSON.parse(raw) as T
  } catch (err) {
    console.warn('[storage] 全局读取失败', key, err)
    return null
  }
}

/**
 * 全局键写入；配额满/隐私模式抛 StorageWriteError（登录等关键写入不得假装成功）
 */
export function writeGlobal<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    throw new StorageWriteError(key, err)
  }
}

/**
 * 全局键删除
 */
export function removeGlobal(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch (err) {
    console.warn('[storage] 全局删除失败', key, err)
  }
}

/**
 * 命名空间读取：<base>:<uid>
 * - 无会话 → null
 * - 命名空间键不存在但旧裸键存在 → 迁移（剥离废弃字段→写入命名空间→删裸键）
 */
export function nsRead<T>(base: string): T | null {
  const uid = currentUid()
  if (!uid) return null

  const nsKey = `${base}:${uid}`
  try {
    const raw = window.localStorage.getItem(nsKey)
    if (raw != null && raw !== '') {
      return stripDeprecated(JSON.parse(raw)) as T
    }
  } catch (err) {
    console.warn('[storage] 命名空间读取失败', nsKey, err)
  }

  // 迁移：旧裸键兜底读入当前 uid 命名空间
  try {
    const legacyRaw = window.localStorage.getItem(base)
    if (legacyRaw != null && legacyRaw !== '') {
      const migrated = stripDeprecated(JSON.parse(legacyRaw)) as T
      window.localStorage.setItem(nsKey, JSON.stringify(migrated))
      window.localStorage.removeItem(base)
      console.info(`[storage] 已迁移旧裸键 ${base} → ${nsKey}`)
      return migrated
    }
  } catch (err) {
    console.warn('[storage] 旧裸键迁移失败', base, err)
  }

  return null
}

/**
 * 命名空间写入：<base>:<uid>
 * - 无会话 → console.warn no-op（不抛错，避免页面崩溃）
 * - 配额满/隐私模式 → 抛 StorageWriteError，调用方须提示用户保存失败
 */
export function nsWrite<T>(base: string, value: T): void {
  const uid = currentUid()
  if (!uid) {
    console.warn(`[storage] 无会话，nsWrite(${base}) 被忽略`)
    return
  }
  const nsKey = `${base}:${uid}`
  try {
    window.localStorage.setItem(nsKey, JSON.stringify(value))
  } catch (err) {
    throw new StorageWriteError(nsKey, err)
  }
}

/**
 * 命名空间删除：<base>:<uid>
 */
export function nsRemove(base: string): void {
  const uid = currentUid()
  if (!uid) return
  const nsKey = `${base}:${uid}`
  try {
    window.localStorage.removeItem(nsKey)
  } catch (err) {
    console.warn('[storage] 命名空间删除失败', nsKey, err)
  }
}
