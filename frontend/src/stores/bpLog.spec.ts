import { describe, expect, it } from 'vitest'
import { avgReadings, triageBpLevel } from './bpLog'
import type { BpReading } from '@/types'

describe('avgReadings', () => {
  it('空数组返回 0/0', () => {
    expect(avgReadings([])).toEqual({ sys: 0, dia: 0 })
  })

  it('多次读数 sys/dia 分别平均并保留一位小数', () => {
    const readings: BpReading[] = [
      { sys: 185, dia: 115 },
      { sys: 170, dia: 108 },
    ]
    expect(avgReadings(readings)).toEqual({ sys: 177.5, dia: 111.5 })
  })
})

describe('triageBpLevel（二轮 P1：急症不得被均值稀释）', () => {
  it('均值仅 urgent 但任一原始读数 ≥180 → emergency', () => {
    // 摘要中的真实事故例：185/115 + 170/108，均值 177.5/111.5 本应只到 urgent
    const readings: BpReading[] = [
      { sys: 185, dia: 115 },
      { sys: 170, dia: 108 },
    ]
    const avg = avgReadings(readings)
    expect(triageBpLevel(readings, avg.sys, avg.dia)).toBe('emergency')
  })

  it('任一原始读数舒张压 ≥120 → emergency（即使收缩压均值不高）', () => {
    const readings: BpReading[] = [
      { sys: 150, dia: 88 },
      { sys: 156, dia: 122 },
    ]
    const avg = avgReadings(readings)
    expect(triageBpLevel(readings, avg.sys, avg.dia)).toBe('emergency')
  })

  it('均值 high 但任一原始读数达 160/100 → urgent', () => {
    const readings: BpReading[] = [
      { sys: 140, dia: 90 },
      { sys: 160, dia: 100 },
    ]
    expect(triageBpLevel(readings, 150, 95)).toBe('urgent')
  })

  it('正常读数 → normal', () => {
    const readings: BpReading[] = [
      { sys: 118, dia: 76 },
      { sys: 122, dia: 80 },
    ]
    const avg = avgReadings(readings)
    expect(triageBpLevel(readings, avg.sys, avg.dia)).toBe('normal')
  })

  it('低血压 → low，不被缺失 readings 影响', () => {
    expect(triageBpLevel(undefined, 88, 60)).toBe('low')
  })
})
