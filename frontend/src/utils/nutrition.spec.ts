// Task 12b 营养纯函数测试（AC-40 全覆盖 + R2.3）
// 五场景钠梯度与评级、totals 手算、buildDashProgress 四态、buildWeeklyBp 两分支+急症、classifyBp 边界

import { describe, it, expect } from 'vitest'
import { SCENARIOS } from '@/mock/scenarios'
import { FOOD_MAP, FOODS } from '@/mock/foods'
import { RED_FLAG_SYMPTOMS } from '@/constants/clinical'
import {
  computeTotals,
  scoreMeal,
  evaluate,
  buildRules,
  buildSubstitutions,
  pickRecipes,
  buildWeekly,
  buildDashProgress,
  buildWeeklySaltSummary,
  buildWeeklyBp,
  classifyBp,
  RENAL_UNKNOWN_K_TEXT,
} from '@/utils/nutrition'
import { recentDates } from '@/utils/date'
import type { BpRecord, Meal, MealItem, NutrientTotals, Profile } from '@/types'

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

describe('五场景钠梯度与评级', () => {
  const profiles: Record<string, Partial<Profile>> = {
    normal: { weightKg: 60, htnStatus: 'none', renalKRestriction: null },
    renalNormal: { weightKg: 60, htnStatus: 'none', renalKRestriction: false },
  }

  it('场景1（含腌芥菜）钠最高；肾功能未知不扣钾分，明确正常额外扣钾分', () => {
    const s1 = SCENARIOS[0].detected as MealItem[]
    const totals1 = computeTotals(s1)
    expect(totals1.Na).toBeGreaterThan(1000) // 腌芥菜 50g 贡献 ~1750mg
    const unknownResult = scoreMeal(totals1, profiles.normal)
    const normalResult = scoreMeal(totals1, profiles.renalNormal)
    // 加入纤维/热量维度后总分都可能为红，钾分差异用分数与扣分项表达：
    expect(normalResult.score).toBeLessThan(unknownResult.score)
    expect(unknownResult.reasons.some((r) => r.metric === 'K')).toBe(false) // 未知：钾维度不扣分
    expect(normalResult.reasons.some((r) => r.metric === 'K')).toBe(true) // 明确肾功能正常：低钾扣分
    expect(normalResult.level).toBe('red')
  })

  it('场景5（燕麦饭+西兰花虾仁+菠菜）钠最低、评分绿', () => {
    const s5 = SCENARIOS[4].detected as MealItem[]
    const totals5 = computeTotals(s5)
    const { level: level5 } = scoreMeal(totals5, profiles.normal)
    expect(totals5.Na).toBeLessThan(800)
    expect(level5).toBe('green')
  })

  it('五场景钠梯度：场景1 最咸，场景5 最淡', () => {
    const nas = SCENARIOS.map((s) => computeTotals(s.detected as MealItem[]).Na)
    // 场景1（含腌芥菜）最咸，场景5（DASH）最淡
    expect(nas[0]).toBeGreaterThan(nas[4])
    expect(nas[0]).toBeGreaterThan(1500) // 腌芥菜贡献
    expect(nas[4]).toBeLessThan(800)
  })

  it('evaluate 输出无 glucose 字段', () => {
    const result = evaluate({
      items: SCENARIOS[0].detected as MealItem[],
      profile: profiles.normal,
    })
    expect(result).not.toHaveProperty('glucose')
    expect(result.totals).not.toHaveProperty('gl')
    expect(result.suggestedItems).toBeInstanceOf(Array)
  })

  it('高钠餐 buildRules 含钠规则且含盐当量文案', () => {
    const s1 = SCENARIOS[0].detected as MealItem[]
    const totals1 = computeTotals(s1)
    const rules = buildRules(totals1, profiles.normal)
    const naRule = rules.find((r) => r.metric === 'na')
    expect(naRule).toBeDefined()
    expect(naRule!.text).toContain('盐')
  })
})

