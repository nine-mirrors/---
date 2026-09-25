// AI 营养师本地 Mock：按最后一条用户消息的关键词路由，返回给老人看的中文口语短句。
// VITE_USE_MOCK !== 'false' 时由 src/api/ai.ts 调用，不耗 token、不发网络请求。
// 约定：每条回复 ≤80 字、句子短、语气温和；固定 400ms 延迟模拟"正在想"。

import {
  HIGH_BP_CRISIS_REPLY,
  HIGH_BP_URGENT_REPLY,
  MEDICATION_DISCLAIMER,
} from '@/constants/clinical'
import {
  buildEmergencyReply,
  detectBpCrisis,
  detectEmergencyInput,
  detectUnsafeAdvice,
} from '@/utils/aiSafety'
import type { AiContentPart, AiMessage, AiTextPart } from '@/types/ai'

const MOCK_DELAY_MS = 400

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * 体位性头晕：起身/起床/站起来等语境（含“蹲久了站起来晕/站起来站不稳”），
 * 给“三个半分钟”温和防跌倒建议。突发（突然…站不稳）已在急症步被拦走。
 */
const POSITIONAL_DIZZY_RE =
  /蹲久了|坐久了|躺久了|起猛了|体位性|三个半分钟|(?:起身|起床|站起来|站起身|坐起来|起来)[^，。！？；,.!?;]{0,4}(?:头晕|发晕|晕|站不稳)/

const POSITIONAL_DIZZY_REPLY =
  '这多半是起猛了。记住“三个半分钟”：醒来先躺半分钟，床上坐半分钟，腿垂床边再等半分钟，扶稳床头慢慢站，先别着急走。'

interface MockRoute {
  /** 命中任一关键词即走该回复（按数组顺序匹配，急症在前） */
  keys: string[]
  reply: string
}

const ROUTES: MockRoute[] = [
  {
    // 肾不好 / 控钾：要在"盐"之前匹配（低钠盐同时含两个关键词）
    keys: ['钾', '肾', '低钠盐', '透析'],
    reply:
      '肾不好或医生让控钾，就别换低钠盐、别自己吃补钾药，水果也别一次吃太多，按肾内科医生说的吃。',
  },
  {
    // 鸡蛋/蛋黄/胆固醇/内脏：现代口径不丢蛋黄、内脏偶尔少量（须排在高脂路由前，"猪肝"先命中本卡）
    keys: ['蛋黄', '鸡蛋', '鹌鹑蛋', '胆固醇', '猪肝', '内脏', '肥肠', '腰花'],
    reply:
      '鸡蛋每天吃一个就行，蛋黄营养多不用丢；猪肝、肥肠这类内脏胆固醇高，偶尔少量解解馋，不用完全戒。',
  },
  {
    // 肥肉/加工肉/饱和脂肪（"火腿"原在盐路由，本卡兼顾盐：加工肉盐也重）
    keys: [
      '肥肉',
      '五花肉',
      '腊肉',
      '香肠',
      '火腿',
      '加工肉',
      '猪油',
      '荤油',
      '动物油',
      '黄油',
      '奶油',
      '饱和脂肪',
    ],
    reply: '香肠、咸肉、五花肉这些加工肉和肥肉油大、盐也重，偶尔解馋行，平时多换鱼虾、鸡胸和豆腐。',
  },
  {
    keys: ['抽烟', '吸烟', '香烟', '戒烟', '烟', '喝酒', '饮酒', '白酒', '红酒', '啤酒', '酒'],
    reply:
      '烟最好彻底戒掉，啥时候戒都不晚，可拨12320问戒烟门诊；酒能不喝就不喝，要喝每天白酒不超1两，血压不稳时一滴别沾。',
  },
  {
    keys: [
      '纤维',
      '粗粮',
      '杂粮',
      '燕麦',
      '减重',
      '减肥',
      '长胖',
      '发胖',
      '热量',
      '七分饱',
      '体重',
    ],
    reply: '控制体重要每顿七分饱，主食换燕麦杂粮，多吃蔬菜豆类、少油少糖，饭后再散步20分钟。',
  },
  {
    keys: ['盐', '咸', '钠', '淡', '酱油', '咸菜', '泡面', '汤汁'],
    reply: '菜太咸就多喝温水，别用菜汤泡饭；下顿吃清淡点。酱油咸菜也含盐，一天盐总共别超5克。',
  },
  {
    keys: [
      '血压高',
      '血压有点高',
      '血压又高',
      '血压升',
      '血压降',
      '有点高',
      '偏高',
      '头晕',
      '头疼',
      '头痛',
    ],
    reply:
      '先坐下歇半小时再量一次。家里多次超135/85要告诉医生，药按时吃，菜淡一点，别生气别用蛮力。',
  },
  {
    keys: ['吃药', '降压药', '药忘', '忘吃', '停药', '换药', '药量', '用药', '服药'],
    reply: '降压药得按医生说的天天吃，不能自己停药、减半或换药。忘吃了别一次补两片，先问问医生。',
  },
  {
    keys: [
      '吃什么',
      '菜谱',
      '食谱',
      '晚饭',
      '晚餐',
      '午饭',
      '午餐',
      '早饭',
      '早餐',
      '饿',
      '推荐菜',
      '做点啥',
    ],
    reply: '给您推荐三个清淡菜：燕麦杂粮饭当主食，清蒸鲈鱼少油少盐，再来份西兰花炒虾仁，软嫩好嚼。',
  },
  {
    keys: [
      '怎么用',
      '不会用',
      '如何用',
      '咋用',
      '拍照',
      '记录',
      '怎么记',
      '记一',
      '按钮',
      '标签',
      '在哪',
      '哪里找',
      '周报',
      '打印',
    ],
    reply:
      '底部有五个标签：拍照、健康、周报、食谱、我的。首页大按钮拍照认菜，也能手动记一餐；血压在健康页记。',
  },
  {
    keys: ['你好', '您好', '在吗', '在么', 'hi', 'hello', '嗨', '早上好', '晚上好', '下午好'],
    reply:
      '您好呀！我是您的AI营养师。吃啥、盐多盐少、血压怎么管、软件怎么用，都能问我，点下面的问题也行。',
  },
]

