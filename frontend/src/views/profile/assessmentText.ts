// “我的”页共享的评估结论文案与日期格式化
// 注意：结论为演示版经验规则，非医学诊断

import { BMI_HINTS } from '@/constants/onboarding'
import { bmiHint, type BmiHintKey } from '@/utils/healthAssess'
import type { HtnDetail, HtnStatus, Profile } from '@/types'

// 高血压评估结论（按 profile.htnStatus 映射口语化中文）
export function htnConclusionText(profile: Partial<Profile> = {}): string {
  const detail: Partial<HtnDetail> = profile.htnDetail || {}
  switch (profile.htnStatus) {
    case 'confirmed':
      return `已确诊高血压（${detail.duration || '时间未填'}，${
        detail.medicated ? '规律服药中' : '服药情况未填'
      }）`
    case 'none':
      return '目前没有高血压趋势，保持定期测量'
    case 'mild_risk':
      return '有高血压趋势：每天早晚量血压、少盐多走动'
    case 'high_risk':
      return '高血压风险较高：建议尽快到医疗机构测量确认'
    case 'unsure':
      return '血压情况还不确定，体检时记得量一量'
    default:
      return '还没做过健康评估'
  }
}

// 结论对应的语气色：danger / warning / success / neutral
export function htnConclusionTone(
  htnStatus: HtnStatus,
): 'danger' | 'warning' | 'success' | 'neutral' {
  if (htnStatus === 'confirmed' || htnStatus === 'high_risk') return 'danger'
  if (htnStatus === 'mild_risk') return 'warning'
  if (htnStatus === 'none') return 'success'
  return 'neutral'
}

// 评估时间：优先 htnDetail.assessedAt，回落到 onboardedAt，展示为 YYYY年M月D日
export function assessedDateText(profile: Partial<Profile> = {}): string {
  const raw = profile.htnDetail?.assessedAt || profile.onboardedAt
  if (!raw) return ''
  const datePart = String(raw).slice(0, 10)
  const m = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return datePart
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`
}

// 病历附件清单（兼容 name / fileName）
export function recordFiles(profile: Partial<Profile> = {}): string[] {
  const records = profile.htnDetail?.records
  if (!Array.isArray(records)) return []
  return records
    .filter((item) => item && (item.name || item.fileName))
    .map((item) => item.name || item.fileName || '')
}

// BMI 分档中文提示
export function bmiHintText(bmi: number | string | null | undefined): string {
  const key: BmiHintKey | null = bmiHint(bmi)
  if (!key) return '填写身高和体重后自动计算'
  return BMI_HINTS[key]
}
