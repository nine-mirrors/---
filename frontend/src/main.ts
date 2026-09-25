import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { ElMessage } from 'element-plus'
// Element Plus 按需：模板组件样式由 unplugin-vue-components 自动引入；
// 函数式调用（JS 里直接 ElMessage/ElMessageBox）模板扫描不到，样式在此手动引入。
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'

import App from './App.vue'
import router from './router'
import { announce } from './composables/useSpeech'
import './styles/base.css'
import './styles/components.css'
// 必须在最后：统一放大 teleport 到 body 的 ElMessage/ElMessageBox（适老化）
import './styles/elderly-overrides.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// 系统级提醒文案（ElMessage 展示 + 语音播报共用，保证"看到的"和"听到的"一致）
const PAGE_FAULT_TEXT = '页面出了点小问题，请稍后再试；如果一直这样，重新打开页面就好。'
const NETWORK_FAULT_TEXT = '网络或页面出了点小问题，请稍后再试。'
// 长辈读大字需要更长时间：系统级错误统一停留 6 秒（Element Plus 默认 3 秒太短）
const SYSTEM_NOTICE_DURATION = 6000

// R2.3 全局兜底错误处理：console.error 留证据 + 温和中文提示，避免白屏惊吓老人。
app.config.errorHandler = (err, _instance, info) => {
  console.error('[app] Vue 未捕获错误:', err, info)
  try {
    ElMessage({
      message: PAGE_FAULT_TEXT,
      type: 'warning',
      duration: SYSTEM_NOTICE_DURATION,
    })
  } catch {
    // ElementPlus 尚未挂载时忽略提示
  }
  // 语音开关已打开的用户同步听到提醒；未开启时静默不打扰
  announce(PAGE_FAULT_TEXT)
}

// 未捕获的 Promise 拒绝（多为网络请求失败）：同样留证 + 中文提示，防止白屏
window.addEventListener('unhandledrejection', (event) => {
  console.error('[app] 未处理的 Promise 异常:', event.reason)
  try {
    ElMessage({
      message: NETWORK_FAULT_TEXT,
      type: 'warning',
      duration: SYSTEM_NOTICE_DURATION,
    })
  } catch {
    // 提示组件不可用时忽略，控制台已有证据
  }
  announce(NETWORK_FAULT_TEXT)
})

app.mount('#app')
