// 健康问卷评估：高血压风险经验规则、BMI、职业活动量、问卷结论
// 注意：均为演示版经验规则，非医学诊断
// R2.3：移除糖尿病/甜食相关分支

import { OCCUPATION_ACTIVITY, BMI_HINTS } from '@/constants/onboarding'
import { redFlagBriefs } from '@/constants/clinical'
import type { HtnStatus, Profile } from '@/types'

// 红旗提醒句：症状短词从临床共享清单派生，不再手写第三份词表
const SEEK_CARE_SENTENCE = `如果出现${redFlagBriefs([
  'headache',
  'chest_pain',
  'weak_side',
  'face_speech',
]).join('、')}，请立即就医或拨打 120。`

export type AssessStatus = 'none' | 'mild_risk' | 'high_risk'
export type BmiHintKey = 'underweight' | 'normal' | 'overweight' | 'obese'

const ADVICE_TEXT: Record<AssessStatus, string> = {
  none: '目前没有明显趋势，保持每年体检、平时少盐多走动。',
  mild_risk: '有点像血压偏高的表现，建议最近每天早晚各量一次血压，饭菜再淡一点，饭后多散步。',
  high_risk: '建议尽快到社区医院或门诊量个血压确认一下，别自己吓自己，也别拖着。',
}

export interface AssessInput {
  symptoms?: string[]
  factors?: string[]
  redFlags?: string[]
}

export interface AssessResult {
  status: AssessStatus
  seekCare: boolean
  advice: string
  score: { symptoms: number; factors: number }
}

/**
 * 高血压风险评估（演示版经验规则，非医学诊断）
 * 阈值：红旗任一→seekCare；症状≥2 或因素≥3→mild_risk；
 * 症状≥3 或症状≥2 且因素≥2 或因素≥4→high_risk
 */
export function assessHypertension({
  symptoms = [],
  factors = [],
  redFlags = [],
}: AssessInput = {}): AssessResult {
  const symptomCount = symptoms.length
  const factorCount = factors.length
  const seekCare = redFlags.length > 0

  let status: AssessStatus = 'none'
  if (symptomCount >= 3 || factorCount >= 4 || (symptomCount >= 2 && factorCount >= 2)) {
    status = 'high_risk'
  } else if (symptomCount >= 2 || factorCount >= 3) {
    status = 'mild_risk'
  }

  let advice = ADVICE_TEXT[status]
  if (seekCare) advice = `${advice}${SEEK_CARE_SENTENCE}`

  return {
    status,
    seekCare,
    advice,
    score: { symptoms: symptomCount, factors: factorCount },
  }
}

// 职业编码 → 活动量；other / 未知 → null
export function occupationToActivity(code: string): 'low' | 'mid' | 'high' | null {
  return OCCUPATION_ACTIVITY[code] || null
}

// BMI = 体重 kg / (身高 m)^2，保留 1 位
export function bmiOf(
  heightCm: number | string | null | undefined,
  weightKg: number | string | null | undefined,
): number | null {
  const h = Number(heightCm)
  const w = Number(weightKg)
  if (!h || !w) return null
  return Math.round((w / Math.pow(h / 100, 2)) * 10) / 10
}

// BMI 分档 key（与 BMI_HINTS 对应）
export function bmiHint(bmi: number | string | null | undefined): BmiHintKey | null {
  const v = Number(bmi)
  if (!v) return null
  if (v < 18.5) return 'underweight'
  if (v < 24) return 'normal'
  if (v < 28) return 'overweight'
  return 'obese'
}

function htnConclusionText(htnStatus: HtnStatus | undefined): string {
  switch (htnStatus) {
    case 'confirmed':
      return '已确诊高血压，坚持清淡饮食和规律监测最重要，按时吃药别自己停'
    case 'mild_risk':
      return '有一点血压偏高的趋势，早点干预，大多能稳住'
    case 'high_risk':
      return '血压偏高的信号比较多，建议尽快到社区医院量一量确认'
    case 'unsure':
      return '还不太确定，体检时记得量个血压，心里有个数'
    case 'none':
    default:
      return '目前没有高血压迹象，继续保持少盐多动的习惯'
  }
}

export interface OnboardingSummary {
  bmi: number | null
  bmiText: string
  proteinTarget: number
  htnConclusionText: string
  tips: string[]
}

// 从画像生成口语化建议，恰好 3 条；候选不足时用通用建议补齐
// R2.3：移除 t2dStatus/sweetFreq 分支
export function buildOnboardingSummary(profile: Partial<Profile> = {}): OnboardingSummary {
  const bmi = bmiOf(profile.heightCm, profile.weightKg)
  const hintKey = bmiHint(bmi)
  const tips: string[] = []

  if (
    profile.htnStatus === 'confirmed' ||
    profile.htnStatus === 'mild_risk' ||
    profile.htnStatus === 'high_risk'
  ) {
    tips.push('每天早晚各量一次血压记下来，饭菜再淡一点，腌菜酱料少碰')
  } else if (profile.htnStatus === 'none') {
    tips.push('现在血压正常也要预防，每天盐控制在一啤酒盖以内')
  }

  if (profile.taste === '重口') {
    tips.push('口味重可以先用葱姜蒜、醋和柠檬提味，慢慢把盐减下来')
  }

  if (profile.dental && profile.dental !== '好') {
    tips.push('牙口不好就多选蒸鱼、炖豆腐、燕麦粥这类软嫩好嚼的，别因此不吃菜')
  }

  if (profile.activity === 'low') {
    tips.push('活动量偏少，饭后歇半小时再出门散步 20~30 分钟，循序渐进')
  }

  if (profile.smoke === '是') {
    tips.push('吸烟会加重血管负担，能少抽一根是一根，必要时找医生帮忙戒烟')
  }

  if (profile.drink === '是') {
    tips.push('饮酒尽量克制，能不喝就不喝，聚会时用茶水代替')
  }

  if (profile.renalKRestriction === true) {
    tips.push('肾不好要控制钾，富钾食物和低钠盐别自己多吃，具体量咨询医生')
  }

  const fallbacks = [
    '每顿先吃菜、再吃肉、最后吃主食，血压更平稳',
    '每天争取吃够 500g 蔬菜，深色叶菜占一半',
    '吃饭七八分饱、细嚼慢咽，体重和血压都更稳',
  ]
  let fi = 0
  while (tips.length < 3 && fi < fallbacks.length) {
    tips.push(fallbacks[fi])
    fi += 1
  }

  return {
    bmi,
    bmiText: hintKey ? BMI_HINTS[hintKey] : '身高体重信息不足，暂无法评估 BMI',
    proteinTarget: Math.round((Number(profile.weightKg) || 0) * 1.2),
    htnConclusionText: htnConclusionText(profile.htnStatus),
    tips: tips.slice(0, 3),
  }
}
