// 全局指标阈值与字典常量
// 阈值来源：WS/T 652—2019、《成人高血压食养指南（2023）》、
// 《中国居民膳食营养素参考摄入量（2023）》、《中国高血压防治指南（2024）》等
// 演示产品取整使用；医学数字改动需回 spec 核对出处，禁止自创阈值

export interface OptionItem<V extends string = string> {
  value: V
  label: string
}

export interface DeviceItem {
  key: string
  name: string
  card: string | null
  desc: string
}

// 钠（mg）：单餐建议 / 每日上限
// 来源：《成人高血压食养指南（2023）》钠摄入 <2000mg/天，演示取单餐 800
export const NA_MEAL = 800
// 单餐黄色档：超过 600mg 提示"口味略重"（评分黄/柱状黄，演示取整口径）
export const NA_MEAL_WARN_MG = 600
// 全天黄色档：周报每日钠合计 >1500mg 提示接近上限（演示取整口径）
export const NA_DAY_WARN_MG = 1500
export const NA_DAY = 2000
// 单餐"偏高"参考：全天 2000mg 按 1.1 餐口径折算 ≈733mg（演示参考线，
// 评分红线仍取 NA_MEAL=800，本常量仅用于图表/文案对照，不参与评级）
export const NA_MEAL_HIGH_MG = Math.round((NA_DAY / 3) * 1.1)

// 钾（mg）：每日 PI（预防非传染性慢性病建议摄入量）/ AI（适宜摄入量）
// 来源：《中国居民膳食营养素参考摄入量（2023）》钾 PI 3600、AI 2000
export const K_PI = 3600
export const K_AI = 2000
// 单餐钾口径（Result 页图表/指标卡统一使用）：≥1000 较好、<800 偏少、之间黄
export const K_MEAL_GOOD = 1000
export const K_MEAL_LOW = 800
// 单餐图表右轴上限：覆盖 K_MEAL_GOOD 并给高钾餐留展示余量
export const K_MEAL_AXIS_MAX = 1500

// 老年人蛋白质推荐 g/kg 体重/天
// 来源：《中国老年糖尿病诊疗指南（2024版）》1.2–1.5 g/kg/天，演示取 1.2
export const PROTEIN_PER_KG = 1.2

// 单餐蔬菜建议量（g）；全天 500g，演示取单餐 150
// 来源：《高血压营养和运动指导原则（2024年版）》蔬菜≥500g/天
export const VEG_MEAL = 150
export const VEG_DAY = 500

// —— 热量（能量）管理：个性化全天预算 ——
// 理想体重 IBW(kg) = 身高cm − 105（中国成人简易理想体重法）。
// 活动系数来源：《成人高血压食养指南（2023年版）》体重管理能量 25–30 kcal/kg/天，
// 演示按画像活动量三档取 25（活动少）/30（中）/35（多）
export const ENERGY_KCAL_PER_KG = { low: 25, mid: 30, high: 35 } as const
// 实际体重 > IBW×1.1 视为超重，预算按 IBW 算（避免超重者预算被放大）
export const ENERGY_OVERWEIGHT_RATIO = 1.1
// 实际体重 < IBW×0.9 视为偏瘦
export const ENERGY_UNDERWEIGHT_RATIO = 0.9
// 偏瘦老人防肌少症：不压低预算，固定按 30 kcal/kg 实际体重给足
export const ENERGY_UNDERWEIGHT_FACTOR = 30
// 全天预算安全区间（kcal），防止身高体重异常导致预算离谱
export const ENERGY_BUDGET_MIN = 1200
export const ENERGY_BUDGET_MAX = 2400
// 缺身高/体重时的兜底全天预算（单餐约 600 kcal），画像补齐后自动改个性化
export const ENERGY_FALLBACK_DAY = 1800
export const MEALS_PER_DAY = 3
// 单餐参考 = 全天/3；超标倍率：红 ×1.3、黄 ×1.15（演示取整口径）
export const ENERGY_MEAL_RED_RATIO = 1.3
export const ENERGY_MEAL_WARN_RATIO = 1.15
// 全天累计超标倍率：红 ×1.1、黄 ×1.0
export const ENERGY_DAY_RED_RATIO = 1.1
export const ENERGY_DAY_WARN_RATIO = 1.0

