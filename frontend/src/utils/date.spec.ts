// date 工具测试：formatRelTime 四分支

import { describe, it, expect } from 'vitest'
import { formatRelTime, dateStr, addDays } from '@/utils/date'

describe('formatRelTime 四分支', () => {
  const today = new Date()
  const todayKey = dateStr(today)

  it('今天早上 → "今天早起后"', () => {
    const r = formatRelTime(todayKey, 'morning')
    expect(r).toBe('今天早起后')
  })

  it('今天晚上 → "今天睡前"', () => {
    const r = formatRelTime(todayKey, 'evening')
    expect(r).toBe('今天睡前')
  })

  it('昨天早上 → "昨天早起后"', () => {
    const yesterday = dateStr(addDays(today, -1))
    const r = formatRelTime(yesterday, 'morning')
    expect(r).toBe('昨天早起后')
  })

  it('昨天晚上 → "昨天睡前"', () => {
    const yesterday = dateStr(addDays(today, -1))
    const r = formatRelTime(yesterday, 'evening')
    expect(r).toBe('昨天睡前')
  })

  it('更早日期早上 → "M月D日 早上"', () => {
    const d = addDays(today, -5)
    const r = formatRelTime(dateStr(d), 'morning')
    expect(r).toBe(`${d.getMonth() + 1}月${d.getDate()}日 早上`)
  })

  it('更早日期晚上 → "M月D日 晚上"', () => {
    const d = addDays(today, -5)
    const r = formatRelTime(dateStr(d), 'evening')
    expect(r).toBe(`${d.getMonth() + 1}月${d.getDate()}日 晚上`)
  })
})