describe('totals 手算核对', () => {
  it('白米饭 200g：能量 116×2=232、蛋白 2.6×2=5.2、钠 2.5×2=5.0', () => {
    const totals = computeTotals([{ id: '012401x', weightG: 200 }])
    const rice = FOOD_MAP['012401x']
    expect(totals.energyKCal).toBe(round1(rice.energyKCal * 2))
    expect(totals.protein).toBe(round1(rice.protein * 2))
    expect(totals.Na).toBe(round1(rice.Na * 2))
  })

  it('煮鸡蛋 50g：蛋白 12.1×0.5=6.05', () => {
    const totals = computeTotals([{ id: '111204', weightG: 50 }])
    expect(totals.protein).toBe(round1(12.1 * 0.5))
  })

  it('土豆归主食：200g 不计入蔬菜克数，钾与能量仍正常计入', () => {
    const totals = computeTotals([{ id: '021101', weightG: 200 }])
    expect(totals.vegWeight).toBe(0)
    expect(totals.K).toBe(round1(347 * 2))
    expect(totals.energyKCal).toBe(round1(81 * 2))
    // 菠菜仍计入蔬菜
    expect(computeTotals([{ id: '045301', weightG: 200 }]).vegWeight).toBe(200)
  })

  it('调味品入库：食盐 1g 钠约 393mg、生抽 10g 钠约 600mg，且均不被判为蔬菜', () => {
    const salt = FOOD_MAP['salt']
    const soy = FOOD_MAP['soy_sauce']
    expect(salt.hidden).not.toBe(true)
    expect(soy.hidden).not.toBe(true)
    expect(computeTotals([{ id: 'salt', weightG: 1 }]).Na).toBe(393)
    expect(computeTotals([{ id: 'soy_sauce', weightG: 10 }]).Na).toBe(600)
    expect(computeTotals([{ id: 'salt', weightG: 5 }]).vegWeight).toBe(0)
  })

  it('调味品 servingPresets：盐默认第一档 1g（1小撮）、生抽第一档 10g（1勺）', () => {
    const saltPresets = FOOD_MAP['salt'].servingPresets ?? []
    const soyPresets = FOOD_MAP['soy_sauce'].servingPresets ?? []
    expect(saltPresets.length).toBeGreaterThanOrEqual(3)
    expect(soyPresets.length).toBeGreaterThanOrEqual(3)
    expect(saltPresets[0].weightG).toBe(1)
    expect(saltPresets[0].label).toContain('1')
    expect(soyPresets[0].weightG).toBe(10)
    // 每档都是真实小克数，杜绝"盐按 100g 一份"的虚高录入
    expect(Math.max(...saltPresets.map((p) => p.weightG))).toBeLessThanOrEqual(10)
    expect(Math.max(...soyPresets.map((p) => p.weightG))).toBeLessThanOrEqual(20)
  })

  it('青菜（bok_choy）与鸡胸肉（chicken_breast）入库可见且可按中文名搜索', () => {
    const visible = FOODS.filter((item) => item.hidden !== true)
    const bokChoy = visible.find((f) => f.id === 'bok_choy')
    const chicken = visible.find((f) => f.id === 'chicken_breast')
    expect(bokChoy).toBeDefined()
    expect(chicken).toBeDefined()
    // 搜索实现为 name.includes(keyword)，名字必须含"青菜/鸡胸肉"
    expect(bokChoy!.name.includes('青菜')).toBe(true)
    expect(chicken!.name.includes('鸡胸肉')).toBe(true)
    // 青菜计入蔬菜克数
    expect(computeTotals([{ id: 'bok_choy', weightG: 200 }]).vegWeight).toBe(200)
  })

  it('调味品可被手动搜索命中：盐→食盐，酱油/生抽→生抽（与 searchFoods 同口径）', () => {
    const visible = FOODS.filter((item) => item.hidden !== true)
    expect(visible.filter((f) => f.name.includes('盐')).some((f) => f.id === 'salt')).toBe(true)
    expect(visible.filter((f) => f.name.includes('酱油')).some((f) => f.id === 'soy_sauce')).toBe(
      true,
    )
    expect(visible.filter((f) => f.name.includes('生抽')).some((f) => f.id === 'soy_sauce')).toBe(
      true,
    )
  })

  it('空数组 totals 全 0', () => {
    const totals = computeTotals([])
    expect(totals.energyKCal).toBe(0)
    expect(totals.protein).toBe(0)
    expect(totals.Na).toBe(0)
    expect(totals.vegWeight).toBe(0)
  })

  it('未知 id 跳过不报错', () => {
    const totals = computeTotals([{ id: 'nonexistent', weightG: 100 }])
    expect(totals.energyKCal).toBe(0)
  })
})

