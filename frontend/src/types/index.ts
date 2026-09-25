/**
 * 领域类型（Task 12b 填充）
 *
 * 约定：
 * - 全部领域接口集中在 src/types/，账号相关 Task 12a 拆到 src/types/auth.ts；
 * - 数值字段缺失（mock 源表 '—'）统一用 null，不加权时按 0 处理；
 * - R2.3：已移除 gl/t2dStatus/sweetFreq/glucose 全部血糖与糖尿病字段；
 *   foods.gi 为食材数据集原貌字段保留但 UI/评分不再使用（白名单）。
 */

// ————— 通用 —————

/** 红黄绿三态 */
export type StatusLevel = 'red' | 'yellow' | 'green'

/** 低血压等提示色（含中性态） */
export type ToneLevel = StatusLevel | 'neutral'

/** 高血压评估/病史状态（unsure 仅引导期使用） */
export type HtnStatus = 'confirmed' | 'none' | 'mild_risk' | 'high_risk' | 'unsure' | null

// ————— 食材 / 餐次 —————

/**
 * 食物成分（每 100g 可食部）。
 * gi 为食材数据集原貌字段，按 R2 决策保留但 UI/评分不再使用（白名单）。
 */
export interface Food {
  id: string
  name: string
  category: string
  gi: number | null
  energyKCal: number
  protein: number
  fat: number
  CHO: number
  dietaryFiber: number | null
  Na: number
  K: number
  /** 调味品等不参与搜索结果 */
  hidden?: boolean
  /**
   * 脂肪/胆固醇定性旗标（前端 mock 库字段，不进后端契约）：
   * - high-sat：高饱和脂肪（肥肉、香肠等加工肉），触发"偶尔解馋"黄卡（≥100g 升红）
   * - chol-occasional：高胆固醇偶尔少量食材（动物内脏），中性卡；鸡蛋黄不贴标
   */
  fatFlag?: 'high-sat' | 'chol-occasional'
  /** 人工估算值备注（待后端核对） */
  remark?: string
  /**
   * 调味品等不适合按"100g 一份"录入的食物专用份量档。
   * 存在时手动加菜 UI 用这组大按钮替代 小/标准/大(0.7/1/1.3×100g)。
   */
  servingPresets?: FoodServing[]
}

/** 食物份量快捷档（weightG 为该档实际克数；液体按密度折算为等效克数） */
export interface FoodServing {
  /** 按钮白话标签，如"1小撮（约1克）" */
  label: string
  weightG: number
}

/** 一餐中的一条食物/菜品；识别扩展字段（kind/confidence）可选 */
export interface MealItem {
  id: string
  name?: string
  kind?: string
  /** 手动加菜等无识别置信度的场景为 null */
  confidence?: number | null
  weightG: number
  gi?: number | null
}

/** 识别场景返回的单条菜品（置信度必有） */
export interface RecognizedItem extends MealItem {
  kind: string
  confidence: number
}

/** recognize 接口的 mock 场景结构 */
export interface RecognizeScenario {
  id: string
  label: string
  detected: RecognizedItem[]
}

/** computeTotals 输出（R2.3：无 gl） */
export interface NutrientTotals {
  energyKCal: number
  protein: number
  fat: number
  CHO: number
  dietaryFiber: number
  K: number
  Na: number
  vegWeight: number
  /** 命中的高饱和脂肪食材名（肥肉、香肠等加工肉），用于触发式建议卡/今日提示 */
  highSatItems: string[]
  /** 高饱和脂肪食材累计克重（达到 HIGH_SAT_RED_G 黄卡升红） */
  highSatWeightG: number
  /** 命中的"偶尔少量"高胆固醇食材名（猪肝等动物内脏；鸡蛋黄不在其列） */
  cholItems: string[]
}

/** 评分扣分项 */
export interface RuleReason {
  metric: string
  status: StatusLevel
  text: string
}

/** 建议规则卡（severity='neutral' 为不评好坏的温和提示卡，如控钾/内脏/肾未知） */
export interface Rule {
  id: string
  severity: StatusLevel | 'neutral'
  title: string
  metric: string | null
  value: number | null
  threshold: number | null
  evidence: string
  text: string
  recipeTags: string[]
}

/** 主食/减盐替换建议 */
export interface Substitution {
  from: string
  to: string
  tip: string
}

/** 食谱配料 */
export interface RecipeIngredient {
  id: string
  name: string
  grams: number
}

export interface Recipe {
  id: string
  name: string
  /**
   * 菜品成品图 URL：本地静态资源 /recipes/<id>.jpg（写实风格示意图，已去除生成水印），
   * 加载失败时 UI 自动隐藏只留文字。
   */
  image: string
  tags: string[]
  yieldG: number
  ingredients: RecipeIngredient[]
  steps: string[]
  nutrients: NutrientTotals
}

/** evaluate 输出（R2.3：无 glucose） */
export interface EvaluateResult {
  score: number
  level: StatusLevel
  reasons: RuleReason[]
  totals: NutrientTotals
  suggestedItems: MealItem[]
  suggestedTotals: NutrientTotals
  rules: Rule[]
  substitutions: Substitution[]
  recipes: Recipe[]
}

/** 已保存餐次 */
export interface Meal {
  id: string
  dateTime: string
  date: string
  adoptedHealthy?: boolean
  score?: number
  level?: StatusLevel
  totals?: NutrientTotals
  items?: MealItem[]
  photo?: string
  premeal?: Record<string, unknown>
}

// ————— 画像 —————

/** 病历附件：只持久化元信息，绝不存文件内容 */
export interface MedicalRecordFile {
  name?: string
  fileName?: string
  type?: string
}

