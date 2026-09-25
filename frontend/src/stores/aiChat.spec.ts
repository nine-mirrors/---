// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAiChatStore } from '@/stores/aiChat'
import { AI_CHATS_BASE, AI_FEEDBACK_BASE } from '@/constants/ai'
import { AUTH_SESSION_KEY } from '@/utils/account'
import { mockChat } from '@/mock/ai'
import type { AiConversation, AiFeedbackRecord } from '@/types/ai'

/** 内存版 localStorage（与 storage.spec.ts 同一套路，node 环境下 stub window） */
class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  clear(): void {
    this.store.clear()
  }
}

const TEST_UID = 't1'
let storage: MemoryStorage

/** 直接读 ns 持久化后的原始 JSON（不经过 nsRead，以便断言 dataUrl 被剥离） */
function readRaw<T>(base: string): T | null {
  const raw = storage.getItem(`${base}:${TEST_UID}`)
  return raw ? (JSON.parse(raw) as T) : null
}

/** 换新 Pinia = 模拟刷新后重新创建 store */
function freshStore() {
  setActivePinia(createPinia())
  return useAiChatStore()
}

beforeEach(() => {
  storage = new MemoryStorage()
  vi.stubGlobal('window', { localStorage: storage })
  // 测试前写入登录会话（Session 结构，uid=t1），nsRead/nsWrite 据此取命名空间
  storage.setItem(
    AUTH_SESSION_KEY,
    JSON.stringify({
      uid: TEST_UID,
      phone: '13800000000',
      name: '测试老人',
      token: 'tok',
      loginAt: '',
    }),
  )
  setActivePinia(createPinia())
})

afterEach(() => {
  storage.clear()
  vi.unstubAllGlobals()
})

