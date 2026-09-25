import { describe, expect, it } from 'vitest'
import {
  buildEmergencyReply,
  detectBpCrisis,
  detectEmergencyInput,
  detectUnsafeAdvice,
  renderAiRichText,
  splitByTel120,
  withMedicationDisclaimer,
} from '@/utils/aiSafety'
import { mockChat } from '@/mock/ai'
import {
  EMERGENCY_GUIDE,
  HIGH_BP_CRISIS_REPLY,
  HIGH_BP_URGENT_REPLY,
  MEDICATION_DISCLAIMER,
  RED_FLAG_SYMPTOMS,
  REST_RECHECK_PHRASE,
  matchRedFlagKeywords,
} from '@/constants/clinical'

describe('detectEmergencyInput 急症输入兜底', () => {
  it('胸痛、胸闷命中红旗词', () => {
    expect(detectEmergencyInput('我胸痛得厉害')).toContain('胸痛')
    expect(detectEmergencyInput('胸口闷，胸闷喘不上气')).toContain('胸闷')
  })

  it('普通“头晕”不命中，避免把体位性头晕误导到急救通道', () => {
    expect(detectEmergencyInput('今天有点头晕')).toEqual([])
    expect(detectEmergencyInput('头晕')).toEqual([])
  })

  it('“突然眩晕站不稳”命中（突发神经症状走急症）', () => {
    const hit = detectEmergencyInput('突然眩晕站不稳，差点摔了')
    expect(hit).toContain('突然眩晕')
    expect(hit).toContain('站不稳')
  })

  it('日常买菜等家常话不命中', () => {
    expect(detectEmergencyInput('早上去菜市场买了条鲈鱼，晚上清蒸')).toEqual([])
    expect(detectEmergencyInput('')).toEqual([])
  })
})

describe('detectBpCrisis 数值血压急症识别', () => {
  it('185/115 → emergency', () => {
    const r = detectBpCrisis('刚量的185/115，头有点疼')
    expect(r.emergency).toBe(true)
    expect(r.urgent).toBe(false)
    expect(r.sys).toBe(185)
    expect(r.dia).toBe(115)
  })

  it('179/119 → urgent（未到急症线）', () => {
    const r = detectBpCrisis('179/119 要不要紧')
    expect(r.emergency).toBe(false)
    expect(r.urgent).toBe(true)
    expect(r.sys).toBe(179)
  })

  it('120/80 → 正常读数，两级均不触发但保留数值', () => {
    const r = detectBpCrisis('我血压120/80正常吗')
    expect(r.emergency).toBe(false)
    expect(r.urgent).toBe(false)
    expect(r.sys).toBe(120)
    expect(r.dia).toBe(80)
  })

  it('“钠1200毫克”没有血压对，不识别', () => {
    const r = detectBpCrisis('这顿饭钠1200毫克多吗')
    expect(r).toEqual({ emergency: false, urgent: false })
  })

  it('“钠2000/1500毫克”不允许匹配成血压（四位数+钠语境）', () => {
    const r = detectBpCrisis('钠2000/1500毫克，是不是太多了')
    expect(r).toEqual({ emergency: false, urgent: false })
  })

  it('“心率120”不是血压，不识别', () => {
    const r = detectBpCrisis('心率120有事吗')
    expect(r).toEqual({ emergency: false, urgent: false })
  })

  it('180/120 恰好踩线 → emergency', () => {
    const r = detectBpCrisis('血压180/120')
    expect(r.emergency).toBe(true)
    expect(r.sys).toBe(180)
    expect(r.dia).toBe(120)
  })

  it('“2000/1500”四位数对不识别（旧正则会误匹配成 00/150）', () => {
    const r = detectBpCrisis('2000/1500')
    expect(r).toEqual({ emergency: false, urgent: false })
  })

  it('中文血压写法同样识别：高压180低压120 / 收缩压185舒张压112', () => {
    expect(detectBpCrisis('高压180低压120').emergency).toBe(true)
    expect(detectBpCrisis('收缩压185舒张压112').emergency).toBe(true)
    expect(detectBpCrisis('高压165低压95').urgent).toBe(true)
  })

  it('160-179/100-119 区间逐档正确', () => {
    expect(detectBpCrisis('160/99').urgent).toBe(true)
    expect(detectBpCrisis('159/100').urgent).toBe(true)
    expect(detectBpCrisis('159/99').urgent).toBe(false)
    // 低压反超高压不是有效读数
    expect(detectBpCrisis('90/120')).toEqual({ emergency: false, urgent: false })
  })
})

