// axios 实例：统一 baseURL / 超时 / Bearer 注入 / ApiError / 401 统一登出
//
// Task 12a：
// - baseURL 读 VITE_API_BASE_URL，缺省 http://127.0.0.1:8000；
// - 请求拦截器从会话键 ndh_auth_v1 读取 token 注入 Authorization: Bearer
//   （auth store 为会话单一来源，持久化到 localStorage，此处读取其落库值以避免循环依赖）；
// - 响应拦截器：401 → 动态 import auth store 调用 logout（清会话+跳登录）+ 中文提示；
//   非 2xx 抛出 ApiError（含 code/message，code 取 response.data.code 或 http status）；
// - 网络/超时错误给中文人话提示。

import axios from 'axios'
import type { AxiosRequestConfig } from 'axios'
import { AUTH_SESSION_KEY } from '@/utils/account'
import type { Session } from '@/types/auth'

const DEFAULT_BASE_URL = 'http://127.0.0.1:8000'

/** 统一 API 错误：code 为业务码或 HTTP 状态码，message 为中文提示 */
export class ApiError extends Error {
  code: string | number
  constructor(code: string | number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

/** 类型守卫：判断是否为 ApiError */
export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError
}

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL,
  timeout: 10000,
})

/** 从会话键读取 token（auth store 持久化的值） */
function readAuthToken(): string | null {
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as Session | null
    return session && typeof session.token === 'string' && session.token ? session.token : null
  } catch {
    return null
  }
}

// 请求拦截器：注入 Bearer token
instance.interceptors.request.use((config) => {
  const token = readAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/**
 * 401 统一处理（单飞：并发请求同时 401 只处理一次）：
 * 清会话（内存+localStorage，不调用 /auth/logout，避免该端点自身 401 形成递归）
 * 后硬刷新到 /login，彻底清掉旧账号内存态。
 */
let unauthorizedInFlight: Promise<void> | null = null

function handleUnauthorized(): Promise<void> {
  if (unauthorizedInFlight) return unauthorizedInFlight
  unauthorizedInFlight = (async () => {
    console.warn('[http] 收到 401：登录已过期，清理会话并硬刷新到 /login')
    try {
      window.localStorage.removeItem(AUTH_SESSION_KEY)
    } catch {
      /* ignore */
    }
    try {
      const { useAuthStore } = await import('@/stores/auth')
      useAuthStore().clearSessionLocal()
    } catch (err) {
      console.warn('[http] auth store 清理失败', err)
    }
    if (window.location.pathname !== '/login') {
      window.location.assign('/login')
    }
  })()
  return unauthorizedInFlight
}

/** /api/auth/* 自身的 401（如密码错误）是正常业务响应，不得当作会话过期 */
function isAuthEndpoint(url?: string): boolean {
  return typeof url === 'string' && url.includes('/api/auth/')
}

// 响应拦截器：成功直接返回后端响应体；失败抛出 ApiError
instance.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    // 401：未登录 / 会话过期（登录/注册等 auth 端点除外）
    if (error?.response?.status === 401 && !isAuthEndpoint(error.config?.url)) {
      await handleUnauthorized()
      return Promise.reject(new ApiError(401, '登录已过期，请重新登录'))
    }

    // 业务错误码：取后端 data.code，回落 HTTP status
    const status: number = error?.response?.status ?? 0
    const data = error?.response?.data
    const code: string | number =
      (data && (data.code as string | number)) ?? (status || 'NETWORK_ERROR')

    let message: string
    if (error.code === 'ERR_NETWORK') {
      message = '网络连不上，请确认后端服务已打开'
    } else if (error.code === 'ECONNABORTED') {
      message = '请求超时，请确认后端服务是否正常后重试'
    } else {
      message =
        (data && typeof data.message === 'string' && data.message) ||
        error.message ||
        '请求失败，请稍后再试'
    }

    return Promise.reject(new ApiError(code, message))
  },
)

/**
 * 运行时响应拦截器已解包 AxiosResponse，这里重声明方法签名为 Promise<T>
 */
export interface ApiHttp {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  put<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>
}

const http = instance as unknown as ApiHttp

export default http
