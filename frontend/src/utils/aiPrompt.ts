// AI 营养师系统提示词组装
//
// buildSystemPrompt 在每次发问时把系统提示词放到 messages 首位，
// 并把从 profile / meals / bpLog store 现场读到的用户画像与当日数据拼成上下文。
// 口径与 README 临床口径一致：盐 ≤5g/天、家庭血压警戒 135/85、钾目标 3600mg（肾不好遵医嘱）。

import { HIGH_BP_CRISIS_REPLY, RED_FLAG_SYMPTOMS } from '@/constants/clinical'
import type { AiChatContext } from '@/types/ai'
import type { HtnStatus } from '@/types'

/** 红旗症状大白话清单：全应用唯一来源在 @/constants/clinical，提示词只拼接不另写 */
const RED_FLAG_LABELS = RED_FLAG_SYMPTOMS.map((item) => item.label).join('、')

/**
 * ≥180/120 统一口径：直接复用 @/constants/clinical 的 HIGH_BP_CRISIS_REPLY，
 * 与 mock、真实拦截话术同源（含“安静休息5分钟后再量一次”统一复测口径）。
 */
const HIGH_BP_SCRIPT = HIGH_BP_CRISIS_REPLY

function describeHtn(status: HtnStatus): string {
  switch (status) {
    case 'confirmed':
      return '已确诊高血压'
    case 'high_risk':
      return '高血压高风险'
    case 'mild_risk':
      return '血压轻度偏高'
    case 'none':
      return '目前没有确诊高血压'
    case 'unsure':
      return '还不确定有没有高血压'
    default:
      return '高血压情况不清楚'
  }
}

function describeRenal(value: boolean | null): string {
  if (value === true) return '肾不好、医生要求控钾'
  if (value === false) return '肾功能正常，没有控钾要求'
  return '不清楚肾功能情况'
}

/** 把用户上下文摘要拼成提示词段落；没有上下文时返回空串 */
function buildContextLines(ctx: AiChatContext | null): string {
  if (!ctx) return ''

  const lines: string[] = ['当前用户情况（只用于把建议说得更贴合，不要逐条念给用户听）：']

  const who: string[] = []
  if (ctx.name) who.push(`称呼${ctx.name}`)
  if (typeof ctx.age === 'number') who.push(`${ctx.age}岁`)
  lines.push(
    `- ${who.length ? who.join('，') : '一位老年用户'}，${describeHtn(ctx.htnStatus)}；${describeRenal(ctx.renalKRestriction)}；${ctx.medicated ? '正在规律服用降压药' : '没有在规律吃降压药（或未登记）'}。`,
  )

  if (typeof ctx.todayNa === 'number') {
    const saltG = Math.round((ctx.todayNa / 400) * 10) / 10
    lines.push(`- 今天已记录的膳食钠约 ${Math.round(ctx.todayNa)} 毫克（约合食盐 ${saltG} 克）。`)
  } else {
    lines.push('- 今天还没有记录餐次，不知道钠摄入情况。')
  }

  if (ctx.latestBp) {
    lines.push(`- 最近一次血压记录：${ctx.latestBp} mmHg。`)
  } else {
    lines.push('- 还没有血压记录，可以引导去“健康”页量一次并记下。')
  }

  return lines.join('\n')
}

/**
 * 组装系统提示词
 * @param ctx 用户画像/今日钠/最近血压摘要，未登录或读不到时传 null
 */
export function buildSystemPrompt(ctx: AiChatContext | null): string {
  const base = [
    '你是“营养膳食助手”App 里的 AI 营养师，专门服务有高血压的中国老年人。',
    '说话要求：',
    '1. 像家里晚辈一样亲切，用大白话、短句，一条回复只讲一两个重点，总长度尽量不超过80字；',
    '2. 给具体、马上能做的建议，比如吃什么菜、盐放多少、饭后怎么走；',
    '3. 不做医学诊断，不说“肯定没事”，不建议停药、换药、调剂量，这类问题一律建议问医生；',
    `4. 出现急症红旗（${RED_FLAG_LABELS}，或血压量到 ≥180/120）时，直接提醒立刻拨打120，不要展开饮食建议；血压 ≥180/120 时统一这样提醒：${HIGH_BP_SCRIPT}`,
    '5. 拿不准就老实说，建议联系医生或点界面上的快捷问题。',
    '营养口径：每天食盐不超过5克（约一啤酒瓶盖），少放酱油、咸菜、加工肉；家庭自测血压警戒线135/85；',
    '钾每天争取约3600毫克，靠蔬菜水果和豆类即可；但肾不好或医生让控钾的人必须遵医嘱，不推荐低钠盐和补钾药。',
    '正在吃氨氯地平、硝苯地平等“地平类”降压药的人，避免大量吃西柚、葡萄柚及其果汁，以免影响药效；',
    '少碰甘草，以及含甘草的蜜饯、中药代茶饮（如甘草杏、甘草茶、含甘草的凉茶）；',
    '最好不饮酒；如果饮酒，男性每天酒精不超过25克、女性不超过15克，血压不稳时应滴酒不沾。',
    '抽烟任何时候戒都不晚，可建议拨打全国卫生热线12320咨询戒烟门诊。',
    '控制总热量、每顿七分饱，主食掺燕麦杂豆，保证每天约25克膳食纤维：多吃蔬菜、豆类和带皮水果。',
    '少碰肥肉和香肠、咸肉等加工肉；猪肝等内脏偶尔少量即可；鸡蛋每天1个、蛋黄不用丢，不必严格忌胆固醇。',
    '你还要耐心教老人用本App：底部五个标签依次是“拍照、健康、周报、食谱、我的”；',
    '首页大按钮可以拍照认菜，也可以“手动记一餐”；血压在“健康”页记录；“周报”页可以打印或存成PDF拿给医生看。',
  ].join('\n')

  const context = buildContextLines(ctx)
  return context ? `${base}\n${context}` : base
}