describe('红旗词短语化 + 否定识别', () => {
  it('“一边吃饭一边头晕”不命中（一边≠偏瘫）', () => {
    expect(detectEmergencyInput('一边吃饭一边头晕')).toEqual([])
  })

  it('“脖子一侧有点酸”“头偏向一侧就晕”不命中（一侧≠偏瘫）', () => {
    expect(detectEmergencyInput('脖子一侧有点酸')).toEqual([])
    expect(detectEmergencyInput('头偏向一侧就晕')).toEqual([])
  })

  it('“一边身子麻”“突然一侧手脚无力”命中偏瘫短语', () => {
    expect(detectEmergencyInput('一边身子麻').length).toBeGreaterThan(0)
    const hit = detectEmergencyInput('突然一侧手脚无力')
    expect(hit.length).toBeGreaterThan(0)
    expect(hit.some((tag) => tag.includes('一侧') || tag.includes('手脚'))).toBe(true)
  })

  it('普通否定窗口内不命中：没有胸闷 / 我不胸痛', () => {
    expect(detectEmergencyInput('没有胸闷')).toEqual([])
    expect(detectEmergencyInput('我不胸痛')).toEqual([])
  })

  it('否定跨过分句后不豁免：没有胸痛，现在胸闷得厉害 → 胸闷仍命中', () => {
    expect(detectEmergencyInput('没有胸痛，现在胸闷得厉害')).toContain('胸闷')
  })

  it('“站不稳”三例区分：体位性不命中、突发/伴摔命中', () => {
    expect(detectEmergencyInput('有时候站起来站不稳')).toEqual([])
    expect(detectEmergencyInput('蹲久了站起来站不稳')).toEqual([])
    expect(detectEmergencyInput('突然站起来站不稳')).toContain('站不稳')
    expect(detectEmergencyInput('站不稳差点摔了')).toContain('站不稳')
  })

  it('“手脚麻利”等家常词不蹭“麻”的命中', () => {
    expect(detectEmergencyInput('老爷子一边手脚麻利地包饺子')).toEqual([])
  })

  it('血压弹窗勾选拼出的红旗清单整句 label 仍可命中（弱侧标签回归保护）', () => {
    const weakLabel = RED_FLAG_SYMPTOMS.find((s) => s.id === 'weak_side')!.label
    expect(matchRedFlagKeywords(weakLabel).length).toBeGreaterThan(0)
    expect(matchRedFlagKeywords(`备注：${weakLabel}`).length).toBeGreaterThan(0)
  })
})

describe('detectExplicitEmergency 求助语境（综合在 detectEmergencyInput 内）', () => {
  it('正常咨询不被 120/中风/急诊 劫持', () => {
    expect(detectEmergencyInput('我血压120/80正常吗')).toEqual([])
    expect(detectEmergencyInput('这顿饭钠1200毫克多吗')).toEqual([])
    expect(detectEmergencyInput('心率120有事吗')).toEqual([])
    expect(detectEmergencyInput('吃什么能预防中风')).toEqual([])
    expect(detectEmergencyInput('急诊挂号电话多少')).toEqual([])
    expect(detectEmergencyInput('120救护车上有医生吗')).toEqual([])
    expect(detectEmergencyInput('中风的前兆有哪些')).toEqual([])
    expect(detectEmergencyInput('急诊在几楼')).toEqual([])
  })

  it('“120/80正常吗”走综合急症检测不触发', () => {
    expect(detectEmergencyInput('120/80正常吗')).toEqual([])
  })

  it('真正求助时命中', () => {
    expect(detectEmergencyInput('快帮我拨打120').length).toBeGreaterThan(0)
    expect(detectEmergencyInput('我妈中风了，怎么办').length).toBeGreaterThan(0)
    expect(detectEmergencyInput('老人不行了，快去急诊').length).toBeGreaterThan(0)
    expect(detectEmergencyInput('需要急救，人叫不醒').length).toBeGreaterThan(0)
  })
})

