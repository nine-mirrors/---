// AI 营养师安全兜底模块（纯函数 + 安全 VNode 渲染）
//
// 设计铁律：
// - 急症词表只有一个来源：@/constants/clinical 的 matchRedFlagKeywords / RED_FLAG_PHRASES，
//   这里只做转调与数值/语境补充，不允许再手写症状词；
// - 急症话术、用药免责文案同样复用 @/constants/clinical 的固定常量；
// - 迷你 markdown 只用 Vue h() 产 VNode，全应用严禁 v-html / innerHTML；
//   只允许 tel: 协议链接，任何 http / www 文本一律纯文本展示，不自动链接。

import { h, type VNode } from 'vue'
import {
  BP_CRISIS_DIA,
  BP_CRISIS_SYS,
  BP_URGENT_DIA,
  BP_URGENT_SYS,
  EMERGENCY_GUIDE,
  MEDICATION_DISCLAIMER,
  matchRedFlagKeywords,
} from '@/constants/clinical'

/* ================================ 急症识别 ================================ */

/**
 * 血压对识别结果。
 * - emergency：任一读数 ≥180/120，按高血压急症口径处理；
 * - urgent：任一读数 ≥160/100（但未到急症线），按复测+尽快就医口径处理；
 * - 读不出血压对（营养数字、心率等）时 emergency/urgent 均为 false 且无 sys/dia。
 */
export interface BpCrisisResult {
  emergency: boolean
  urgent: boolean
  sys?: number
  dia?: number
}

/** “120/80”“120／80”形式：只接受独立的 2-3 位数字，拒绝 1200/2000 等四位数 */
const BP_SLASH_RE = /(?<![\d.])(\d{2,3})\s*[/／]\s*(\d{2,3})(?![\d.])/g

/** “高压180低压120”“收缩压185 舒张压112”形式 */
const BP_WORDS_RE = /(?:高压|收缩压)\s*(\d{2,3})\s*[,，、\s]{0,3}(?:低压|舒张压)\s*(\d{2,3})/g

/**
 * 非血压语境排除（窗口取数字对紧邻前后各 4 个字）：
 * 钠/钾/毫克/mg 是营养摄入数字，心率后面的数字是心率，都不许当血压。
 */
const BP_BAD_BEFORE_RE = /[钠钾]|心率/
const BP_BAD_AFTER_RE = /毫克|mg|MG|Mg/

interface BpPair {
  sys: number
  dia: number
  /** 整个数字对在原文中的起止位置，用于语境排除 */
  start: number
  end: number
}

/** 从文本中找出所有“看起来像血压”且数值合理的血压对 */
function findBpPairs(text: string): BpPair[] {
  const pairs: BpPair[] = []
  const seen = new Set<string>()
  const collect = (re: RegExp): void => {
    re.lastIndex = 0
    let matched: RegExpExecArray | null = null
    while ((matched = re.exec(text)) !== null) {
      const sys = Number(matched[1])
      const dia = Number(matched[2])
      const start = matched.index
      const end = start + matched[0].length
      // 合理范围 + 高压必须高于低压，否则不是有效血压读数
      if (sys < 60 || sys > 260 || dia < 30 || dia > 200 || dia >= sys) {
        if (matched.index === re.lastIndex) re.lastIndex += 1
        continue
      }
      // 钠/钾/毫克/mg/心率语境数字对，直接排除
      const before = text.slice(Math.max(0, start - 4), start)
      const after = text.slice(end, end + 4)
      if (BP_BAD_BEFORE_RE.test(before) || BP_BAD_AFTER_RE.test(after)) {
        if (matched.index === re.lastIndex) re.lastIndex += 1
        continue
      }
      const key = `${start}-${end}`
      if (!seen.has(key)) {
        seen.add(key)
        pairs.push({ sys, dia, start, end })
      }
      if (matched.index === re.lastIndex) re.lastIndex += 1
    }
  }
  collect(BP_SLASH_RE)
  collect(BP_WORDS_RE)
  return pairs
}

