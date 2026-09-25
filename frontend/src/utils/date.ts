// 纯日期工具：统一本地时区 YYYY-MM-DD，避免 UTC 偏移问题

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

// Date | 可被 Date 构造器解析的字符串/时间戳 -> 'YYYY-MM-DD'
export function dateStr(d: Date | string | number = new Date()): string {
  const date = d instanceof Date ? d : new Date(d)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

// 今天的日期字符串
export function todayStr(): string {
  return dateStr(new Date())
}

// 在某日期上加减天数，返回新 Date（不改入参）
export function addDays(d: Date | string | number, delta: number): Date {
  const date = d instanceof Date ? new Date(d) : new Date(d)
  date.setDate(date.getDate() + delta)
  return date
}

// 最近 n 天日期字符串数组（旧 → 新，含今天）
export function recentDates(n: number, end: Date | string | number = new Date()): string[] {
  const list: string[] = []
  for (let i = n - 1; i >= 0; i -= 1) {
    list.push(dateStr(addDays(end, -i)))
  }
  return list
}

/**
 * 血压/服药记录的相对时间口语化
 * 今天早起后 / 昨天睡前 / M月D日 早上
 * @param date ISO 时间或 Date
 * @param period 'morning' | 'evening'
 */
export function formatRelTime(date: Date | string | number, period: 'morning' | 'evening'): string {
  const now = new Date()
  const target = date instanceof Date ? date : new Date(date)
  const todayKey = dateStr(now)
  const targetKey = dateStr(target)
  const yesterdayKey = dateStr(addDays(now, -1))

  if (targetKey === todayKey) {
    return period === 'morning' ? '今天早起后' : '今天睡前'
  }
  if (targetKey === yesterdayKey) {
    return period === 'morning' ? '昨天早起后' : '昨天睡前'
  }
  const md = `${target.getMonth() + 1}月${target.getDate()}日`
  return period === 'morning' ? `${md} 早上` : `${md} 晚上`
}
