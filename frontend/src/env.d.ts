/// <reference types="vite/client" />

// 环境变量（Vite 只注入 VITE_ 前缀变量；均为 string | undefined）
interface ImportMetaEnv {
  /** 'false' 时走真实后端，其余值（含未设置）走本地 mock，见 src/api/index.ts */
  readonly VITE_USE_MOCK?: string
  /** 真实后端基地址，缺省由 http.ts 回落到 http://127.0.0.1:8000 */
  readonly VITE_API_BASE_URL?: string
  /** AI 营养师：OpenAI 兼容接口基地址，缺省 https://api.deepseek.com */
  readonly VITE_AI_BASE_URL?: string
  /** AI 营养师：模型名，缺省 deepseek-flash */
  readonly VITE_AI_MODEL?: string
  /** AI 营养师：接口密钥（建议只写在 .env.local；前端直连仅适合演示） */
  readonly VITE_AI_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// .vue 模块兜底声明（实际类型由 vue-tsc 按 SFC 生成）
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

// Web Speech API（识别部分）尚未进入 TS 内置 DOM lib，这里补最小可用声明
interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  readonly [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  readonly [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
}

interface SpeechRecognition extends EventTarget {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition
}

interface Window {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}
