// 血压记录归一化：兼容旧版本/本地损坏/后端旧格式数据
// 旧版本写入的记录没有 readings 字段，页面直接读 record.readings.length 会抛错，
// 曾导致「我的」页渲染中断、表现为“点不开”。

import type { BpPeriod, BpReading, BpRecord } from '@/types'

function toFiniteNumber(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * 归一化单条血压记录：
 * - readings 缺失/为空/含脏项时，用 sys/dia 均值兜底为单次读数；
 * - date/period/source/hr/id 等必填字段缺失时补安全默认值；
 * - sys/dia 不是有效数值的垃圾记录返回 null，由调用方丢弃。
 */
export function normalizeBpRecord(raw: unknown): BpRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const sys = toFiniteNumber(r.sys)
  const dia = toFiniteNumber(r.dia)
  if (sys === null || dia === null) return null

  const rawReadings = Array.isArray(r.readings)
    ? r.readings
        .map((x) => {
          if (!x || typeof x !== 'object') return null
          const rs = toFiniteNumber((x as BpReading).sys)
          const rd = toFiniteNumber((x as BpReading).dia)
          return rs === null || rd === null ? null : { sys: rs, dia: rd }
        })
        .filter((x): x is BpReading => x !== null)
    : []
  const readings: BpReading[] = rawReadings.length ? rawReadings : [{ sys, dia }]

  const measuredAt =
    typeof r.measuredAt === 'string' && r.measuredAt ? r.measuredAt : new Date().toISOString()
  const date = typeof r.date === 'string' && r.date ? r.date : measuredAt.slice(0, 10)
  const period: BpPeriod = r.period === 'evening' ? 'evening' : 'morning'
  const hr = r.hr == null ? null : toFiniteNumber(r.hr)

  return {
    id: typeof r.id === 'string' && r.id ? r.id : `bp_${measuredAt}_${sys}_${dia}`,
    measuredAt,
    date,
    period,
    sys,
    dia,
    hr,
    source: r.source === 'device' ? 'device' : 'manual',
    readings,
    ...(r.arm === 'left' || r.arm === 'right' ? { arm: r.arm } : {}),
    ...(typeof r.pulseRegular === 'boolean' ? { pulseRegular: r.pulseRegular } : {}),
    ...(typeof r.symptoms === 'string' ? { symptoms: r.symptoms } : {}),
    createdAt: typeof r.createdAt === 'string' && r.createdAt ? r.createdAt : measuredAt,
  }
}

/** 批量归一化，自动丢弃无法识别的脏记录 */
export function normalizeBpRecords(list: unknown): BpRecord[] {
  if (!Array.isArray(list)) return []
  return list.map(normalizeBpRecord).filter((r): r is BpRecord => r !== null)
}
