// 戒烟限酒生活方式提醒纯函数：只依赖画像与近期血压记录，可在 node 中断言。
// 设计口径（已与用户冻结）：
// - 固定温和提醒卡，不打卡、不亮红叉；仅画像 smoke/drink === '是' 才出现；
// - 酒量按性别：男 ≤25g、女 ≤15g 酒精/天（《中国居民膳食指南（2022）》）；
// - 近 7 天出现 ≥160/100（urgent 及以上）记录时，酒卡加强为"这段时间滴酒不沾"。

import { ALCOHOL_G_LIMIT_FEMALE, ALCOHOL_G_LIMIT_MALE, BP_THRESHOLDS } from '@/constants/dict'
import type { BpRecord, Profile } from '@/types'

export interface LifestyleTip {
  key: 'smoke' | 'alcohol'
  title: string
  text: string
  /** true=近期血压高危，加强提醒（暖色边但不做红叉） */
  urgent: boolean
}

/** 近期（调用方负责传"近 7 天"记录）是否出现 ≥160/100 或更高血压 */
export function hasRecentHighBp(records: BpRecord[] = []): boolean {
  return (records || []).some(
    (r) => r.sys >= BP_THRESHOLDS.urgent.sys || r.dia >= BP_THRESHOLDS.urgent.dia,
  )
}

/**
 * 按画像生成戒烟/限酒提醒卡；画像未勾选吸烟饮酒时返回空数组。
 * @param profile 用户画像（smoke/drink 为 '是'/'否' 字符串；gender 'female' 走女性酒量）
 * @param recentBp 近 7 天血压记录（可选），出现 ≥160/100 时加强
 */
export function buildLifestyleTips(
  profile: Partial<Profile> = {},
  recentBp: BpRecord[] = [],
): LifestyleTip[] {
  const tips: LifestyleTip[] = []
  const urgent = hasRecentHighBp(recentBp)

  if (profile.smoke === '是') {
    tips.push({
      key: 'smoke',
      title: '戒烟提醒',
      urgent,
      text: urgent
        ? '最近血压偏高，抽烟会让血压更不稳。任何时候戒烟都不晚，可拨打全国卫生热线 12320 咨询戒烟门诊。'
        : '任何时候戒烟都不晚，戒烟后血压和血管都会慢慢好转，可拨打全国卫生热线 12320 咨询戒烟门诊。',
    })
  }

  if (profile.drink === '是') {
    const limit = profile.gender === 'female' ? ALCOHOL_G_LIMIT_FEMALE : ALCOHOL_G_LIMIT_MALE
    tips.push({
      key: 'alcohol',
      title: '限酒提醒',
      urgent,
      text: urgent
        ? '最近血压量到过 160/100 以上，这段时间酒先一滴别沾，等血压稳住了再按医生说的来。'
        : `能不喝最好；实在要喝，每天酒精不超过 ${limit} 克（约白酒1两、红酒1小杯或啤酒1瓶以内），别空腹喝、别天天喝。`,
    })
  }

  return tips
}