describe('detectUnsafeAdvice 自行调药识别', () => {
  it('“可以减半片”命中自行减量表述', () => {
    expect(detectUnsafeAdvice('降压药可以减半片吗')).toBe(true)
  })

  it('“别自己停药”处于安全否定语境，不命中', () => {
    expect(detectUnsafeAdvice('降压药要天天吃，别自己停药')).toBe(false)
  })

  it('“不要自行加量”处于安全否定语境，不命中', () => {
    expect(detectUnsafeAdvice('血压正常也不要自行加量')).toBe(false)
  })

  it('其他调药表述命中：先别吃 / 剂量 / 停掉 / 加一片', () => {
    expect(detectUnsafeAdvice('今天的药先别吃了吧')).toBe(true)
    expect(detectUnsafeAdvice('帮我把剂量调小一点')).toBe(true)
    expect(detectUnsafeAdvice('我想把降压药停掉')).toBe(true)
    expect(detectUnsafeAdvice('明天加一片行不行')).toBe(true)
  })

  it('更多安全否定语境不命中：不能/请勿/不建议/千万别', () => {
    expect(detectUnsafeAdvice('千万不能自行停药')).toBe(false)
    expect(detectUnsafeAdvice('请勿自行减半，先问医生')).toBe(false)
    expect(detectUnsafeAdvice('不建议您自行加量')).toBe(false)
    expect(detectUnsafeAdvice('千万别自己改剂量')).toBe(false)
  })

  it('正反问句“能不能/要不要”不算安全否定，仍命中', () => {
    expect(detectUnsafeAdvice('我能不能先停药两天')).toBe(true)
    expect(detectUnsafeAdvice('血压稳了要不要减量')).toBe(true)
  })

  it('日常饮食问题不命中', () => {
    expect(detectUnsafeAdvice('今晚吃清蒸鲈鱼可以吗，少放盐')).toBe(false)
    expect(detectUnsafeAdvice('')).toBe(false)
  })

  it('二轮复审口语绕过全部命中', () => {
    expect(detectUnsafeAdvice('可以把药停了吗')).toBe(true)
    expect(detectUnsafeAdvice('我想把药停了')).toBe(true)
    expect(detectUnsafeAdvice('药先停一停')).toBe(true)
    expect(detectUnsafeAdvice('隔一天吃一次')).toBe(true)
    expect(detectUnsafeAdvice('能不能掰一半吃')).toBe(true)
    expect(detectUnsafeAdvice('自己减成半片')).toBe(true)
    expect(detectUnsafeAdvice('一片掰两半')).toBe(true)
    expect(detectUnsafeAdvice('隔天吃一片行不行')).toBe(true)
  })

  it('口语否定豁免继续不命中：不能掰一半 / 别隔天 / 药不能停', () => {
    expect(detectUnsafeAdvice('不能掰一半吃')).toBe(false)
    expect(detectUnsafeAdvice('别隔天吃药')).toBe(false)
    expect(detectUnsafeAdvice('药不能停')).toBe(false)
  })
})

describe('buildEmergencyReply 急症话术', () => {
  it('开头明确“请立刻拨打 120”，正文含共享急症指引，结尾提醒别等 AI', () => {
    const reply = buildEmergencyReply()
    expect(reply.startsWith('请立刻拨打 120')).toBe(true)
    expect(reply).toContain(EMERGENCY_GUIDE)
    expect(reply).toContain('120')
    expect(reply).toMatch(/别等\s*AI\s*回复/)
  })
})

