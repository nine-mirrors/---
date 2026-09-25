// Onboarding 各步骤共享一份草稿：父页 provide，步骤组件 inject 后直接修改字段
// 草稿是跨步骤的动态表单模型，Task 13a 引导重构时细化字段级类型
import { inject, type InjectionKey } from 'vue'
import type { HtnStatus, MedicalRecordFile } from '@/types'

export interface OnboardingDraft {
  name: string
  age: number | null
  gender: string
  heightCm: number | null
  weightKg: number | null
  occupation: string
  activity: string
  dental: string
  taste: string
  staplePref: string
  eatOutFreq: string
  smoke: string
  drink: string
  allergies: string[]
  htnStatus: HtnStatus
  /** 肾不好/需控钾三态：true=有、false=没有、null=不清楚（默认） */
  renalKRestriction: boolean | null
  htnDetail: {
    duration: string
    medicated: boolean
    symptoms: string[]
    factors: string[]
    redFlags: string[]
    assessedAt: string | null
    records: MedicalRecordFile[]
  }
}

export const DRAFT_KEY: InjectionKey<OnboardingDraft> = Symbol('onboarding-draft')

export function useDraft(): OnboardingDraft {
  const draft = inject(DRAFT_KEY, null)
  if (!draft) throw new Error('onboarding draft 未提供')
  return draft
}
