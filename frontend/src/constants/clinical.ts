/**
 * 临床安全共享常量
 *
 * 红旗症状清单全应用唯一来源：血压录入弹窗、健康页急诊条、引导问卷、
 * 周报、AI 安全兜底统一引用本文件，禁止在各组件里再各写一份。
 */

export interface RedFlagSymptom {
  id: string
  /** 给老人看的大白话 */
  label: string
  /**
   * 短句版症状名（可选）：用于引导问卷选项、评估结论等装不下整句 label 的地方。
   * 仍是本清单的派生文案，不允许在调用方另写第三份。
   */
  brief?: string
}

/**
 * 高血压急症红旗症状（不依赖血压数值，命中任意一条都应立即就医/120）
 * 依据：《中国高血压防治指南》高血压急症/急性心脑血管事件识别要点
 */
export const RED_FLAG_SYMPTOMS: RedFlagSymptom[] = [
  { id: 'chest_pain', label: '胸痛、胸闷、压得慌', brief: '胸痛胸闷' },
  { id: 'dyspnea', label: '喘憋、呼吸困难', brief: '喘憋呼吸困难' },
  { id: 'weak_side', label: '一边脸、手或腿突然无力、发麻', brief: '一侧发麻无力' },
  { id: 'face_speech', label: '口角歪斜、说话不清', brief: '说话不清' },
  { id: 'vision', label: '突然一只眼看不清', brief: '突发视力下降' },
  { id: 'conscious', label: '意识不清、叫不醒、抽搐', brief: '意识不清抽搐' },
  { id: 'headache', label: '突然剧烈头痛、呕吐', brief: '剧烈头痛' },
  { id: 'back_pain', label: '胸背部撕裂样剧痛', brief: '胸背撕裂痛' },
]

/**
 * 按 id 取红旗症状的短句版（没有 brief 时回退到 label 首段）。
 * 引导问卷、评估结论等需要短词列表的场景一律用本函数派生，禁止再手写清单。
 */
export function redFlagBriefs(ids: readonly string[]): string[] {
  return ids
    .map((id) => {
      const item = RED_FLAG_SYMPTOMS.find((s) => s.id === id)
      if (!item) return ''
      return item.brief ?? item.label.split('、')[0]
    })
    .filter(Boolean)
}

/* ============================ 文本红旗词表（AI 输入兜底） ============================ */

/**
 * 单词型红旗症状：直接包含即命中（否定窗口由 matchRedFlagKeywords 统一处理）。
 * 注意：普通“头晕/站不稳”不在这里——普通头晕可能只是体位性低血压，
 * “站不稳”必须带突发语境（见 RED_FLAG_PHRASES），避免把老人误导到急救通道。
 * “一边/一侧/半身”同样不在此表：吃饭“一边”、脖子“一侧”都是家常话，
 * 必须短语化（见 RED_FLAG_PHRASES）。
 */
export const RED_FLAG_KEYWORDS: string[] = [
  '胸痛',
  '胸闷',
  '喘憋',
  '喘不上气',
  '呼吸困难',
  '胳膊抬不起来',
  '手脚无力',
  '口角歪',
  '嘴歪',
  '说话不清',
  '说不出话',
  '突然看不清',
  '一只眼看不清',
  '意识不清',
  '昏迷',
  '叫不醒',
  '抽搐',
  '剧烈头痛',
  '头疼得厉害',
  '撕裂',
  '晕倒',
  '突然头晕',
  '突然眩晕',
  '走不稳',
]

/** 短语型红旗规则：裸词假阳性多的症状一律走这里 */
export interface RedFlagPhrase {
  /** 命中后返回的红旗标签 */
  label: string
  re: RegExp
}

/** 句中停顿标点：跨过去就不算同一句语境 */
const PHRASE_BREAK = '，。！？；,.!?;：:…、'

/** 半身/一边/一侧 + 具体部位 + 神经症状，才按偏瘫红旗处理 */
const SIDE_BODY = '手脚|肢体|身子|身体|半拉身子|脸|胳膊|手臂|手|腿|脚'
// 裸“麻”要躲开“麻利/麻酱/麻婆”等家常词；“发麻/麻木/发木”显式列出
const SIDE_SYMPTOM =
  '发麻|麻木|发木|麻(?!利|酱|婆|油|绳|醉|烦)|无力|没劲|发软|发沉|动不了|抬不起|抬不起来|不好使|不听使唤'

export const RED_FLAG_PHRASES: RedFlagPhrase[] = [
  {
    label: '一侧肢体无力或发麻',
    re: new RegExp(
      `(?:一侧|一边)\\s*(?:的)?(?:${SIDE_BODY})(?:[^${PHRASE_BREAK}]{0,4})?(?:${SIDE_SYMPTOM})`,
    ),
  },
  {
    label: '一侧肢体无力或发麻',
    re: new RegExp(
      `(?:${SIDE_BODY})(?:[^${PHRASE_BREAK}]{0,3})?(?:一侧|一边)(?:[^${PHRASE_BREAK}]{0,4})?(?:${SIDE_SYMPTOM})`,
    ),
  },
  {
    label: '半身无力或发麻',
    re: /半身(?:不遂|发麻|麻木|发木|发沉|无力|没劲|发软|动不了|不好使|不听使唤)|(?:左|右)半身/,
  },
  {
    // “站不稳”必须突发或伴摔倒才是神经急症；
    // “有时候站起来站不稳”这类体位性表述不命中，留给 mock 温和分支。
    label: '站不稳',
    re: new RegExp(
      `突然[^${PHRASE_BREAK}]{0,6}站不稳|站不稳[^。！？；,.!?;]{0,8}摔|摔[^。！？；,.!?;]{0,6}站不稳`,
    ),
  },
]