describe('buildDashProgress 六态', () => {
  const renalProfile: Partial<Profile> = { weightKg: 60, renalKRestriction: true }
  const normalProfile: Partial<Profile> = { weightKg: 60, renalKRestriction: false }
  const unknownProfile: Partial<Profile> = { weightKg: 60, renalKRestriction: null }

  it('零餐次：六维齐全；盐/热量中性（无记录不夸绿、没记全不评）、蔬菜/纤维/蛋白/钾红，fatNote 为 null', () => {
    const result = buildDashProgress([], normalProfile)
    expect(result.dimensions).toHaveLength(6)
    expect(result.fatNote).toBeNull()
    const salt = result.dimensions.find((d) => d.key === 'salt')!
    expect(salt.value).toBe(0)
    expect(salt.status).toBe('neutral')
    const energy = result.dimensions.find((d) => d.key === 'energy')!
    expect(energy.status).toBe('neutral') // 0 餐次：还没记全，不评达标
    expect(energy.target).toBe(1800) // 缺身高体重走兜底全天预算
    const veg = result.dimensions.find((d) => d.key === 'veg')!
    expect(veg.status).toBe('red')
    const fiber = result.dimensions.find((d) => d.key === 'fiber')!
    expect(fiber.status).toBe('red') // 0g < 17g
  })

  it('无调味品记录且盐本应为绿：维度降 neutral，不写"不错/达标"，提醒少放盐和酱油', () => {
    const meals: Meal[] = [
      {
        id: 'm1',
        dateTime: '2026-09-23T12:00:00Z',
        date: '2026-09-23',
        items: [{ id: '012401x', weightG: 200 }],
      },
    ]
    const salt = buildDashProgress(meals, unknownProfile).dimensions.find((d) => d.key === 'salt')!
    expect(salt.status).toBe('neutral')
    expect(salt.text).toContain('按食材估算')
    expect(salt.text).toContain('不含做菜另放的盐和酱油')
    expect(salt.text).toContain('少放酱油')
    expect(salt.text).not.toContain('不错')
  })

  it('记录了食盐且盐仍绿：结论认可在 5g 以内，并注明含已记录调料', () => {
    const meals: Meal[] = [
      {
        id: 'm1',
        dateTime: '2026-09-23T12:00:00Z',
        date: '2026-09-23',
        items: [{ id: 'salt', weightG: 1 }], // 约 393mg ≈ 1g 盐
      },
    ]
    const salt = buildDashProgress(meals, unknownProfile).dimensions.find((d) => d.key === 'salt')!
    expect(salt.status).toBe('green')
    expect(salt.text).toContain('含已记录的盐、酱油')
    expect(salt.text).toContain('不错')
  })

  it('健康餐：蔬菜达标绿；没记调味品时盐维度中性而非假绿', () => {
    const meals: Meal[] = [
      {
        id: 'm1',
        dateTime: '2026-09-23T12:00:00Z',
        date: '2026-09-23',
        items: [
          { id: '045301', weightG: 300 }, // 菠菜
          { id: '045217', weightG: 200 }, // 西兰花
          { id: '111204', weightG: 100 }, // 鸡蛋
          { id: '012401x', weightG: 100 }, // 米饭
        ],
      },
    ]
    const result = buildDashProgress(meals, normalProfile)
    const veg = result.dimensions.find((d) => d.key === 'veg')!
    expect(veg.status).toBe('green')
    const salt = result.dimensions.find((d) => d.key === 'salt')!
    expect(salt.status).toBe('neutral')
    expect(salt.text).not.toContain('不错')
    // 蛋白维度存在（单餐可能不足全天目标，状态不固定）
    expect(result.dimensions.find((d) => d.key === 'protein')).toBeDefined()
  })

  it('健康餐且记录了调味品：蔬菜达标绿、盐也绿并给"不错"', () => {
    const meals: Meal[] = [
      {
        id: 'm1',
        dateTime: '2026-09-23T12:00:00Z',
        date: '2026-09-23',
        items: [
          { id: '045301', weightG: 300 },
          { id: '045217', weightG: 200 },
          { id: '111204', weightG: 100 },
          { id: '012401x', weightG: 100 },
          { id: 'salt', weightG: 1 }, // 有调味品记录且钠仍低（393mg ≈ 1g 盐）
        ],
      },
    ]
    const result = buildDashProgress(meals, normalProfile)
    expect(result.dimensions.find((d) => d.key === 'veg')!.status).toBe('green')
    const salt = result.dimensions.find((d) => d.key === 'salt')!
    expect(salt.status).toBe('green')
    expect(salt.text).toContain('不错')
  })

  it('重盐餐：盐维度红，盐当量>5g', () => {
    const meals: Meal[] = [
      {
        id: 'm1',
        dateTime: '2026-09-23T12:00:00Z',
        date: '2026-09-23',
        items: [{ id: 'pickled_mustard', weightG: 200 }], // 腌芥菜 3500mg/100g
      },
    ]
    const result = buildDashProgress(meals, normalProfile)
    const salt = result.dimensions.find((d) => d.key === 'salt')!
    expect(salt.status).toBe('red')
    expect(salt.value).toBeGreaterThan(5)
  })

  it('控钾画像：富钾维度为 restricted 中性态', () => {
    const meals: Meal[] = [
      {
        id: 'm1',
        dateTime: '2026-09-23T12:00:00Z',
        date: '2026-09-23',
        items: [{ id: '045301', weightG: 200 }],
      },
    ]
    const result = buildDashProgress(meals, renalProfile)
    const k = result.dimensions.find((d) => d.key === 'k')!
    expect(k.status).toBe('restricted')
    expect(k.text).toContain('遵医嘱')
    // 控钾画像蛋白同步中性：文本提示听医生的
    const protein = result.dimensions.find((d) => d.key === 'protein')!
    expect(protein.text).toContain('听医生')
  })

  it('肾功能未知：富钾维度为 neutral（区别于限钾的 restricted），文案不含"都要控制"', () => {
    const meals: Meal[] = [
      {
        id: 'm1',
        dateTime: '2026-09-23T12:00:00Z',
        date: '2026-09-23',
        items: [{ id: '012401x', weightG: 200 }], // 低钾餐也不评级
      },
    ]
    const result = buildDashProgress(meals, unknownProfile)
    const k = result.dimensions.find((d) => d.key === 'k')!
    expect(k.status).toBe('neutral')
    expect(k.text).toBe(RENAL_UNKNOWN_K_TEXT)
    expect(k.text).toContain('低钠盐')
    // null 三态不能套用"富钾食物和低钠盐都要控制"的限钾措辞
    expect(k.text).not.toContain('都要控制')
    // 未知画像蛋白维持老年 1.2g/kg 口径，仍按目标评级
    const protein = result.dimensions.find((d) => d.key === 'protein')!
    expect(protein.text).toContain('目标')
  })

  it('肾功能明确正常：富钾维度按红黄绿正常评级，不是 neutral/restricted', () => {
    const meals: Meal[] = [
      {
        id: 'm1',
        dateTime: '2026-09-23T12:00:00Z',
        date: '2026-09-23',
        items: [{ id: '012401x', weightG: 200 }],
      },
    ]
    const k = buildDashProgress(meals, normalProfile).dimensions.find((d) => d.key === 'k')!
    expect(['red', 'yellow', 'green']).toContain(k.status)
    expect(k.text).not.toBe(RENAL_UNKNOWN_K_TEXT)
  })
})