// —— 膳食纤维（g）——
// 来源：《成人高血压食养指南（2023年版）》膳食纤维 25–30g/天，演示取下限 25g
export const FIBER_DAY = 25
// 全天黄档：17g ≈ 目标的 2/3
export const FIBER_DAY_WARN = 17
// 单餐：≥8g 充足（绿）、5–8g 偏少（黄）、<5g 不足（红）
export const FIBER_MEAL = 8
export const FIBER_MEAL_WARN = 5

// —— 戒烟限酒 ——
// 酒精限量来源：《中国居民膳食指南（2022）》成年男性一天酒精 ≤25g、女性 ≤15g
export const ALCOHOL_G_LIMIT_MALE = 25
export const ALCOHOL_G_LIMIT_FEMALE = 15
// 高饱和脂肪食材（肥肉/加工肉）单餐累计克重达到该值，建议卡由黄升红（演示口径）
export const HIGH_SAT_RED_G = 100

// 每日步数目标
export const STEPS_GOAL = 6000

// 餐食评分分档
export const SCORE_YELLOW = 60
export const SCORE_GREEN = 80

// 钠 → 食盐当量换算：1g 食盐 ≈ 400mg 钠（演示取整，实际约 393mg）
export const SODIUM_PER_SALT_G = 400

/**
 * 血压判定阈值（mmHg）
 * 来源：《中国高血压防治指南（2024）》家庭自测 135/85、诊室 140/90；
 * urgent 160/100 为家庭测量紧急复测阈值（≥160/100 需尽快联系医生、安排复测）；
 * emergency 180/120 伴不适需立即拨打 120；偏低 90/60 需留意。
 */
export const BP_THRESHOLDS = {
  home: { sys: 135, dia: 85 },
  clinic: { sys: 140, dia: 90 },
  urgent: { sys: 160, dia: 100 },
  emergency: { sys: 180, dia: 120 },
  low: { sys: 90, dia: 60 },
} as const

// 静息心率下限（<50 提示留意洛尔类药物，但不拦截保存）
export const HR_REST_LOW = 50

// 高龄阈值（≥80 岁目标遵医嘱）
export const ELDER_AGE = 80

// 录入步进常量（大号步进按钮用）
export const BP_STEP = 2
export const HR_STEP = 1

// 日常活动量
export const ACTIVITY_OPTIONS: OptionItem<'low' | 'mid' | 'high'>[] = [
  { value: 'low', label: '少' },
  { value: 'mid', label: '中' },
  { value: 'high', label: '多' },
]

// 牙口情况
export const DENTAL_OPTIONS = ['好', '一般', '不好']

// 口味偏好
export const TASTE_OPTIONS = ['清淡', '一般', '重口']

// 情绪记录
export const MOODS = ['平静', '焦虑', '疲惫', '烦躁']

// 食谱筛选标签（"全部"为特殊标签，不参与标注）
// R2.3：移除"低GL"，新增"健康推荐"；六标签
export const RECIPE_TAGS = ['全部', '低钠', '高钾', '高蛋白', '易咀嚼', '健康推荐']

// 可接入设备清单（R2.3 删 CGM，余四项）
export const DEVICES: DeviceItem[] = [
  {
    key: 'bp',
    name: '蓝牙血压计',
    card: 'bp',
    desc: '每天早晚量血压并自动记录',
  },
  {
    key: 'band',
    name: '健康手环',
    card: 'moodhr',
    desc: '记录心率、情绪、步数和睡眠',
  },
  {
    key: 'scale',
    name: '智能体脂秤',
    card: 'weight',
    desc: '自动记录体重变化',
  },
  {
    key: 'plate',
    name: '智能餐盘',
    card: null,
    desc: '自动识别饭菜并称出分量',
  },
]

// localStorage 业务基键（R2.2 起业务键经 storage ns* 命名空间化为 <base>:<uid>）
// settings 为设备级偏好（语音开关），经 readGlobal/writeGlobal 全局存储
export const LS_KEYS = {
  profile: 'ndh_profile_v1',
  meals: 'ndh_meals_v1',
  devices: 'ndh_devices_v1',
  premeal: 'ndh_premeal_v1',
  deviceData: 'ndh_device_data_v1',
  bpLog: 'ndh_bp_log_v1',
  meds: 'ndh_meds_v1',
  settings: 'ndh_settings_v1',
} as const

export type LsKey = (typeof LS_KEYS)[keyof typeof LS_KEYS]
