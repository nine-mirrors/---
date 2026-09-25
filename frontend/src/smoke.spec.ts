// Task 11 smoke：验证 Vitest + TS + @ 路径别名管线可用
import { describe, it, expect } from 'vitest'
import { pad2, dateStr, recentDates } from '@/utils/date'

describe('工程管线 smoke', () => {
  it('Vitest 可执行 TS 并解析 @ 别名', () => {
    expect(pad2(3)).toBe('03')
    // 本地时区构造，dateStr 输出 YYYY-MM-DD
    expect(dateStr(new Date(2026, 8, 23))).toBe('2026-09-23')
    expect(recentDates(3, new Date(2026, 8, 23))).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
    ])
  })
})