const FALLBACK_REPLY =
  '您说的我还在学，换个问法试试。也可以点下面快捷问题，比如“这顿饭太咸怎么办”“今晚吃什么好”。'

const IMAGE_REPLY =
  '我看到您发的图片了。演示模式下我还看不清内容，接上真实AI后，我能帮您认菜、看配料表和营养标签。'

function isTextPart(part: AiContentPart): part is AiTextPart {
  return part.type === 'text'
}

/** content（string 或多模态 parts）里的全部文本拼接 */
function contentToText(content: string | AiContentPart[]): string {
  if (typeof content === 'string') return content
  return content
    .filter(isTextPart)
    .map((part) => part.text)
    .join('')
}

/** 取最后一条用户消息：路由文本 + 是否带图片 */
function lastUserMessage(messages: AiMessage[]): { text: string; hasImage: boolean } {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message.role !== 'user') continue
    const { content } = message
    const hasImage = Array.isArray(content) && content.some((part) => part.type === 'image_url')
    return { text: contentToText(content), hasImage }
  }
  return { text: '', hasImage: false }
}

/**
 * AI 营养师 mock 对话
 * @param messages 完整对话（system/user/assistant），只按最后一条 user 消息路由
 * @returns 中文口语短句（≤80 字）
 */
export async function mockChat(messages: AiMessage[]): Promise<string> {
  await delay(MOCK_DELAY_MS)
  const { text, hasImage } = lastUserMessage(messages)
  const lowered = text.toLowerCase()

  // 1) 急症最高优先级：红旗症状短语（含否定豁免）+ 拨打120/叫急救/中风发作/去急诊等求助语境。
  //    “血压120/80、心率120、钠1200、预防中风、急诊挂号、120救护车咨询”均不会被劫持。
  if (detectEmergencyInput(text).length > 0) {
    return buildEmergencyReply()
  }

  // 2) 数值血压路由：≥180/120 急症口径；160-179/100-119 复测+尽快就医口径。
  //    血压对识别（位数/合理范围/钠钾毫克心率语境排除）统一走 detectBpCrisis。
  const bp = detectBpCrisis(text)
  if (bp.emergency) return HIGH_BP_CRISIS_REPLY
  if (bp.urgent) return HIGH_BP_URGENT_REPLY

  // 2.5) 自行调药闸（停药/减半/掰一半/隔天吃/减成半片等，含否定豁免）：
  //      必须在关键词路由之前——“可以把药停了吗”不含连续子串“停药”，会漏过旧词表落兜底。
  if (detectUnsafeAdvice(text)) return MEDICATION_DISCLAIMER

  // 3) 图片消息走图片回复（演示模式不识图，诚实说明真实 AI 能力）
  if (hasImage) return IMAGE_REPLY

  if (!lowered.trim()) return FALLBACK_REPLY

  // 4) 体位性“站起来晕/站不稳”温和建议（必须排在普通“头晕”路由之前；
  //    “突然站不稳”等急症已在第 1 步被拦走）
  POSITIONAL_DIZZY_RE.lastIndex = 0
  if (POSITIONAL_DIZZY_RE.test(text)) {
    return POSITIONAL_DIZZY_REPLY
  }

  // 5) 常规关键词路由
  const hit = ROUTES.find((route) => route.keys.some((key) => lowered.includes(key.toLowerCase())))
  return hit ? hit.reply : FALLBACK_REPLY
}