/**
 * 识别文本中的血压读数并判定危险级别。
 * 多个读数时取风险最高的一个返回。
 */
export function detectBpCrisis(text: string): BpCrisisResult {
  if (!text) return { emergency: false, urgent: false }
  const pairs = findBpPairs(text)
  if (pairs.length === 0) return { emergency: false, urgent: false }

  let picked = pairs[0]
  for (const pair of pairs.slice(1)) {
    const pairRisk =
      Number(pair.sys >= BP_CRISIS_SYS || pair.dia >= BP_CRISIS_DIA) * 2 +
      Number(pair.sys >= BP_URGENT_SYS || pair.dia >= BP_URGENT_DIA)
    const pickedRisk =
      Number(picked.sys >= BP_CRISIS_SYS || picked.dia >= BP_CRISIS_DIA) * 2 +
      Number(picked.sys >= BP_URGENT_SYS || picked.dia >= BP_URGENT_DIA)
    if (pairRisk > pickedRisk || (pairRisk === pickedRisk && pair.sys > picked.sys)) {
      picked = pair
    }
  }

  const emergency = picked.sys >= BP_CRISIS_SYS || picked.dia >= BP_CRISIS_DIA
  const urgent = !emergency && (picked.sys >= BP_URGENT_SYS || picked.dia >= BP_URGENT_DIA)
  return { emergency, urgent, sys: picked.sys, dia: picked.dia }
}

/**
 * 明确求助急症的语境词（症状红旗不在此列，统一走 matchRedFlagKeywords）：
 * - “120”只在拨打/呼叫语境命中：血压 120/80、心率 120、钠 1200、120 救护车咨询都不抢路由；
 * - “急救”只在求助/叫车语境命中：急救包/急救知识/急救医生等科普词不抢；
 * - “中风/急诊”在预防、挂号、科室、电话等疑问语境不抢（咨询照常路由）。
 */
const CALL_120_RE =
  /(?:拨打?|打|叫|喊|呼叫|联系)\s*120(?!\d|\s*[/／])|(?<![\d])120\s*急救|急救(?:电话)?\s*120(?!\d)/g
const CALL_FIRST_AID_RE =
  /(?:拨打?|打|叫|喊|需要|要|赶紧|赶快|快|立刻|马上|联系|呼叫)\s*急救(?!包|箱|知识|培训|课|证|手册|用品|技能|演练|员|医生|站|中心|药品|丸|散|药盒|措施|方法|常识|要点|设备)/g
const STROKE_RE = /中风|卒中/g
const ER_RE = /急诊/g

/** “中风/急诊”的非急症（科普/挂号/问路）语境，命中即不抢路由 */
const ER_INFO_CONTEXT_RE =
  /预防|防治|挂号|是什么|什么是|电话|科|有没有|预约|在哪|哪里|几楼|地址|流程|上班时间|门诊|前兆|征兆|信号|症状|原因/

/** 判断 中风/急诊 命中点附近是否为咨询科普语境 */
function isInfoContext(text: string, start: number, end: number): boolean {
  const window = text.slice(Math.max(0, start - 8), end + 8)
  return ER_INFO_CONTEXT_RE.test(window)
}

function collectRegexHits(
  text: string,
  re: RegExp,
  label: string,
  skip?: (start: number, end: number) => boolean,
): string[] {
  const out: string[] = []
  re.lastIndex = 0
  let matched: RegExpExecArray | null = null
  while ((matched = re.exec(text)) !== null) {
    const start = matched.index
    const end = start + matched[0].length
    // 独立的 “120”：前一位不能是数字（心率 1200）
    if (!skip || !skip(start, end)) out.push(label)
    if (start === re.lastIndex) re.lastIndex += 1
  }
  return out
}

