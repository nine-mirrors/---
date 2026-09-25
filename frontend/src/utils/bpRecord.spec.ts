import { describe, expect, it } from 'vitest'
import { normalizeBpRecord, normalizeBpRecords } from './bpRecord'

describe('normalizeBpRecord', () => {
  it('旧记录缺 readings：用 sys/dia 兜底为单次读数', () => {
    const r = normalizeBpRecord({
      id: 'bp_old',
      measuredAt: '2026-09-25T07:00:00.000Z',
      date: '2026-09-25',
      period: 'morning',
      sys: 135,
      dia: 86,
      hr: 78,
      source: 'manual',
    })
    expect(r).not.toBeNull()
    expect(r?.readings).toEqual([{ sys: 135, dia: 86 }])
    expect(r?.date).toBe('2026-09-25')
  })

  it('缺 date 时从 measuredAt 补，period/source/hr 非法时回落默认值', () => {
    const r = normalizeBpRecord({
      id: 'x',
      measuredAt: '2026-09-24T21:10:00.000Z',
      sys: 140,
      dia: 90,
      period: 'weird',
      source: 'wat',
    })
    expect(r?.date).toBe('2026-09-24')
    expect(r?.period).toBe('morning')
    expect(r?.source).toBe('manual')
    expect(r?.hr).toBeNull()
  })

  it('readings 中的脏项被剔除；全脏时用均值兜底', () => {
    const r = normalizeBpRecord({
      id: 'y',
      measuredAt: '2026-09-25T07:00:00.000Z',
      date: '2026-09-25',
      period: 'evening',
      sys: 150,
      dia: 95,
      readings: [{ sys: 'bad' }, null],
    })
    expect(r?.readings).toEqual([{ sys: 150, dia: 95 }])
    expect(r?.period).toBe('evening')
  })

  it('正常记录保留多次读数与可选字段', () => {
    const r = normalizeBpRecord({
      id: 'z',
      measuredAt: '2026-09-25T07:00:00.000Z',
      date: '2026-09-25',
      period: 'morning',
      sys: 128,
      dia: 82,
      hr: 70,
      source: 'device',
      readings: [
        { sys: 130, dia: 84 },
        { sys: 126, dia: 80 },
      ],
      arm: 'left',
      pulseRegular: true,
    })
    expect(r?.readings).toHaveLength(2)
    expect(r?.arm).toBe('left')
    expect(r?.pulseRegular).toBe(true)
  })

  it('垃圾输入（null/非对象/sys 非数值）返回 null', () => {
    expect(normalizeBpRecord(null)).toBeNull()
    expect(normalizeBpRecord('x')).toBeNull()
    expect(normalizeBpRecord({ sys: '高', dia: 90 })).toBeNull()
    expect(normalizeBpRecord({ sys: 130 })).toBeNull()
  })
})

describe('normalizeBpRecords', () => {
  it('非数组返回空列表；脏记录被丢弃、旧记录被修复', () => {
    expect(normalizeBpRecords(null)).toEqual([])
    const list = normalizeBpRecords([
      null,
      { sys: 'x', dia: 1 },
      { id: 'ok', measuredAt: '2026-09-25T07:00:00.000Z', date: '2026-09-25', sys: 135, dia: 86 },
    ])
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('ok')
    expect(list[0].readings).toEqual([{ sys: 135, dia: 86 }])
  })
})