describe('withMedicationDisclaimer 用药免责', () => {
  it('末尾追加固定免责文案', () => {
    const out = withMedicationDisclaimer('这个药可以先减半试试。')
    expect(out.endsWith(MEDICATION_DISCLAIMER)).toBe(true)
    expect(out.startsWith('这个药可以先减半试试。')).toBe(true)
  })

  it('重复追加不重复，多次调用结果稳定', () => {
    const once = withMedicationDisclaimer('建议问医生。')
    const twice = withMedicationDisclaimer(once)
    const thrice = withMedicationDisclaimer(twice)
    expect(twice).toBe(once)
    expect(thrice).toBe(once)
    expect(twice.split(MEDICATION_DISCLAIMER)).toHaveLength(2)
  })

  it('空文本直接返回免责文案本身', () => {
    expect(withMedicationDisclaimer('')).toBe(MEDICATION_DISCLAIMER)
  })
})

describe('renderAiRichText 安全迷你 markdown', () => {
  function nodeHtml(node: unknown): string {
    // 测试环境无 DOM：用 VNode 结构做轻量断言，避免引入渲染依赖
    const v = node as { type?: unknown; props?: Record<string, unknown>; children?: unknown }
    return JSON.stringify(v)
  }

  /** 递归收集 VNode 树里的标签类型、href 与全部纯文本 */
  function inspect(node: unknown): {
    types: string[]
    hrefs: string[]
    text: string
  } {
    const types: string[] = []
    const hrefs: string[] = []
    let text = ''
    const walk = (v: unknown): void => {
      if (v === null || v === undefined) return
      if (typeof v === 'string' || typeof v === 'number') {
        text += String(v)
        return
      }
      if (Array.isArray(v)) {
        v.forEach(walk)
        return
      }
      const n = v as { type?: unknown; props?: Record<string, unknown>; children?: unknown }
      if (typeof n.type === 'string') {
        types.push(n.type)
        if (typeof n.props?.href === 'string') hrefs.push(n.props.href)
      }
      if (n.children !== undefined) walk(n.children)
    }
    walk(node)
    return { types, hrefs, text }
  }

  it('只生成 p / ul / ol / li / strong / a 白名单标签与 tel:120 链接', () => {
    const nodes = renderAiRichText(
      '**记住两点**\n- 少盐\n- 多菜\n\n1. 先歇五分钟\n2. 不舒服请立刻拨打 120',
      { linkify120: true },
    )
    const json = nodeHtml(nodes)
    expect(json).toContain('strong')
    expect(json).toContain('ul')
    expect(json).toContain('ol')
    expect(json).toContain('"href":"tel:120"')
    expect(json).not.toContain('http')
  })

  it('不开启 120 链接化时“120”按纯文本展示，且任何网址都不自动链接', () => {
    const nodes = renderAiRichText('拨打 120 或访问 www.example.com http://x.cn', {
      linkify120: false,
    })
    const json = nodeHtml(nodes)
    const { types, hrefs, text } = inspect(nodes)
    expect(json).not.toContain('tel:120')
    expect(json).not.toContain('<a')
    expect(json).toContain('www.example.com')
    expect(types).not.toContain('a')
    expect(hrefs).toEqual([])
    expect(text).toContain('www.example.com')
    expect(text).toContain('http://x.cn')
  })

  it('XSS 锁定：<script>、[x](javascript:)、纯文本 javascript: 全部原样纯文本、无链接无脚本节点', () => {
    const cases = [
      '<script>alert(1)</script>',
      '[x](javascript:alert(1))',
      '请访问 javascript:alert(1) 这个地址',
    ]
    for (const raw of cases) {
      const nodes = renderAiRichText(raw, { linkify120: true })
      const { types, hrefs, text } = inspect(nodes)
      expect(types).not.toContain('script')
      expect(types).not.toContain('a')
      expect(hrefs).toEqual([])
      expect(hrefs.some((h) => h.includes('javascript'))).toBe(false)
      // 危险原文逐字保留为纯文本（不转义成可执行节点，也不自作主张删改）
      expect(text).toContain(raw)
    }
  })

  it('splitByTel120 导出复用：拨打120语境切出 tel 段，血压数字不切', () => {
    const segs = splitByTel120('不舒服请立刻拨打120急救电话，血压120/80要记好')
    expect(segs.some((s) => typeof s === 'object' && s.tel === true)).toBe(true)
    expect(segs.some((s) => typeof s === 'string' && s.includes('120/80'))).toBe(true)
  })
})

