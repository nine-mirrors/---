// 热量个性化预算 + 热量/纤维评级纯函数测试
// 阈值口径与冻结的规则矩阵一致：IBW=身高−105、系数25/30/35、clamp 1200–2400

import { describe, it, expect } from 'vitest'
import {
  energyBudget,
  energyMealStatus,
  energyDayStatus,
  fiberMealStatus,
  fiberDayStatus,
} from '@/utils/dietTargets'
import type { Profile } from '@/types'

describe('energyBudget 个性化全天热量预算', () => {
  it('缺身高或缺体重：兜底 1800/餐 600，fallback=true', () => {
    expect(energyBudget({}).dayKcal).toBe(1800)
    expect(energyBudget({ weightKg: 60 }).fallback).toBe(true)
    expect(energyBudget({ heightCm: 165 }).dayKcal).toBe(1800)
    const b = energyBudget()
    expect(b.mealKcal).toBe(600)
    expect(b.ibw).toBeNull()
  })

  it('正常体重：实际体重 × 活动系数（少25/中30/多35）', () => {
    // 170cm IBW=65；65kg 落在 58.5–71.5 正常区间
    const p: Partial<Profile> = { heightCm: 170, weightKg: 65 }
    expect(energyBudget({ ...p, activity: 'low' }).dayKcal).toBe(1625) // 65×25
    expect(energyBudget({ ...p, activity: 'mid' }).dayKcal).toBe(1950) // 65×30
    expect(energyBudget({ ...p, activity: 'high' }).dayKcal).toBe(2275) // 65×35
    expect(energyBudget({ ...p, activity: 'mid' }).ibw).toBe(65)
    expect(energyBudget({ ...p, activity: 'mid' }).mealKcal).toBe(650) // 1950/3
  })

  it('超重（>IBW×1.1）：预算按 IBW 算，不被大体重放大', () => {
    // 160cm IBW=55；超重线 60.5；75kg 超重 → 55×25(low)=1375
    const b = energyBudget({ heightCm: 160, weightKg: 75, activity: 'low' })
    expect(b.dayKcal).toBe(1375)
    expect(b.fallback).toBe(false)
  })

  it('偏瘦（<IBW×0.9）：固定 30 kcal/kg 实际体重给足，活动量再少也不压低（防肌少症）', () => {
    // 170cm IBW=65；偏瘦线 58.5；45kg 偏瘦 → 45×30=1350（即便活动量"少"也不用 25）
    const b = energyBudget({ heightCm: 170, weightKg: 45, activity: 'low' })
    expect(b.dayKcal).toBe(1350)
  })

  it('clamp 1200–2400：过瘦/过高活动量也不越界', () => {
    // 145cm IBW=40，偏瘦线 36；35kg → 35×30=1050 → 兜底到 1200
    expect(energyBudget({ heightCm: 145, weightKg: 35, activity: 'low' }).dayKcal).toBe(1200)
    // 180cm IBW=80，80kg 正常高活动 → 2800 → 压到 2400
    expect(energyBudget({ heightCm: 180, weightKg: 80, activity: 'high' }).dayKcal).toBe(2400)
  })
})

describe('energyMealStatus 单餐热量（只红超标，偏低绿）', () => {
  // 兜底画像：餐线 600，黄 690、红 780
  it('兜底口径：≤690 绿、690–780 黄、>780 红；偏低不警告', () => {
    expect(energyMealStatus(300)).toBe('green')
    expect(energyMealStatus(690)).toBe('green') // 等于黄线不算超
    expect(energyMealStatus(691)).toBe('yellow')
    expect(energyMealStatus(780)).toBe('yellow')
    expect(energyMealStatus(781)).toBe('red')
  })

  it('个性化餐线跟随预算（超重 160/75/low：餐 458，红 596）', () => {
    const p = { heightCm: 160, weightKg: 75, activity: 'low' }
    expect(energyMealStatus(460, p)).toBe('green')
    expect(energyMealStatus(530, p)).toBe('yellow') // >458×1.15≈527
    expect(energyMealStatus(600, p)).toBe('red') // >458×1.3≈596
  })
})

describe('energyDayStatus 全天累计', () => {
  it('记录不足 2 餐且未到红线：neutral（还没记全），不夸绿也不吓唬', () => {
    expect(energyDayStatus(0, 0)).toBe('neutral')
    expect(energyDayStatus(800, 1)).toBe('neutral')
    // 1 餐吃到 1900（≤1800×1.1=1980）仍 neutral
    expect(energyDayStatus(1900, 1)).toBe('neutral')
  })

  it('记录 ≥2 餐：未超预算绿、刚超黄、超 1.1 红（红不受餐次限制）', () => {
    expect(energyDayStatus(1800, 2)).toBe('green')
    expect(energyDayStatus(1801, 2)).toBe('yellow') // >1800×1.0
    expect(energyDayStatus(2000, 2)).toBe('red') // >1800×1.1=1980
    // 只记 1 餐但严重超标照样红
    expect(energyDayStatus(2000, 1)).toBe('red')
  })
})

describe('纤维评级边界', () => {
  it('fiberMealStatus：<5 红、5–8 黄、≥8 绿', () => {
    expect(fiberMealStatus(4.9)).toBe('red')
    expect(fiberMealStatus(5)).toBe('yellow')
    expect(fiberMealStatus(7.9)).toBe('yellow')
    expect(fiberMealStatus(8)).toBe('green')
  })

  it('fiberDayStatus：<17 红、17–25 黄、≥25 绿', () => {
    expect(fiberDayStatus(16)).toBe('red')
    expect(fiberDayStatus(17)).toBe('yellow')
    expect(fiberDayStatus(24.9)).toBe('yellow')
    expect(fiberDayStatus(25)).toBe('green')
  })
})