/** 识别“拨打120/叫急救/中风发作/去急诊”等明确急症求助（带语境排除） */
export function detectExplicitEmergency(text: string): string[] {
  if (!text) return []
  const hits: string[] = []
  const add = (label: string): void => {
    if (!hits.includes(label)) hits.push(label)
  }

  collectRegexHits(text, CALL_120_RE, '拨打120').forEach(add)
  collectRegexHits(text, CALL_FIRST_AID_RE, '叫急救').forEach(add)
  // “120”数字本身要求独立：前一位是数字（如 1200）不算
  collectRegexHits(text, STROKE_RE, '中风', (s, e) => isInfoContext(text, s, e)).forEach(add)
  collectRegexHits(text, ER_RE, '急诊', (s, e) => isInfoContext(text, s, e)).forEach(add)

  return hits
}

/**
 * 急症输入综合识别：红旗症状短语（含否定豁免）+ 明确急症求助语境。
 * 血压数值急症由 detectBpCrisis 单独判定（180 档与 160 档话术不同）。
 * 普通“头晕”、血压 120/80、心率 120、钠 1200、预防中风、急诊挂号均不命中。
 */
export function detectEmergencyInput(text: string): string[] {
  const content = text ?? ''
  return [...matchRedFlagKeywords(content), ...detectExplicitEmergency(content)]
}

/**
 * 急症固定话术（给老人看的大白话）：
 * 开头明确“请立刻拨打 120”，正文用 EMERGENCY_GUIDE，结尾提醒别等 AI 回复。
 */
export function buildEmergencyReply(): string {
  return [
    '请立刻拨打 120！',
    EMERGENCY_GUIDE,
    '别等 AI 回复，也别自己开车去，马上联系急救或让家人送医。',
  ].join('\n\n')
}

/* ============================== 自行调药识别 ============================== */

/**
 * 自行调整处方药的危险表述。长词放前面，避免“调药”抢先匹配“帮你调药”。
 * 覆盖书面与老人口语：停药/减半/掰一半/半片/隔天吃/减成半片/药先停一停 等。
 * 命中即认为 AI/用户在讨论自行调药，需要追加用药免责提示。
 */
const UNSAFE_ADVICE_RE =
  /帮你调药|少吃一片|加一片|减一片|改药量|调药量|停药|停掉|减半|加量|减量|先别吃|剂量|调药|停(?:了|一停|先停|掉).{0,3}药|药.{0,4}停|掰.{0,2}(?:一半|两半|两半片|半片)|半片|隔(?:一)?天|减(?:成|到).{0,4}(?:一半|半|[0-9])/g

/**
 * 安全否定语境：危险表述前面紧邻（6 个字以内、无断句标点）出现否定词时不算命中，
 * 例如“别自己停药”“不要自行加量”“不建议您自行加量”。
 * 否定词按长度倒序，保证“千万别”优先于“别”、“不建议”优先于“不”。
 */
const NEGATION_RE = /(千万别|不建议|不要|不能|请勿|别)/g

/** 否定词与危险表述之间出现这些标点，说明已跨过另一个分句，否定不再覆盖 */
const CLAUSE_BREAK_RE = /[，。！？；,.!?;：:…、]/

/** 判断命中位置前面是否紧邻安全否定语境 */
function isNegatedContext(text: string, index: number): boolean {
  // 只向回看 6 个字符，跨得太远的否定不算
  let tail = text.slice(Math.max(0, index - 6), index)
  // 有断句标点时，只保留最后一个断点之后的片段
  const breakAt = tail.search(CLAUSE_BREAK_RE)
  if (breakAt !== -1) {
    tail = tail.slice(breakAt + 1)
  }
  // 取离危险表述最近的一个否定词（exec 到最后一个匹配）
  let found: RegExpExecArray | null = null
  let matched: RegExpExecArray | null = null
  NEGATION_RE.lastIndex = 0
  while ((matched = NEGATION_RE.exec(tail)) !== null) {
    found = matched
    if (matched.index === NEGATION_RE.lastIndex) NEGATION_RE.lastIndex += 1
  }
  if (!found) return false
  const negation = found[1]
  const before = tail[found.index - 1]
  const after = tail[found.index + negation.length]
  // “别人说可以停药”里的“别”不是劝阻
  if (negation === '别' && after === '人') return false
  // 正反问句不是否定：“能不能停药”“要不要加量”仍属危险表述
  if (negation === '不能' && before === '能') return false
  if (negation === '不要' && before === '要') return false
  return true
}