describe('aiChat store', () => {
  it('新建会话加 user/assistant 两条，persist 后重新 restore 内容在', () => {
    const store = useAiChatStore()
    store.restore()
    const convId = store.currentId
    expect(convId).toBeTruthy()
    expect(store.conversations).toHaveLength(1)

    const longText = '今天晚上家里做了清蒸鲈鱼还有西兰花炒虾仁不知道能不能吃'
    const userMsg = store.addMessage(convId, { role: 'user', content: longText })
    store.addMessage(convId, { role: 'assistant', content: '可以吃，少油少盐，鱼肉很好。' })

    expect(userMsg.id).toBeTruthy()
    expect(userMsg.createdAt).toBeTruthy()
    expect(store.current?.messages).toHaveLength(2)
    // 标题取首条 user 消息前 16 字
    expect(store.current?.title).toBe(longText.slice(0, 16))
    expect([...(store.current?.title ?? '')]).toHaveLength(16)

    // 模拟刷新：新 Pinia 新 store，restore 后内容完整
    const reloaded = freshStore()
    expect(reloaded.loaded).toBe(false)
    reloaded.restore()
    expect(reloaded.currentId).toBe(convId)
    expect(reloaded.current?.messages).toHaveLength(2)
    expect(reloaded.current?.messages[0]).toMatchObject({
      role: 'user',
      content: longText,
    })
    expect(reloaded.current?.messages[1]).toMatchObject({
      role: 'assistant',
      content: '可以吃，少油少盐，鱼肉很好。',
    })
  })

  it('图片附件持久化时剥离 dataUrl 但保留 name，内存态仍可读 dataUrl', () => {
    const store = useAiChatStore()
    store.ensureCurrent()
    const convId = store.currentId
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD'
    store.addMessage(convId, {
      role: 'user',
      content: '帮我看看这道菜',
      attachments: [
        {
          id: 'att-1',
          kind: 'image',
          name: '晚餐.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          dataUrl,
        },
      ],
    })

    // 内存态保留 dataUrl（当次请求与预览要用）
    expect(store.current?.messages[0].attachments?.[0].dataUrl).toBe(dataUrl)

    // 持久化数据：dataUrl 被剥离，name 等元信息保留
    const saved = readRaw<AiConversation[]>(AI_CHATS_BASE)
    const savedAtt = saved?.[0]?.messages[0]?.attachments?.[0]
    expect(savedAtt).toBeDefined()
    expect(savedAtt?.name).toBe('晚餐.jpg')
    expect(savedAtt?.mimeType).toBe('image/jpeg')
    expect(savedAtt?.size).toBe(1024)
    expect(savedAtt?.dataUrl).toBeUndefined()
  })

  it('setFeedback 点赞写入 ai_feedback_v1 且消息 feedback=up，再点一次取消', async () => {
    const store = useAiChatStore()
    store.ensureCurrent()
    const convId = store.currentId
    store.addMessage(convId, { role: 'user', content: '这顿饭太咸怎么办' })
    const aiMsg = store.addMessage(convId, { role: 'assistant', content: '多喝温水，下顿清淡点。' })

    store.setFeedback(convId, aiMsg.id, 'up')
    expect(store.current?.messages[1].feedback).toBe('up')

    const records = readRaw<AiFeedbackRecord[]>(AI_FEEDBACK_BASE)
    expect(records).toHaveLength(1)
    expect(records?.[0]).toMatchObject({
      conversationId: convId,
      messageId: aiMsg.id,
      question: '这顿饭太咸怎么办',
      answer: '多喝温水，下顿清淡点。',
      feedback: 'up',
    })

    // fire-and-forget 上报（mock 延迟 200ms）不应抛错；等它跑完确认无未处理异常
    await new Promise((resolve) => setTimeout(resolve, 300))

    // 再点同值：取消
    store.setFeedback(convId, aiMsg.id, 'up')
    expect(store.current?.messages[1].feedback).toBeNull()
    expect(readRaw<AiFeedbackRecord[]>(AI_FEEDBACK_BASE)).toEqual([])
  })

  it('点踩切换为 down 时反馈记录被 upsert 而非新增', () => {
    const store = useAiChatStore()
    store.ensureCurrent()
    const convId = store.currentId
    store.addMessage(convId, { role: 'user', content: '问个问题' })
    const aiMsg = store.addMessage(convId, { role: 'assistant', content: '答非所问的回复' })

    store.setFeedback(convId, aiMsg.id, 'up')
    store.setFeedback(convId, aiMsg.id, 'down')
    const records = readRaw<AiFeedbackRecord[]>(AI_FEEDBACK_BASE)
    expect(records).toHaveLength(1)
    expect(records?.[0].feedback).toBe('down')
    expect(store.current?.messages[1].feedback).toBe('down')
  })

  it('删除当前会话后自动有一个空会话', () => {
    const store = useAiChatStore()
    store.ensureCurrent()
    const convId = store.currentId
    store.addMessage(convId, { role: 'user', content: '马上要被删掉的问题' })
    expect(store.conversations).toHaveLength(1)

    store.deleteConversation(convId)
    expect(store.conversations).toHaveLength(1)
    expect(store.currentId).toBeTruthy()
    expect(store.currentId).not.toBe(convId)
    expect(store.current?.messages).toEqual([])

    // 刷新后落盘的也是那一个空会话
    const reloaded = freshStore()
    reloaded.restore()
    expect(reloaded.conversations).toHaveLength(1)
    expect(reloaded.current?.messages).toEqual([])
  })

  it('deleteConversation 删不存在的 id 不炸', () => {
    const store = useAiChatStore()
    expect(() => store.deleteConversation('not-exist-id')).not.toThrow()
    store.ensureCurrent()
    expect(() => store.deleteConversation('not-exist-id')).not.toThrow()
    expect(store.conversations).toHaveLength(1)
  })

  it('addMessage 传未知 convId 容错落到当前会话', () => {
    const store = useAiChatStore()
    const msg = store.addMessage('wrong-id', { role: 'user', content: '容错消息' })
    expect(msg.content).toBe('容错消息')
    expect(store.current?.messages.map((m) => m.id)).toContain(msg.id)
  })
})

describe('mock 图片路由', () => {
  it('含 image part 的消息返回图片相关回复', async () => {
    const reply = await mockChat([
      {
        role: 'user',
        content: [
          { type: 'text', text: '帮我认一下这盘菜' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
        ],
      },
    ])
    expect(reply).toContain('图片')
  })

  it('纯 text part 数组仍走原有文本路由', async () => {
    const reply = await mockChat([{ role: 'user', content: [{ type: 'text', text: '你好' }] }])
    expect(reply).toContain('您好')
  })
})