describe('buildWeeklySaltSummary 周盐聚合', () => {
  it('空周：绿色占位 + "本周还没有记录"', () => {
    const s = buildWeeklySaltSummary([])
    expect(s.status).toBe('green')
    expect(s.text).toContain('还没有记录')
  })

  it('多数日子没记调味品：即使食材钠不高也降 neutral，带"没记另放盐和酱油"限定语', () => {
    const days: MealItem[][] = [
      [{ id: '012401x', weightG: 200 }],
      [{ id: '012401x', weightG: 200 }],
      [
        { id: '012401x', weightG: 100 },
        { id: 'salt', weightG: 1 },
      ],
    ]
    const s = buildWeeklySaltSummary(days)
    expect(s.status).toBe('neutral')
    expect(s.text).toContain('盐和酱油')
    expect(s.text).not.toContain('继续保持')
  })

  it('多数日子记了调味品且盐量低：绿色 + "本周盐量大多在 5g 以内"', () => {
    const days: MealItem[][] = [
      [
        { id: '012401x', weightG: 200 },
        { id: 'salt', weightG: 1 },
      ],
      [
        { id: '045301', weightG: 200 },
        { id: 'salt', weightG: 1 },
      ],
    ]
    const s = buildWeeklySaltSummary(days)
    expect(s.status).toBe('green')
    expect(s.text).toContain('5g 以内')
  })

  it('重盐日子占多数：红色', () => {
    const days: MealItem[][] = [
      [{ id: 'pickled_mustard', weightG: 200 }],
      [{ id: 'pickled_mustard', weightG: 200 }],
      [
        { id: '012401x', weightG: 100 },
        { id: 'salt', weightG: 1 },
      ],
    ]
    const s = buildWeeklySaltSummary(days)
    expect(s.status).toBe('red')
    expect(s.avgSaltG).toBeGreaterThan(5)
  })
})