/**
 * “药 X 停”这类从“药”起匹配的模式，否定词可能夹在中间（药不能停/药没停），
 * 前置窗口照不到，需要单独看匹配片段内部；“药先停一停”内部无否定，仍命中。
 */
function isNegatedInsideStopMatch(matchText: string): boolean {
  if (!/^药[\s\S]{0,4}停/.test(matchText)) return false
  return /[不没别]/.test(matchText.slice(1))
}

/**
 * 识别“自行停药 / 减半 / 加量 / 改剂量 / 掰半片 / 隔天吃”等调整处方表述。
 * 安全否定语境（别 / 不要 / 不能 / 请勿 / 不建议 / 千万别 + 自己/自行等）豁免。
 */
export function detectUnsafeAdvice(text: string): boolean {
  if (!text) return false
  UNSAFE_ADVICE_RE.lastIndex = 0
  let matched: RegExpExecArray | null = null
  while ((matched = UNSAFE_ADVICE_RE.exec(text)) !== null) {
    if (isNegatedInsideStopMatch(matched[0])) continue
    if (!isNegatedContext(text, matched.index)) return true
    //防御零宽匹配导致死循环
    if (matched.index === UNSAFE_ADVICE_RE.lastIndex) UNSAFE_ADVICE_RE.lastIndex += 1
  }
  return false
}

/**
 * 在文本末尾追加用药免责提示；已包含则原样返回，保证重复调用不重复追加。
 */
export function withMedicationDisclaimer(text: string): string {
  if (!text) return MEDICATION_DISCLAIMER
  if (text.includes(MEDICATION_DISCLAIMER)) return text
  return `${text.replace(/\s+$/, '')}\n\n${MEDICATION_DISCLAIMER}`
}

/* ========================== 安全迷你 markdown ========================== */

export interface RichTextOptions {
  /**
   * 是否把“拨打 120 / 120 急救电话”语境渲染成 tel:120 链接。
   * 只允许 tel: 协议；http、www 等永远按纯文本展示。
   */
  linkify120?: boolean
}

/**
 * 拨打 120 语境：拨打/拨/打 120（可带“急救电话”），或“120 急救（电话）”。
 * 全应用唯一一份（AiAssistant 气泡分段也复用它），禁止再拷贝正则。
 */
export const TEL_120_RE = /((?:拨打?|打)\s*120(?:\s*急救(?:电话)?)?|120\s*急救(?:电话)?)/g

/** 120 段标记：{ tel: true } 表示该处渲染为“拨打 120”链接，其余为纯文本段 */
export type Tel120Segment = string | { tel: true }

/**
 * 按“拨打 120”语境把文本切成纯文本段与 tel 段。
 * 供 AiAssistant 气泡与 renderAiRichText 共用同一套切分规则。
 */
export function splitByTel120(text: string): Tel120Segment[] {
  if (!text) return [text]
  const segments: Tel120Segment[] = []
  let last = 0
  TEL_120_RE.lastIndex = 0
  let matched: RegExpExecArray | null = null
  while ((matched = TEL_120_RE.exec(text)) !== null) {
    if (matched.index > last) segments.push(text.slice(last, matched.index))
    segments.push({ tel: true })
    last = matched.index + matched[0].length
  }
  if (last < text.length) segments.push(text.slice(last))
  return segments.length ? segments : [text]
}

const BOLD_SPLIT_RE = /(\*\*[^*]+\*\*)/g

