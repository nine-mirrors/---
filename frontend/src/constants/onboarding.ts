// 健康问卷（Onboarding）相关字典与映射
import type { OptionItem } from '@/constants/dict'
import { redFlagBriefs } from '@/constants/clinical'

// 高血压既往史
export const HTN_OPTIONS: OptionItem<'confirmed' | 'none' | 'unsure'>[] = [
  { value: 'confirmed', label: '有高血压' },
  { value: 'none', label: '没有高血压' },
  { value: 'unsure', label: '不清楚' },
]

// 患高血压年限
export const HTN_DURATION = ['刚查出', '1–5 年', '5 年以上']

// 职业类型
export const OCCUPATIONS: OptionItem<'retired' | 'sedentary' | 'standing' | 'labor' | 'other'>[] = [
  { value: 'retired', label: '已退休' },
  { value: 'sedentary', label: '久坐办公（办公室、司机等）' },
  { value: 'standing', label: '站立或走动较多（教师、销售等）' },
  { value: 'labor', label: '体力劳动（农林、建筑等）' },
  { value: 'other', label: '其他' },
]

// 高血压常见症状（8 项）
export const SYMPTOMS = [
  '经常头晕或头痛',
  '后颈部发胀发紧',
  '心慌胸闷',
  '耳鸣',
  '视物模糊',
  '容易乏力',
  '夜尿增多',
  '面部发热发红',
]

// 高血压危险因素（7 项）
export const RISK_FACTORS = [
  '父母有高血压',
  '口味偏咸',
  '很少运动',
  '超重或肚子大',
  '吸烟',
  '经常饮酒',
  '睡眠差或打鼾',
]

// 必须立即就医的红旗症状（5 项）：只取临床共享清单 RED_FLAG_SYMPTOMS 的子集，
// 文案由 clinical.redFlagBriefs 派生，不再手写第二份词表。
export const RED_FLAGS = redFlagBriefs([
  'headache',
  'chest_pain',
  'weak_side',
  'face_speech',
  'vision',
])

// 主食偏好
export const STAPLE_PREFS = ['白米白面为主', '粗细搭配', '杂粮为主']

// 外食频率
export const FREQ_OPTIONS = ['很少', '每周几次', '几乎天天']

// 通用是否
export const YESNO = ['是', '否']

// 忌口/过敏常见项（引导问卷与“我的-个人信息”共用，点选即加入 tags）
export const COMMON_ALLERGY_TAGS = ['花生', '海鲜', '牛奶', '鸡蛋', '辣', '芒果']

// 职业 → 活动量映射（other 不做自动映射，由用户自选）
export const OCCUPATION_ACTIVITY: Partial<Record<string, 'low' | 'mid' | 'high'>> = {
  retired: 'low',
  sedentary: 'low',
  standing: 'mid',
  labor: 'high',
}

// BMI 分档文案（key 与 healthAssess.bmiHint 返回值一致）
export const BMI_HINTS: Record<string, string> = {
  underweight: '体重偏轻，要注意吃够蛋白质和主食，别光喝粥吃菜',
  normal: '体重在合适范围，保持现在的饮食和活动习惯就好',
  overweight: '有点偏胖，主食稍减、少油少盐，每天再多走一走',
  obese: '体重超标较多，建议在医生或营养师指导下循序渐进减重',
}
