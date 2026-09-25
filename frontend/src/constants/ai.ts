// AI 独立页面常量：localStorage 命名空间与附件限制

/** 会话列表 localStorage 命名空间（实际键 ai_chats_v1:<uid>） */
export const AI_CHATS_BASE = 'ai_chats_v1'

/** 反馈记录 localStorage 命名空间（实际键 ai_feedback_v1:<uid>） */
export const AI_FEEDBACK_BASE = 'ai_feedback_v1'

/** 单张图片大小上限（MB） */
export const MAX_IMAGE_MB = 5

/** 单个文本文件大小上限（KB） */
export const MAX_TEXT_FILE_KB = 512

/** 每条消息图片数量上限 */
export const MAX_IMAGE_COUNT = 3

/** 图片选择器接受的 MIME 类型 */
export const ACCEPT_IMAGE = 'image/jpeg,image/png,image/webp,image/gif'

/** 文本文件选择器接受的类型 */
export const ACCEPT_TEXT = '.txt,.md,text/plain,text/markdown'