const UL_ITEM_RE = /^\s*[-•]\s+(.*\S.*)$/
const OL_ITEM_RE = /^\s*(\d+)[.、]\s+(.*\S.*)$/

/** 纯文本段内把“拨打 120”语境替换成 tel:120 链接，其余原样保留 */
function telSegments(text: string, linkify: boolean): Array<string | VNode> {
  if (!linkify || !text) return [text]
  const nodes: Array<string | VNode> = []
  for (const segment of splitByTel120(text)) {
    if (typeof segment === 'string') {
      nodes.push(segment)
    } else {
      nodes.push(h('a', { href: 'tel:120', class: 'ai-md__tel', rel: 'nofollow' }, '拨打 120'))
    }
  }
  return nodes
}

/** 行内解析：**加粗** + tel:120，其余一律纯文本（不识别任何其他标记） */
function inlineNodes(text: string, linkify: boolean): Array<string | VNode> {
  const nodes: Array<string | VNode> = []
  for (const segment of text.split(BOLD_SPLIT_RE)) {
    if (!segment) continue
    if (segment.length > 4 && segment.startsWith('**') && segment.endsWith('**')) {
      nodes.push(
        h('strong', { class: 'ai-md__strong' }, telSegments(segment.slice(2, -2), linkify)),
      )
    } else {
      nodes.push(...telSegments(segment, linkify))
    }
  }
  return nodes
}

/**
 * 安全迷你 markdown → VNode 列表：
 * - **加粗**；
 * - “- ”或“• ”开头连续行为无序列表；
 * - “1. ”“2、”开头连续行为有序列表；
 * - 空行分段；段落内换行靠 CSS white-space: pre-wrap 保留；
 * - 其他内容全部纯文本，不产出任何用户可控标签/属性。
 */
export function renderAiRichText(content: string, options: RichTextOptions = {}): VNode[] {
  const text = content ?? ''
  const linkify = options.linkify120 === true
  const nodes: VNode[] = []
  let blockSeq = 0

  let prose: string[] = []
  let ulItems: string[] = []
  let olItems: Array<{ order: number; text: string }> = []

  const flushProse = (): void => {
    if (prose.length === 0) return
    nodes.push(
      h('p', { class: 'ai-md__p', key: `p-${blockSeq++}` }, inlineNodes(prose.join('\n'), linkify)),
    )
    prose = []
  }
  const flushUl = (): void => {
    if (ulItems.length === 0) return
    nodes.push(
      h(
        'ul',
        { class: 'ai-md__ul', key: `ul-${blockSeq++}` },
        ulItems.map((item, i) =>
          h('li', { class: 'ai-md__li', key: i }, inlineNodes(item, linkify)),
        ),
      ),
    )
    ulItems = []
  }
  const flushOl = (): void => {
    if (olItems.length === 0) return
    const start = olItems[0]?.order ?? 1
    nodes.push(
      h(
        'ol',
        { class: 'ai-md__ol', key: `ol-${blockSeq++}`, start: start === 1 ? undefined : start },
        olItems.map((item, i) =>
          h('li', { class: 'ai-md__li', key: i }, inlineNodes(item.text, linkify)),
        ),
      ),
    )
    olItems = []
  }

  const lines = text.split('\n')
  for (const line of lines) {
    if (!line.trim()) {
      flushProse()
      flushUl()
      flushOl()
      continue
    }
    const ulMatch = UL_ITEM_RE.exec(line)
    const olMatch = OL_ITEM_RE.exec(line)
    if (ulMatch) {
      flushProse()
      flushOl()
      ulItems.push(ulMatch[1])
    } else if (olMatch) {
      flushProse()
      flushUl()
      olItems.push({ order: Number(olMatch[1]), text: olMatch[2] })
    } else {
      flushUl()
      flushOl()
      prose.push(line)
    }
  }
  flushProse()
  flushUl()
  flushOl()

  return nodes
}
