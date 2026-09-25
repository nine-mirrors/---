// healthAssess 测试：assessHypertension 五路径、buildOnboardingSummary、occupationToActivity

import { describe, it, expect } from 'vitest'
import {
  assessHypertension,
  buildOnboardingSummary,
  occupationToActivity,
  bmiOf,
  bmiHint,
} from '@/utils/healthAssess'

describe('assessHypertension 五路径', () => {
  it('空输入：none', () => {
    const r = assessHypertension()
    expect(r.status).toBe('none')
    expect(r.seekCare).toBe(false)
  })

  it('症状2：mild_risk', () => {
    const r = assessHypertension({ symptoms: ['头晕', '头痛'] })
    expect(r.status).toBe('mild_risk')
  })

  it('因素4：high_risk', () => {
    const r = assessHypertension({ factors: ['父母高血压', '口味咸', '少运动', '超重'] })
    expect(r.status).toBe('high_risk')
  })

  it('症状2+因素2：high_risk', () => {
    const r = assessHypertension({ symptoms: ['头晕', '头痛'], factors: ['父母高血压', '口味咸'] })
    expect(r.status).toBe('high_risk')
  })

  it('红旗：seekCare=true', () => {
    const r = assessHypertension({ redFlags: ['剧烈头痛'] })
    expect(r.seekCare).toBe(true)
    expect(r.advice).toContain('120')
  })
})

describe('buildOnboardingSummary', () => {
  it('confirmed+牙口不好：含血压监测与易咀嚼建议', () => {
    const s = buildOnboardingSummary({
      htnStatus: 'confirmed',
      dental: '不好',
      weightKg: 60,
      heightCm: 160,
    })
    expect(s.tips.some((t) => t.includes('血压'))).toBe(true)
    expect(s.tips.some((t) => t.includes('软嫩') || t.includes('好嚼'))).toBe(true)
  })

  it('none+重口：含减盐建议', () => {
    const s = buildOnboardingSummary({ htnStatus: 'none', taste: '重口', weightKg: 60 })
    expect(s.tips.some((t) => t.includes('盐'))).toBe(true)
  })

  it('renalKRestriction=true：含控钾建议', () => {
    const s = buildOnboardingSummary({ renalKRestriction: true, weightKg: 60 })
    expect(s.tips.some((t) => t.includes('钾'))).toBe(true)
  })

  it('蛋白目标 = 体重×1.2', () => {
    const s = buildOnboardingSummary({ weightKg: 70 })
    expect(s.proteinTarget).toBe(Math.round(70 * 1.2))
  })

  it('无体重时蛋白目标为 0', () => {
    const s = buildOnboardingSummary({})
    expect(s.proteinTarget).toBe(0)
  })
})

describe('occupationToActivity', () => {
  it('retired→low', () => expect(occupationToActivity('retired')).toBe('low'))
  it('sedentary→low', () => expect(occupationToActivity('sedentary')).toBe('low'))
  it('standing→mid', () => expect(occupationToActivity('standing')).toBe('mid'))
  it('labor→high', () => expect(occupationToActivity('labor')).toBe('high'))
  it('other→null', () => expect(occupationToActivity('other')).toBeNull())
})

describe('bmi 计算', () => {
  it('170cm/65kg → 22.5', () => {
    expect(bmiOf(170, 65)).toBe(22.5)
  })
  it('缺失返回 null', () => {
    expect(bmiOf(null, 65)).toBeNull()
  })
  it('bmiHint 分档', () => {
    expect(bmiHint(17)).toBe('underweight')
    expect(bmiHint(22)).toBe('normal')
    expect(bmiHint(26)).toBe('overweight')
    expect(bmiHint(30)).toBe('obese')
  })
})