describe('mockChat 急症/血压/体位性路由（端到端锁定二轮问题）', () => {
  async function ask(text: string): Promise<string> {
    return mockChat([{ role: 'user', content: text }])
  }

  it('被劫持的 6 类正常咨询不再回“请立刻拨打 120”', async () => {
    const cases = [
      '我血压120/80正常吗',
      '这顿饭钠1200毫克多吗',
      '心率120有事吗',
      '吃什么能预防中风',
      '急诊挂号电话多少',
      '120救护车上有医生吗',
    ]
    for (const text of cases) {
      const reply = await ask(text)
      expect(reply.startsWith('请立刻拨打 120')).toBe(false)
      expect(reply).not.toBe(buildEmergencyReply())
    }
  })

  it('钠 2000/1500 毫克走饮食路由，不再被当血压急症', async () => {
    const reply = await ask('这顿饭钠2000/1500毫克是不是超标了')
    expect(reply.startsWith('请立刻拨打 120')).toBe(false)
  })

  it('≥180/120 走统一 HIGH_BP 急症复测话术（含安静休息5分钟口径）', async () => {
    const reply = await ask('刚量185/115怎么办')
    expect(reply).toBe(HIGH_BP_CRISIS_REPLY)
    expect(reply).toContain(REST_RECHECK_PHRASE)
  })

  it('160-179/100-119 走复测+尽快就医话术', async () => {
    const reply = await ask('血压170/105')
    expect(reply).toBe(HIGH_BP_URGENT_REPLY)
    expect(reply).toContain(REST_RECHECK_PHRASE)
    expect(reply.startsWith('请立刻拨打 120')).toBe(false)
  })

  it('体位性“站起来站不稳/蹲久了站起来晕”可达三个半分钟分支', async () => {
    expect(await ask('有时候站起来站不稳')).toContain('三个半分钟')
    expect(await ask('蹲久了站起来晕')).toContain('三个半分钟')
  })

  it('突发站不稳仍走急症话术', async () => {
    const reply = await ask('突然站不稳，摔了一下')
    expect(reply).toBe(buildEmergencyReply())
  })

  it('真求助拨打120仍走急症话术', async () => {
    expect(await ask('快帮我拨打120')).toBe(buildEmergencyReply())
  })

  it('自行调药口语（把药停了/掰一半/隔天吃/减成半片）统一拦截到用药免责，不落兜底', async () => {
    const cases = [
      '最近血压正常了，可以把药停了吗',
      '我想把药停了',
      '能不能掰一半吃',
      '隔天吃一片行不行',
      '自己减成半片可以吗',
    ]
    for (const text of cases) {
      const reply = await ask(text)
      expect(reply).toBe(MEDICATION_DISCLAIMER)
    }
  })

  it('安全宣教（不能自己停药）不被拦截，且忘吃药咨询走用药路由而非免责话术', async () => {
    // 否定豁免在 detectUnsafeAdvice 函数级用例覆盖；这里端到端验证不误伤正常用药咨询
    const reply = await ask('今天忘吃药了怎么办')
    expect(reply).not.toBe(MEDICATION_DISCLAIMER)
    expect(reply).toContain('医生')
  })
})