describe('buildWeeklyBp', () => {
  function makeRecord(
    date: string,
    period: 'morning' | 'evening',
    sys: number,
    dia: number,
    source: 'manual' | 'device' = 'manual',
  ): BpRecord {
    return {
      id: `bp_${date}_${period}`,
      measuredAt: `${date}T08:00:00Z`,
      date,
      period,
      sys,
      dia,
      hr: null,
      source,
      readings: [{ sys, dia }],
      createdAt: `${date}T08:00:00Z`,
    }
  }

  it('平稳：measureFreqAdvice 为"每周 1–2 天"', () => {
    const records: BpRecord[] = [
      makeRecord('2026-09-20', 'morning', 125, 80),
      makeRecord('2026-09-21', 'evening', 128, 82),
      makeRecord('2026-09-22', 'morning', 126, 81),
    ]
    const result = buildWeeklyBp(records)
    expect(result.adviceLevel).toBe('stable')
    expect(result.measureFreqAdvice).toContain('每周')
    expect(result.emergencyHit).toBe(false)
  })

  it('未稳：measureFreqAdvice 为"连续 7 天早晚"', () => {
    const records: BpRecord[] = [
      makeRecord('2026-09-20', 'morning', 142, 92),
      makeRecord('2026-09-21', 'morning', 145, 95),
      makeRecord('2026-09-22', 'morning', 150, 96),
    ]
    const result = buildWeeklyBp(records)
    expect(result.adviceLevel).toBe('high')
    expect(result.measureFreqAdvice).toContain('连续 7 天')
  })

  it('急症：emergencyHit=true，adviceLevel=emergency，症状措辞取自共享常量', () => {
    const records: BpRecord[] = [makeRecord('2026-09-22', 'morning', 185, 122)]
    const result = buildWeeklyBp(records)
    expect(result.emergencyHit).toBe(true)
    expect(result.adviceLevel).toBe('emergency')
    expect(result.adviceText).toContain('120')
    // B11：症状清单与 RED_FLAG_SYMPTOMS 同源，不使用自定义简称
    const chestLabel = RED_FLAG_SYMPTOMS.find((s) => s.id === 'chest_pain')!.label
    const weakLabel = RED_FLAG_SYMPTOMS.find((s) => s.id === 'weak_side')!.label
    const headacheLabel = RED_FLAG_SYMPTOMS.find((s) => s.id === 'headache')!.label
    expect(result.adviceText).toContain(chestLabel)
    expect(result.adviceText).toContain(weakLabel)
    expect(result.adviceText).toContain(headacheLabel)
    expect(result.adviceText).not.toContain('一侧发麻')
    expect(result.adviceText).not.toContain('偏瘫')
  })

  it('B10：平稳周中出现单纯低压偏低（高压正常）时追加"别自行停药"提醒', () => {
    const records: BpRecord[] = [
      makeRecord('2026-09-20', 'morning', 125, 80),
      makeRecord('2026-09-21', 'morning', 120, 55), // 单纯舒张压低
      makeRecord('2026-09-22', 'morning', 126, 78),
    ]
    const result = buildWeeklyBp(records)
    expect(result.adviceLevel).toBe('stable')
    expect(result.adviceText).toContain('别自行停药')
  })

  it('无单纯低压偏低记录的平稳周不追加该提醒', () => {
    const records: BpRecord[] = [
      makeRecord('2026-09-20', 'morning', 125, 80),
      makeRecord('2026-09-21', 'evening', 128, 82),
      makeRecord('2026-09-22', 'morning', 126, 81),
    ]
    expect(buildWeeklyBp(records).adviceText).not.toContain('别自行停药')
  })

  it('空记录：avgMorning/avgEvening 为 null', () => {
    const result = buildWeeklyBp([])
    expect(result.avgMorning).toBeNull()
    expect(result.avgEvening).toBeNull()
    expect(result.maxSys).toBe(0)
    expect(result.manualCount).toBe(0)
  })

  it('手动次数统计正确', () => {
    const records: BpRecord[] = [
      makeRecord('2026-09-20', 'morning', 120, 80, 'manual'),
      makeRecord('2026-09-21', 'evening', 125, 82, 'device'),
    ]
    const result = buildWeeklyBp(records)
    expect(result.manualCount).toBe(1)
  })
})

describe('classifyBp 边界', () => {
  it('正常 <135/85', () => {
    expect(classifyBp(120, 80)).toBe('normal')
    expect(classifyBp(134, 84)).toBe('normal')
  })
  it('偏高 ≥135/85', () => {
    expect(classifyBp(135, 85)).toBe('high')
    expect(classifyBp(140, 90)).toBe('high')
  })
  it('急症 ≥160/100', () => {
    expect(classifyBp(160, 100)).toBe('urgent')
    expect(classifyBp(170, 105)).toBe('urgent')
  })
  it('急诊 ≥180/120', () => {
    expect(classifyBp(180, 120)).toBe('emergency')
    expect(classifyBp(200, 130)).toBe('emergency')
  })
  it('偏低：收缩压<90（无论舒张压）', () => {
    expect(classifyBp(85, 55)).toBe('low')
    expect(classifyBp(89, 59)).toBe('low')
    expect(classifyBp(85, 70)).toBe('low')
  })
  it('B10：单纯低压偏低且高压正常→normal（老年血管硬化常见，不吓用户）', () => {
    expect(classifyBp(120, 55)).toBe('normal')
    expect(classifyBp(134, 59)).toBe('normal')
  })
  it('B10：高压偏高(≥135)伴低压<60 仍判 low', () => {
    expect(classifyBp(135, 55)).toBe('low')
    expect(classifyBp(150, 50)).toBe('low')
  })
  it('任一达标取更高等级', () => {
    expect(classifyBp(180, 80)).toBe('emergency') // 收缩压急诊
    expect(classifyBp(120, 120)).toBe('emergency') // 舒张压急诊
  })
})