/** 高血压病史明细 */
export interface HtnDetail {
  duration?: string
  medicated?: boolean
  /** 未走症状问卷（明确选"有/没有"）时为 null */
  assessedAt?: string | null
  symptoms?: string[]
  factors?: string[]
  redFlags?: string[]
  records?: MedicalRecordFile[]
}

/**
 * 用户画像。
 * renalKRestriction 三态：true=需控钾（肾病/低钠盐等）、false=正常、null=不清楚（默认）。
 * renalKRestriction=true 时不出补钾类规则、富钾维度输出中性态。
 */
export interface Profile {
  name: string
  phone: string
  age: number | null
  gender: string
  heightCm: number | null
  weightKg: number | null
  occupation: string
  activity: 'low' | 'mid' | 'high' | string
  dental: string
  taste: string
  staplePref: string
  eatOutFreq: string
  smoke: string
  drink: string
  allergies: string[]
  htnStatus: HtnStatus
  htnDetail: HtnDetail | null
  onboarded: boolean
  onboardedAt: string | null
  /** R2.2：肾不好/需控钾（含低钠盐）三态，null=不清楚（默认） */
  renalKRestriction: boolean | null
  /** 紧急联系人姓名：急症面板与 120 并列一键拨打；空串=未设置 */
  emergencyContactName: string
  /** 紧急联系人手机号（1 开头 11 位）；空串=未设置 */
  emergencyContactPhone: string
}

// ————— 血压（FR-40 契约） —————

export type BpPeriod = 'morning' | 'evening'

export interface BpReading {
  sys: number
  dia: number
}

/**
 * 血压记录。
 * - readings 为多次测量原始读数（1~3 次），sys/dia 为均值；
 * - source: 'manual' 手动 / 'device' 设备同步；
 * - measuredAt 为 ISO 时间，date 为本地 YYYY-MM-DD，period 为 morning/evening。
 */
export interface BpRecord {
  id: string
  measuredAt: string
  date: string
  period: BpPeriod
  sys: number
  dia: number
  hr: number | null
  source: 'manual' | 'device'
  readings: BpReading[]
  /** 测量手臂：电子血压计首测双臂后应以较高侧为准 */
  arm?: 'left' | 'right'
  /** 脉搏是否整齐（false 提示可能心律不齐，建议心电图） */
  pulseRegular?: boolean
  /** 测量时伴随症状备注（头痛/胸闷等，供医生参考） */
  symptoms?: string
  createdAt: string
}

/** classifyBp 五级判定 */
export type BpLevel = 'normal' | 'high' | 'urgent' | 'emergency' | 'low'

/** buildWeeklyBp 输出 */
export interface WeeklyBpResult {
  avgMorning: { sys: number; dia: number } | null
  avgEvening: { sys: number; dia: number } | null
  morningAvgFlag: StatusLevel
  maxSys: number
  maxDia: number
  /** 近 7 天家庭口径 ≥135/85 的天数 */
  homeHighDays: number
  /** 手动录入次数 */
  manualCount: number
  /** 近 7 天是否出现 ≥180/120 */
  emergencyHit: boolean
  /** 结论等级 */
  adviceLevel: 'stable' | 'high' | 'emergency'
  /** 结论文案 */
  adviceText: string
  /** 测量频率建议（未稳→连续7天早晚 / 平稳→每周1-2天） */
  measureFreqAdvice: string
}

// ————— DASH 进度（FR-36） —————

/** 单维 DASH 达标状态 */
export interface DashDimension {
  key: 'salt' | 'energy' | 'veg' | 'fiber' | 'protein' | 'k'
  label: string
  value: number
  target: number
  status: StatusLevel | 'restricted' | 'neutral'
  text: string
}

/** buildDashProgress 输出（六维：低盐/热量/蔬菜/纤维/蛋白/富钾） */
export interface DashProgress {
  dimensions: DashDimension[]
  /** 当天高脂/高胆固醇食材命中的环外提示文案（无命中为 null，不进评分/进度环） */
  fatNote: string | null
}

// ————— 设备模拟数据 —————

export interface DeviceDay {
  bpMorning?: [number, number]
  bpEvening?: [number, number]
  hr?: number
  mood?: string
  steps?: number
  sleep?: { total: number; deepRatio: number }
  weight?: number
  /** 手动来源标记：true 表示该指标由用户自己录入（无手环/体脂秤也能记） */
  manual?: {
    hr?: boolean
    steps?: boolean
    sleep?: boolean
    weight?: boolean
  }
}

export interface DeviceData {
  initializedAt?: string
  days: Record<string, DeviceDay>
}

/** 可手动录入的体征指标（无手环/体脂秤也能记） */
export type ManualMetric = 'hr' | 'steps' | 'sleep' | 'weight'

/** 手动体征录入入参（只传本次填写的指标） */
export interface ManualMetricInput {
  hr?: number
  steps?: number
  sleep?: number
  weight?: number
}

// ————— 服药记录 —————

export interface MedicationRecord {
  id: string
  date: string
  /** ISO 时间 */
  takenAt: string
  name?: string
}

// ————— 统一响应约定（账号/Session 类型见 src/types/auth.ts） —————
// 本项目接口【无统一 envelope】：成功响应拦截器直接返回裸 JSON 业务体；
// 失败错误体形如 { code: string|number, message: string }（code 可能回落 HTTP 数字码），
// 前端统一由 src/api/http.ts 的 ApiError 承载，故不再声明 ApiResult 包装类型。

/** 区间查询参数（bp/medication/devices 支持） */
export interface DateRange {
  from?: string
  to?: string
}
