import { createRouter, createWebHistory } from 'vue-router'
import { ref } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { announce } from '@/composables/useSpeech'

/** 全局路由加载态：守卫异步期间为 true，供 App.vue 显示"正在进入…" */
export const routeLoading = ref(false)

/**
 * 遮罩看门狗：守卫若意外挂起（await 永不返回），遮罩最多显示 8 秒后强制消失，
 * 绝不让全屏"正在进入…"把整个应用永久钉死。
 */
let loadingWatchdog: number | null = null
const LOADING_WATCHDOG_MS = 8000

function showRouteLoading(): void {
  if (loadingWatchdog !== null) window.clearTimeout(loadingWatchdog)
  routeLoading.value = true
  loadingWatchdog = window.setTimeout(() => {
    loadingWatchdog = null
    routeLoading.value = false
  }, LOADING_WATCHDOG_MS)
}

function hideRouteLoading(): void {
  if (loadingWatchdog !== null) {
    window.clearTimeout(loadingWatchdog)
    loadingWatchdog = null
  }
  routeLoading.value = false
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录' },
  },
  {
    path: '/onboarding',
    name: 'onboarding',
    component: () => import('@/views/Onboarding.vue'),
    meta: { title: '引导' },
  },
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/Home.vue'),
    meta: { layout: 'app', title: '拍照' },
  },
  {
    path: '/result',
    name: 'result',
    component: () => import('@/views/Result.vue'),
    meta: { layout: 'app', title: '识别结果' },
  },
  {
    path: '/health',
    name: 'health',
    component: () => import('@/views/Health.vue'),
    meta: { layout: 'app', title: '健康' },
  },
  {
    path: '/weekly',
    name: 'weekly',
    component: () => import('@/views/Weekly.vue'),
    meta: { layout: 'app', title: '周报' },
  },
  {
    path: '/recipes',
    name: 'recipes',
    component: () => import('@/views/Recipes.vue'),
    meta: { layout: 'app', title: '食谱' },
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/Profile.vue'),
    meta: { layout: 'app', title: '我的' },
  },
  {
    path: '/devices',
    name: 'devices',
    component: () => import('@/views/Devices.vue'),
    meta: { layout: 'app', title: '我的设备' },
  },
  {
    // 全屏独立页（无 layout/tabbar），参照 /login
    path: '/ai',
    name: 'ai-chat',
    component: () => import('@/views/ai/AiChatPage.vue'),
    meta: { title: 'AI 营养师' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

/** 标记 auth store 是否已恢复（避免每次导航都重读 localStorage） */
let authRestored = false

/**
 * 全局异步守卫（Task 12a 重写）
 *
 * 1. 确保 auth store 已从 localStorage 恢复会话；
 * 2. 无会话 → /login；
 * 3. 有会话 → profile.ensureLoaded()（确保画像加载，期间可显示"正在进入…"）；
 * 4. 未完成引导 → /onboarding；
 * 5. 已登录访问 /login → /；已引导访问 /onboarding → /。
 */
router.beforeEach(async (to) => {
  showRouteLoading()
  try {
    const auth = useAuthStore()

    // 首次导航恢复会话
    if (!authRestored) {
      auth.restore()
      authRestored = true
    }

    // 无会话 → 登录页
    if (!auth.session) {
      return to.path === '/login' ? true : { path: '/login' }
    }

    // 已登录访问登录页 → 首页
    if (to.path === '/login') {
      return { path: '/' }
    }

    // 有会话：确保画像加载完成（12b 实现 ensureLoaded）
    // 画像读取异常不应把页面永久钉死在“正在进入…”遮罩上：记录后按默认画像放行
    const profile = useProfileStore()
    try {
      await profile.ensureLoaded()
    } catch (err) {
      console.warn('[router] 画像加载失败，按默认画像继续导航', err)
    }

    // 已完成引导仍访问引导页 → 首页
    if (to.path === '/onboarding' && profile.profile.onboarded === true) {
      return { path: '/' }
    }

    // 未完成引导 → 引导页
    if (profile.profile.onboarded !== true && to.path !== '/onboarding') {
      return { path: '/onboarding' }
    }

    return true
  } finally {
    // 任何分支（含提前 return / 异常）都必须复位遮罩，避免全屏“正在进入…”卡死
    hideRouteLoading()
  }
})

router.afterEach((to) => {
  hideRouteLoading()
  // 之前失败的目标页本次成功打开 → 恢复链路闭环，清掉计数，不影响日后独立故障
  const state = readRecoverState()
  if (state.count > 0 && state.target && to.path === state.target) {
    clearRecoverState()
  }
})

/**
 * 路由模块加载失败兜底（dev server 重启 / 发版后旧 hash chunk 失效 / 网络闪断 /
 * 浏览器扩展改写 JS 响应 / 磁盘缓存被污染）。
 *
 * 浏览器会把解析失败的模块按 URL 永久记为失败，仅整页刷新能清除，因此：
 * 1) 前 RECOVER_LIMIT 次：不弹框，立即静默整页刷新（带缓存击穿参数），
 *    长辈通常只看到一次"闪一下"，页面自己就好了；
 * 2) 连续失败超过上限（典型为扩展持续注入）：不再无脑刷新循环，
 *    弹窗点名原因并给出"再试一次 / 回首页"两个出口；
 * 计数存 sessionStorage（要跨整页刷新存活），同目标成功导航即清零。
 */
const RECOVERABLE_MODULE_RE =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\d]+ failed|SyntaxError|Invalid or unexpected token|Unexpected token|Unexpected end of input|Illegal character|may appear only with 'sourceType: module'|Failed to construct 'URL'/i

const RECOVER_KEY = 'ndh_route_recover_v1'
/** 时间窗内静默自动刷新的最大次数；超过则弹窗交回用户决定 */
const RECOVER_LIMIT = 2
const RECOVER_WINDOW_MS = 5 * 60 * 1000

interface RecoverState {
  count: number
  since: number
  target: string | null
}

function readRecoverState(): RecoverState {
  try {
    const raw = sessionStorage.getItem(RECOVER_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RecoverState>
      if (
        typeof parsed.count === 'number' &&
        typeof parsed.since === 'number' &&
        Date.now() - parsed.since < RECOVER_WINDOW_MS
      ) {
        return { count: parsed.count, since: parsed.since, target: parsed.target ?? null }
      }
    }
  } catch {
    // 隐私模式 / 数据损坏：视为无历史
  }
  return { count: 0, since: Date.now(), target: null }
}

function writeRecoverState(state: RecoverState): void {
  try {
    sessionStorage.setItem(RECOVER_KEY, JSON.stringify(state))
  } catch {
    // 写不进去就放弃预算控制（极端环境下可能多刷新几次，不会更糟）
  }
}

function clearRecoverState(): void {
  try {
    sessionStorage.removeItem(RECOVER_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * 带缓存击穿参数的整页刷新（replace：失败页不进历史栈，避免后退再次踩雷）。
 * 传 targetPath 时直接重载到失败的目标页——模块注册表被整页刷新清空后，
 * 页面会在目标页重新走一遍正常加载，长辈感知就是"闪一下，到了想去的页面"。
 */
function hardReloadWithCacheBust(targetPath?: string): void {
  try {
    const base = targetPath
      ? new URL(targetPath, window.location.origin)
      : new URL(window.location.href)
    base.searchParams.set('_r', String(Date.now()))
    window.location.replace(base.toString())
  } catch {
    window.location.reload()
  }
}

router.onError((error, to) => {
  hideRouteLoading()
  const message = error instanceof Error ? error.message : String(error)
  if (!RECOVERABLE_MODULE_RE.test(message)) {
    console.warn('[router] 导航失败', error)
    return
  }

  const targetKey = to?.path || location.pathname
  const state = readRecoverState()
  state.count += 1
  state.since = state.count === 1 ? Date.now() : state.since
  state.target = targetKey
  writeRecoverState(state)

  if (state.count <= RECOVER_LIMIT) {
    console.warn(
      `[router] 页面模块加载失败（第 ${state.count} 次，可能是扩展干扰/缓存损坏），静默刷新到目标页`,
      message,
    )
    hardReloadWithCacheBust(to?.fullPath)
    return
  }

  console.warn('[router] 连续刷新仍加载失败，停止自动循环，弹窗引导用户处理', error)
  const loadFailText =
    '这个页面连续几次都没能加载出来。原因是浏览器本地缓存的页面文件被损坏了（常见于安全软件、网络加速器/代理写入了错误内容，重启电脑也不会自动修复）。请花半分钟清一次缓存：\n1. 按键盘 Ctrl + Shift + Delete；\n2. 时间范围选"所有时间"，只勾选"缓存的图像和文件"（密码和登录不用清）；\n3. 点"立即清除"，然后回到本页点"我已清缓存，再试一次"。\n也可以先"回首页"从首页重新进入。'
  announce(loadFailText)
  ElMessageBox.confirm(loadFailText, '页面反复加载失败', {
    confirmButtonText: '我已清缓存，再试一次',
    cancelButtonText: '回首页',
    type: 'warning',
    closeOnClickModal: false,
    distinguishCancelAndClose: true,
    customClass: 'ndh-route-fail-box',
  })
    .then(() => {
      // 用户已清缓存：清预算后带缓存击穿重进
      clearRecoverState()
      hardReloadWithCacheBust()
    })
    .catch((action: string) => {
      if (action === 'cancel') {
        // "回首页"：硬跳转，绕开当前损坏的页面模块
        clearRecoverState()
        window.location.replace('/')
      }
      // action === 'close'（右上角 X / Esc）：留在原地，不强制刷新
    })
})

export default router