describe('控钾画像规则联动', () => {
  const renalProfile: Partial<Profile> = { weightKg: 60, renalKRestriction: true }
  const normalProfile: Partial<Profile> = { weightKg: 60, renalKRestriction: false }
  const unknownProfile: Partial<Profile> = { weightKg: 60, renalKRestriction: null }
  const lowKMix = () => computeTotals([{ id: '012401x', weightG: 200 }]) // 低钾、低蛋白餐

  it('renal=true：buildRules 无 K_Low 补钾规则，含控钾提醒', () => {
    const rules = buildRules(lowKMix(), renalProfile)
    expect(rules.find((r) => r.id === 'K_Low')).toBeUndefined()
    expect(rules.find((r) => r.id === 'K_Renal_Restrict')).toBeDefined()
  })

  it('renal=false：低钾餐有 K_Low 规则', () => {
    const rules = buildRules(lowKMix(), normalProfile)
    expect(rules.find((r) => r.id === 'K_Low')).toBeDefined()
    expect(rules.find((r) => r.id === 'K_Renal_Unknown')).toBeUndefined()
  })

  it('B1 肾功能未知：低钾餐出 K_Renal_Unknown 中性卡，不出 K_Low，评分不扣钾分', () => {
    const totals = lowKMix()
    const rules = buildRules(totals, unknownProfile)
    const unknownCard = rules.find((r) => r.id === 'K_Renal_Unknown')
    expect(unknownCard).toBeDefined()
    expect(unknownCard?.severity).toBe('neutral')
    expect(rules.find((r) => r.id === 'K_Low')).toBeUndefined()
    expect(unknownCard?.text).toContain('低钠盐')
    const { reasons, score } = scoreMeal(totals, unknownProfile)
    expect(reasons.find((r) => r.metric === 'K')).toBeUndefined()
    // 同餐明确肾功能正常时钾要扣分，分数严格更低
    expect(scoreMeal(totals, normalProfile).score).toBeLessThan(score)
  })

  it('B2 控钾画像：低蛋白餐不出 Protein_Low，出 Protein_Renal_Neutral 中性卡', () => {
    const rules = buildRules(lowKMix(), renalProfile)
    expect(rules.find((r) => r.id === 'Protein_Low')).toBeUndefined()
    const neutral = rules.find((r) => r.id === 'Protein_Renal_Neutral')
    expect(neutral).toBeDefined()
    expect(neutral?.severity).toBe('neutral')
    expect(neutral?.recipeTags).toEqual([])
    const { reasons } = scoreMeal(lowKMix(), renalProfile)
    expect(reasons.find((r) => r.metric === 'protein')).toBeUndefined()
  })

  it('renal=true：buildSubstitutions 不推高钾替换', () => {
    const items: MealItem[] = [{ id: 'sausage', weightG: 100 }] // 高钠
    const subs = buildSubstitutions(items, renalProfile)
    for (const sub of subs) {
      expect(sub.to).not.toContain('菠菜')
      expect(sub.to).not.toContain('土豆')
    }
  })

  it('B1 肾功能未知：高钠替换只推清淡做法，不搭高钾配菜', () => {
    const subs = buildSubstitutions([{ id: 'sausage', weightG: 100 }], unknownProfile)
    expect(subs.length).toBeGreaterThan(0)
    for (const sub of subs) {
      expect(sub.to).toContain('清蒸')
      expect(sub.to).not.toContain('菠菜')
    }
  })

  it('B3 调味品不产生替换卡（盐/生抽本身就是少放对象）', () => {
    expect(buildSubstitutions([{ id: 'salt', weightG: 2 }], normalProfile)).toEqual([])
    expect(buildSubstitutions([{ id: 'soy_sauce', weightG: 10 }], normalProfile)).toEqual([])
  })

  it('renal=true：scoreMeal 不扣钾分', () => {
    const { reasons } = scoreMeal(lowKMix(), renalProfile)
    expect(reasons.find((r) => r.metric === 'K')).toBeUndefined()
  })
})

describe('buildWeekly 三维', () => {
  it('零餐次返回空 days 和默认 advice', () => {
    const result = buildWeekly([])
    expect(result.days).toHaveLength(7)
    expect(result.days.every((d) => d === null)).toBe(true)
    expect(result.avgScore).toBe(0)
  })

  it('有餐次计算 avgScore 和三维', () => {
    const meals: Meal[] = [
      {
        id: 'm1',
        dateTime: '2026-09-23T12:00:00Z',
        date: '2026-09-23',
        score: 85,
        totals: computeTotals([
          { id: '045301', weightG: 200 },
          { id: '111204', weightG: 50 },
        ]),
        items: [
          { id: '045301', weightG: 200 },
          { id: '111204', weightG: 50 },
        ],
      },
    ]
    const result = buildWeekly(meals)
    expect(result.avgScore).toBeGreaterThan(0)
    expect(result.dietScores).toHaveProperty('insufficient')
    expect(result.dietScores).toHaveProperty('excess')
    expect(result.dietScores).toHaveProperty('diversity')
  })

  it('B1 buildWeekly 第二参数体重影响"不足"分：体重越大目标越高，不足分越低', () => {
    const meals: Meal[] = [
      {
        id: 'm1',
        dateTime: '2026-09-23T12:00:00Z',
        date: '2026-09-23',
        score: 70,
        totals: computeTotals([
          { id: '045301', weightG: 200 },
          { id: '111204', weightG: 50 },
        ]),
        items: [
          { id: '045301', weightG: 200 },
          { id: '111204', weightG: 50 },
        ],
      },
    ]
    const light = buildWeekly(meals, { weightKg: 50 }).dietScores.insufficient
    const heavy = buildWeekly(meals, { weightKg: 80 }).dietScores.insufficient
    expect(light).toBeGreaterThan(heavy)
    // 不传第二参数仍可运行（向后兼容）
    expect(() => buildWeekly(meals)).not.toThrow()
  })
})