/**
 * 否定窗口：症状前 6 个字内（不跨分句）出现“没/没有/不”即视为否定描述，
 * 例如“没有胸闷”“我不胸痛”。正反问句（是不是胸痛）也按不命中处理——
 * 急症通道宁让给正常路由，也不劫持咨询。
 */
const RED_FLAG_NEGATION_RE = /没有|没|不/g
const RED_FLAG_CLAUSE_BREAK_RE = /[，。！？；,.!?;：:…、]/

/** 判断 index 之前 6 字窗口（分句后）内是否有普通否定词 */
function isNegatedSymptom(text: string, index: number): boolean {
  let tail = text.slice(Math.max(0, index - 6), index)
  const breakAt = tail.search(RED_FLAG_CLAUSE_BREAK_RE)
  if (breakAt !== -1) tail = tail.slice(breakAt + 1)
  RED_FLAG_NEGATION_RE.lastIndex = 0
  return RED_FLAG_NEGATION_RE.test(tail)
}

/**
 * 文本急症关键词匹配（AI 输入兜底用）。
 * 单词表 + 短语规则 + 红旗清单整句（label/brief，供血压弹窗等结构化勾选拼接）
 * 统一过否定窗口；返回命中的红旗标签（去重），无命中返回 []。
 */
export function matchRedFlagKeywords(text: string): string[] {
  if (!text) return []
  const hits: string[] = []

  const add = (label: string): void => {
    if (!hits.includes(label)) hits.push(label)
  }

  // 字面词命中：多次出现时逐处查否定窗口，任一非否定出现即命中
  const matchLiteral = (literal: string, label: string): void => {
    let from = 0
    for (;;) {
      const at = text.indexOf(literal, from)
      if (at === -1) break
      if (!isNegatedSymptom(text, at)) {
        add(label)
        return
      }
      from = at + literal.length
    }
  }

  for (const keyword of RED_FLAG_KEYWORDS) matchLiteral(keyword, keyword)

  // 红旗清单的整句 label / brief 天然是规范急症描述，必须可被命中
  // （例如血压弹窗勾选“一边脸、手或腿突然无力、发麻”后拼成的备注）。
  for (const symptom of RED_FLAG_SYMPTOMS) {
    matchLiteral(symptom.label, symptom.label)
    if (symptom.brief) matchLiteral(symptom.brief, symptom.brief)
  }

  for (const phrase of RED_FLAG_PHRASES) {
    phrase.re.lastIndex = 0
    let matched: RegExpExecArray | null = null
    while ((matched = phrase.re.exec(text)) !== null) {
      if (!isNegatedSymptom(text, matched.index)) {
        add(phrase.label)
        break
      }
      if (matched.index === phrase.re.lastIndex) phrase.re.lastIndex += 1
    }
  }

  return hits
}

/* ============================== 血压数值安全阈值 ============================== */

/** 高血压急症：收缩压 ≥180 或舒张压 ≥120 */
export const BP_CRISIS_SYS = 180
export const BP_CRISIS_DIA = 120
/** 血压明显升高（尽快就医档）：收缩压 ≥160 或舒张压 ≥100 */
export const BP_URGENT_SYS = 160
export const BP_URGENT_DIA = 100

/** 复测静息口径全应用统一话术 */
export const REST_RECHECK_PHRASE = '安静休息5分钟后再量一次'

/** ≥180/120 统一口径（系统提示词、mock、真实拦截共用，禁止再手工抄一份） */
export const HIGH_BP_CRISIS_REPLY =
  `先别动，${REST_RECHECK_PHRASE}；仍这么高，或伴胸痛、头痛、一边无力等不舒服，立刻拨打 120；` +
  '没有不舒服也要尽快让医生评估。别自己加药。'

/** 160-179/100-119 复测后尽快就医档（mock 与真实路径共用） */
export const HIGH_BP_URGENT_REPLY =
  `别着急，${REST_RECHECK_PHRASE}。还在 160/100 以上，就尽快找医生看看；` +
  '若有胸痛、剧烈头痛、一边发麻无力等不舒服，立刻拨打 120。别自己加药。'

/* ================================ 固定话术 ================================ */

/** 急症固定指引文案（AI 兜底与弹窗共用，保持口径一致） */
export const EMERGENCY_GUIDE =
  '这种情况别等，立刻拨打 120 或让家人送急诊。先坐下或躺下安静等急救车，别自己开车，也别自己加药、停药。'

/** AI 涉及调药/停药建议时的固定追加提示 */
export const MEDICATION_DISCLAIMER = '降压药怎么吃、加量还是停用，一定要问开药医生，别自己改药量。'
