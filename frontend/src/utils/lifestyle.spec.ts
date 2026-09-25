// 戒烟限酒生活方式提醒测试：
// 仅画像 smoke/drink === '是' 出现；酒量按性别；近 7 天 ≥160/100 加强为滴酒不沾

import { describe, it, expect } from 'vitest'
import { buildLifestyleTips, hasRecentHighBp } from '@/utils/lifestyle'
import type { BpRecord, Profile } from '@/types'

function bp(sys: number, dia: number): BpRecord {
  return {
    id: `bp_${sys}_${dia}`,
    measuredAt: '2026-05-01T08:00:00.000Z',
    date: '2026-05-01',
    period: 'morning',
    sys,
    dia,
    hr: 72,
    source: 'manual',
    readings: [{ sys, dia }],
    createdAt: '2026-05-01T08:00:00.000Z',
  }
}

describe('buildLifestyleTips 画像门控', () => {
  it('画像未勾选吸烟饮酒：不出任何卡', () => {
    expect(buildLifestyleTips({ smoke: '否', drink: '否' })).toHaveLength(0)
    expect(buildLifestyleTips({})).toHaveLength(0)
  })

  it('只吸烟：1 张烟卡，含 12320 戒烟热线；无酒卡', () => {
    const tips = buildLifestyleTips({ smoke: '是', drink: '否', gender: 'male' })
    expect(tips).toHaveLength(1)
    expect(tips[0].key).toBe('smoke')
    expect(tips[0].text).toContain('12320')
    expect(tips[0].urgent).toBe(false)
  })

  it('只饮酒：1 张酒卡', () => {
    const tips = buildLifestyleTips({ smoke: '否', drink: '是' })
    expect(tips).toHaveLength(1)
    expect(tips[0].key).toBe('alcohol')
  })

  it('烟酒都有：2 张卡，顺序烟在前', () => {
    const tips = buildLifestyleTips({ smoke: '是', drink: '是' })
    expect(tips.map((t) => t.key)).toEqual(['smoke', 'alcohol'])
  })
})

describe('酒量按性别（膳食指南男25g/女15g 酒精）', () => {
  it('男性（含未填性别默认口径）：25 克', () => {
    expect(buildLifestyleTips({ drink: '是', gender: 'male' })[0].text).toContain('25 克')
    expect(buildLifestyleTips({ drink: '是' })[0].text).toContain('25 克')
  })

  it('女性：15 克', () => {
    expect(buildLifestyleTips({ drink: '是', gender: 'female' })[0].text).toContain('15 克')
  })

  it('常规口径给出白酒1两/红酒/啤酒的白话换算', () => {
    const text = buildLifestyleTips({ drink: '是', gender: 'male' })[0].text
    expect(text).toContain('白酒1两')
  })
})

describe('hasRecentHighBp 近 7 天高危判定（≥160/100）', () => {
  it('160 收缩或 100 舒张即高危；159/99 不算', () => {
    expect(hasRecentHighBp([bp(160, 95)])).toBe(true)
    expect(hasRecentHighBp([bp(150, 100)])).toBe(true)
    expect(hasRecentHighBp([bp(159, 99)])).toBe(false)
    expect(hasRecentHighBp([bp(135, 85)])).toBe(false)
    expect(hasRecentHighBp([])).toBe(false)
  })
})

describe('高危血压下提醒加强', () => {
  const drinker: Partial<Profile> = { smoke: '是', drink: '是', gender: 'female' }

  it('近 7 天有 160/100：烟酒卡 urgent，酒卡改"一滴别沾"，女性 15g 常规文案不再出现', () => {
    const tips = buildLifestyleTips(drinker, [bp(162, 98)])
    expect(tips.every((t) => t.urgent)).toBe(true)
    const alcohol = tips.find((t) => t.key === 'alcohol')!
    expect(alcohol.text).toContain('一滴别沾')
    expect(alcohol.text).not.toContain('15 克')
  })

  it('只是 135/85 偏高：不加强，仍给限量口径', () => {
    const tips = buildLifestyleTips(drinker, [bp(140, 88)])
    expect(tips.every((t) => t.urgent)).toBe(false)
    expect(tips.find((t) => t.key === 'alcohol')!.text).toContain('15 克')
  })

  it('急症 180/120 当然也触发加强', () => {
    const tips = buildLifestyleTips({ drink: '是' }, [bp(180, 120)])
    expect(tips[0].urgent).toBe(true)
  })
})