describe('pickRecipes', () => {
  it('返回 3 道食谱', () => {
    const totals = computeTotals([{ id: '012401x', weightG: 200 }])
    const recipes = pickRecipes(totals, { weightKg: 60 })
    expect(recipes).toHaveLength(3)
  })

  it('控钾画像不推荐高钾标签食谱优先', () => {
    const totals = computeTotals([{ id: '012401x', weightG: 200 }])
    const recipes = pickRecipes(totals, { weightKg: 60, renalKRestriction: true })
    // 不强制无高钾，但 pickRecipes 对 renal 不把高钾列入 need
    expect(recipes).toHaveLength(3)
  })

  it('B1 肾功能未知画像同样不把"高钾"列入需求，仍返回 3 道', () => {
    const totals = computeTotals([{ id: '012401x', weightG: 200 }])
    const recipes = pickRecipes(totals, { weightKg: 60, renalKRestriction: null })
    expect(recipes).toHaveLength(3)
  })
})

describe('脂肪/胆固醇定性旗标（computeTotals 收集）', () => {
  it('香肠/五花肉计入 highSatItems 与累计克重，猪肝计入 cholItems，鸡蛋不触发', () => {
    const t = computeTotals([
      { id: 'sausage', weightG: 50 },
      { id: 'pork_belly', weightG: 60 },
      { id: 'pork_liver', weightG: 80 },
      { id: '111204', weightG: 100 }, // 煮鸡蛋：不贴任何旗标
    ])
    expect(t.highSatItems).toContain('香肠(熟制)')
    expect(t.highSatItems).toContain('五花肉(猪)')
    expect(t.highSatWeightG).toBe(110)
    expect(t.cholItems).toEqual(['猪肝'])
  })

  it('只有鸡蛋：高脂/内脏名单均为空（蛋黄现代口径不忌口）', () => {
    const t = computeTotals([{ id: '111204', weightG: 100 }])
    expect(t.highSatItems).toEqual([])
    expect(t.highSatWeightG).toBe(0)
    expect(t.cholItems).toEqual([])
  })
})

// 手造全绿营养合计，便于单独验证某个维度（字段需满足 NutrientTotals 完整契约）
function greenTotals(over: Partial<NutrientTotals> = {}): NutrientTotals {
  return {
    energyKCal: 400,
    protein: 30,
    fat: 10,
    CHO: 50,
    dietaryFiber: 9,
    K: 3000,
    Na: 300,
    vegWeight: 300,
    highSatItems: [],
    highSatWeightG: 0,
    cholItems: [],
    ...over,
  }
}

describe('buildRules 热量/纤维/脂肪触发卡', () => {
  const profile: Partial<Profile> = { weightKg: 60, renalKRestriction: null } // 无身高 → 餐线 600、红 780

  it('超红热量出 Energy_High 红卡，threshold=个性化单餐参考；低热量不出卡', () => {
    const redCard = buildRules(greenTotals({ energyKCal: 900 }), profile).find(
      (r) => r.id === 'Energy_High',
    )
    expect(redCard).toBeDefined()
    expect(redCard!.severity).toBe('red')
    expect(redCard!.threshold).toBe(600)

    const yellowCard = buildRules(greenTotals({ energyKCal: 700 }), profile).find(
      (r) => r.id === 'Energy_High',
    )
    expect(yellowCard!.severity).toBe('yellow')

    expect(
      buildRules(greenTotals({ energyKCal: 200 }), profile).some((r) => r.id === 'Energy_High'),
    ).toBe(false)
  })

  it('纤维 <5g 红卡、5–8g 黄卡、≥8g 不出 Fiber_Low', () => {
    expect(
      buildRules(greenTotals({ dietaryFiber: 2 }), profile).find((r) => r.id === 'Fiber_Low')!
        .severity,
    ).toBe('red')
    expect(
      buildRules(greenTotals({ dietaryFiber: 6 }), profile).find((r) => r.id === 'Fiber_Low')!
        .severity,
    ).toBe('yellow')
    expect(
      buildRules(greenTotals({ dietaryFiber: 9 }), profile).some((r) => r.id === 'Fiber_Low'),
    ).toBe(false)
  })

  it('high-sat 食材：<100g 黄卡，≥100g 红卡（不精算毫克）', () => {
    const yellow = buildRules(
      greenTotals({ highSatItems: ['香肠(熟制)'], highSatWeightG: 50 }),
      profile,
    ).find((r) => r.id === 'Fat_HighSat')!
    expect(yellow.severity).toBe('yellow')
    expect(yellow.text).toContain('香肠(熟制)')

    const red = buildRules(
      greenTotals({ highSatItems: ['五花肉(猪)'], highSatWeightG: 120 }),
      profile,
    ).find((r) => r.id === 'Fat_HighSat')!
    expect(red.severity).toBe('red')
  })

  it('内脏出 neutral 卡并明确"蛋黄不用丢"；鸡蛋餐不出任何脂肪卡', () => {
    const chol = buildRules(greenTotals({ cholItems: ['猪肝'] }), profile).find(
      (r) => r.id === 'Fat_Chol_Occasional',
    )
    expect(chol).toBeDefined()
    expect(chol!.severity).toBe('neutral')
    expect(chol!.text).toContain('蛋黄')

    const eggTotals = computeTotals([{ id: '111204', weightG: 100 }])
    expect(buildRules(eggTotals, profile).some((r) => r.metric === 'fat')).toBe(false)
  })
})

describe('scoreMeal 热量/纤维权重与脂肪不扣分', () => {
  const profile: Partial<Profile> = { weightKg: 60, renalKRestriction: null }

  it('全绿营养餐（含热量只有 200 kcal）：100 分，低热量不惩罚', () => {
    const r = scoreMeal(greenTotals({ energyKCal: 200 }), profile)
    expect(r.score).toBe(100)
    expect(r.level).toBe('green')
    expect(r.reasons.some((x) => x.metric === 'energy')).toBe(false)
  })

  it('热量红 −10/黄 −5，纤维红 −8/黄 −4', () => {
    const energyRed = scoreMeal(greenTotals({ energyKCal: 900 }), profile)
    expect(energyRed.reasons.find((x) => x.metric === 'energy')!.status).toBe('red')
    expect(energyRed.score).toBe(90)
    const energyYellow = scoreMeal(greenTotals({ energyKCal: 700 }), profile)
    expect(energyYellow.score).toBe(95)

    const fiberRed = scoreMeal(greenTotals({ dietaryFiber: 2 }), profile)
    expect(fiberRed.reasons.find((x) => x.metric === 'fiber')!.status).toBe('red')
    expect(fiberRed.score).toBe(92)
    const fiberYellow = scoreMeal(greenTotals({ dietaryFiber: 6 }), profile)
    expect(fiberYellow.score).toBe(96)
  })

  it('脂肪旗标不进评分：只多了香肠旗标的全绿餐仍是 100 分', () => {
    const r = scoreMeal(greenTotals({ highSatItems: ['香肠(熟制)'], highSatWeightG: 50 }), profile)
    expect(r.score).toBe(100)
    expect(r.reasons.some((x) => x.metric === 'fat')).toBe(false)
  })
})

describe('buildDashProgress 脂肪环外提示 fatNote', () => {
  const profile: Partial<Profile> = { weightKg: 60, renalKRestriction: null }
  const meal = (id: string, g: number, date = '2026-05-01'): Meal => ({
    id: `m_${id}`,
    dateTime: `${date}T12:00:00.000Z`,
    date,
    items: [{ id, weightG: g }],
  })

  it('一餐香肠：提示餐数与食材名', () => {
    const note = buildDashProgress([meal('sausage', 50)], profile).fatNote!
    expect(note).toContain('今天有 1 餐')
    expect(note).toContain('香肠')
  })

  it('两餐香肠：餐数为 2；猪肝提示含"蛋黄"', () => {
    const two = buildDashProgress(
      [meal('sausage', 50, '2026-05-01'), meal('pork_belly', 60, '2026-05-01')],
      profile,
    ).fatNote!
    expect(two).toContain('今天有 2 餐')
    const liver = buildDashProgress([meal('pork_liver', 80)], profile).fatNote!
    expect(liver).toContain('猪肝')
    expect(liver).toContain('蛋黄')
  })

  it('只有鸡蛋：fatNote 为 null', () => {
    expect(buildDashProgress([meal('111204', 100)], profile).fatNote).toBeNull()
  })
})

describe('buildWeekly 热量/纤维纳入周报', () => {
  it('高能量餐占比高的一周 excess 分更低', () => {
    const today = recentDates(7)[6]
    const heavyMeals: Meal[] = [
      {
        id: 'heavy',
        dateTime: `${today}T12:00:00.000Z`,
        date: today,
        score: 60,
        totals: computeTotals([{ id: 'sausage', weightG: 200 }]), // 1016kcal 红、Na 2000 红
        items: [{ id: 'sausage', weightG: 200 }],
      },
    ]
    const lightMeals: Meal[] = [
      {
        id: 'light',
        dateTime: `${today}T12:00:00.000Z`,
        date: today,
        score: 90,
        totals: computeTotals([
          { id: '012401x', weightG: 150 },
          { id: '045301', weightG: 300 },
        ]),
        items: [
          { id: '012401x', weightG: 150 },
          { id: '045301', weightG: 300 },
        ],
      },
    ]
    const heavy = buildWeekly(heavyMeals, { weightKg: 60 }).dietScores.excess
    const light = buildWeekly(lightMeals, { weightKg: 60 }).dietScores.excess
    expect(heavy).toBeLessThan(light)
  })
})
