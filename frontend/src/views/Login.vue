<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Food, Lock, Message, User } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { isApiError } from '@/api/http'
import { MOCK_EMAIL_CODE } from '@/utils/account'

type TabKey = 'code' | 'password'
type PasswordMode = 'login' | 'register'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

const activeTab = ref<TabKey>('code')
const passwordMode = ref<PasswordMode>('login')

// 邮箱验证码登录
const codeForm = reactive({
  email: '',
  code: '',
})
const codeError = ref('')
const codeLoginLoading = ref(false)
const codeSending = ref(false)
const countdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

// 密码登录/注册
const pwdForm = reactive({
  email: '',
  password: '',
  name: '',
})
const pwdError = ref('')
const pwdLoading = ref(false)

// 一键体验
const demoLoading = ref(false)

onMounted(() => {
  if (auth.session) router.replace('/')
})

onBeforeUnmount(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
})

function clearAllErrors() {
  codeError.value = ''
  pwdError.value = ''
}

function switchTab(tab: TabKey) {
  if (activeTab.value === tab) return
  activeTab.value = tab
  clearAllErrors()
}

function switchPasswordMode(mode: PasswordMode) {
  if (passwordMode.value === mode) return
  passwordMode.value = mode
  pwdError.value = ''
}

// 验证码页直达注册：切到密码 tab 并进入注册模式
function goRegister() {
  activeTab.value = 'password'
  passwordMode.value = 'register'
  clearAllErrors()
}

// 格式校验（邮箱 / 6 位数字验证码）
function validateEmail(email: string): string | null {
  const value = email.trim()
  if (!value) return '请输入邮箱地址'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) || value.length > 128)
    return '邮箱格式不对，如 wangayi@163.com'
  return null
}

function validateCode(code: string): string | null {
  if (!code.trim()) return '请输入验证码'
  if (!/^\d{6}$/.test(code.trim())) return '请输入 6 位数字验证码'
  return null
}

function validatePassword(password: string): string | null {
  if (!password) return '请输入密码'
  if (password.length < 6) return '密码至少 6 位'
  return null
}

// 错误提取
function extractError(err: unknown, fallback: string): string {
  if (isApiError(err)) return err.message
  if (err instanceof Error) return err.message || fallback
  return fallback
}

// 登录成功后整页刷新跳转，清掉上个账号残留在内存里的 store 数据；
// 保留 redirect 查询参数拼接（仅接受站内绝对路径，防开放重定向）
function hardRedirectAfterLogin() {
  const redirect = route.query.redirect
  const target =
    typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
      ? redirect
      : '/'
  window.location.assign(target)
}

// 开始 60 秒倒计时
function startCountdown() {
  countdown.value = 60
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      countdown.value = 0
      if (countdownTimer) {
        clearInterval(countdownTimer)
        countdownTimer = null
      }
    }
  }, 1000)
}

// 发送邮箱验证码
async function handleSendCode() {
  if (codeSending.value || countdown.value > 0) return
  const emailErr = validateEmail(codeForm.email)
  if (emailErr) {
    codeError.value = emailErr
    return
  }
  codeError.value = ''
  codeSending.value = true
  try {
    await auth.sendEmailCode({ email: codeForm.email.trim() })
    startCountdown()
    // mock 模式自动填入演示码并明示
    if (USE_MOCK) {
      codeForm.code = MOCK_EMAIL_CODE
      codeError.value = ''
    }
  } catch (err) {
    codeError.value = extractError(err, '验证码发送失败，请稍后再试')
  } finally {
    codeSending.value = false
  }
}

// 邮箱验证码登录
async function handleCodeLogin() {
  if (codeLoginLoading.value) return
  const emailErr = validateEmail(codeForm.email)
  if (emailErr) {
    codeError.value = emailErr
    return
  }
  const codeErr = validateCode(codeForm.code)
  if (codeErr) {
    codeError.value = codeErr
    return
  }
  codeError.value = ''
  codeLoginLoading.value = true
  try {
    await auth.loginByEmail({
      email: codeForm.email.trim(),
      code: codeForm.code.trim(),
    })
    hardRedirectAfterLogin()
  } catch (err) {
    codeError.value = extractError(err, '登录失败，请稍后再试')
  } finally {
    codeLoginLoading.value = false
  }
}

// 密码登录
async function handlePasswordLogin() {
  if (pwdLoading.value) return
  const emailErr = validateEmail(pwdForm.email)
  if (emailErr) {
    pwdError.value = emailErr
    return
  }
  const pwdErr = validatePassword(pwdForm.password)
  if (pwdErr) {
    pwdError.value = pwdErr
    return
  }
  pwdError.value = ''
  pwdLoading.value = true
  try {
    await auth.login({
      email: pwdForm.email.trim(),
      password: pwdForm.password,
    })
    hardRedirectAfterLogin()
  } catch (err) {
    pwdError.value = extractError(err, '登录失败，请稍后再试')
  } finally {
    pwdLoading.value = false
  }
}

// 注册
async function handleRegister() {
  if (pwdLoading.value) return
  const emailErr = validateEmail(pwdForm.email)
  if (emailErr) {
    pwdError.value = emailErr
    return
  }
  const pwdErr = validatePassword(pwdForm.password)
  if (pwdErr) {
    pwdError.value = pwdErr
    return
  }
  pwdError.value = ''
  pwdLoading.value = true
  try {
    await auth.register({
      email: pwdForm.email.trim(),
      password: pwdForm.password,
      name: pwdForm.name.trim() || undefined,
    })
    hardRedirectAfterLogin()
  } catch (err) {
    pwdError.value = extractError(err, '注册失败，请稍后再试')
  } finally {
    pwdLoading.value = false
  }
}

// 一键体验
async function handleDemoLogin() {
  if (demoLoading.value) return
  demoLoading.value = true
  try {
    auth.demoLogin()
    hardRedirectAfterLogin()
  } finally {
    demoLoading.value = false
  }
}

const countdownLabel = computed(() => {
  if (countdown.value > 0) return `重新发送（${countdown.value} 秒）`
  return '获取验证码'
})

const sendCodeDisabled = computed(
  () => codeSending.value || countdown.value > 0 || codeLoginLoading.value,
)

// 验证码自动分段显示：123 456
const codeDisplay = computed(() => {
  const digits = codeForm.code.replace(/\D/g, '').slice(0, 6)
  if (digits.length <= 3) return digits
  return `${digits.slice(0, 3)} ${digits.slice(3)}`
})

function onCodeInput(value: string | Event) {
  // Element Plus el-input 的 input 事件传出字符串值；原生 input 事件传出 Event
  const raw = typeof value === 'string' ? value : ((value.target as HTMLInputElement)?.value ?? '')
  const digits = raw.replace(/\D/g, '').slice(0, 6)
  codeForm.code = digits
}
</script>

<template>
  <main class="login-page">
    <div class="login-card">
      <header class="brand">
        <div class="brand__badge" aria-hidden="true">
          <el-icon :size="30"><Food /></el-icon>
        </div>
        <h1 class="brand__name">营养膳食助手</h1>
        <p class="brand__slogan">吃得明白，身体更轻松</p>
      </header>

      <!-- 顶部两大 tab -->
      <div class="tabs" role="tablist">
        <button
          type="button"
          class="tab"
          :class="{ 'is-active': activeTab === 'code' }"
          role="tab"
          :aria-selected="activeTab === 'code'"
          @click="switchTab('code')"
        >
          验证码登录
        </button>
        <button
          type="button"
          class="tab"
          :class="{ 'is-active': activeTab === 'password' }"
          role="tab"
          :aria-selected="activeTab === 'password'"
          @click="switchTab('password')"
        >
          密码登录
        </button>
      </div>

      <!-- 邮箱验证码登录 -->
      <form v-if="activeTab === 'code'" class="login-form" @submit.prevent="handleCodeLogin">
        <el-alert
          v-if="codeError"
          :title="codeError"
          type="error"
          show-icon
          :closable="false"
          class="login-form__error"
        />

        <div class="field">
          <label class="field__label" for="login-email">邮箱</label>
          <el-input
            id="login-email"
            v-model="codeForm.email"
            size="large"
            placeholder="请输入邮箱地址"
            maxlength="128"
            inputmode="email"
            autocomplete="email"
          >
            <template #prefix>
              <el-icon :size="22"><Message /></el-icon>
            </template>
          </el-input>
        </div>

        <div class="field">
          <label class="field__label" for="login-code">验证码</label>
          <div class="code-row">
            <el-input
              id="login-code"
              :model-value="codeDisplay"
              size="large"
              placeholder="6 位数字"
              maxlength="7"
              inputmode="numeric"
              autocomplete="one-time-code"
              class="code-input"
              @input="onCodeInput"
            >
              <template #prefix>
                <el-icon :size="22"><Message /></el-icon>
              </template>
            </el-input>
            <button
              type="button"
              class="send-code-btn"
              :disabled="sendCodeDisabled"
              @click="handleSendCode"
            >
              {{ countdownLabel }}
            </button>
          </div>
          <p v-if="USE_MOCK" class="login-form__hint login-form__hint--mock">
            演示模式，验证码 {{ MOCK_EMAIL_CODE }}，已自动填入
          </p>
          <p v-else class="login-form__hint">验证码通过邮件发送，若没收到请看一眼垃圾邮件</p>
        </div>

        <el-button
          native-type="submit"
          type="primary"
          size="large"
          class="btn-login"
          :loading="codeLoginLoading"
        >
          登录
        </el-button>

        <div class="switch-row">
          <button type="button" class="switch-link" @click="goRegister">
            没有账号？用邮箱注册
          </button>
        </div>
      </form>

      <!-- 密码登录 / 注册 -->
      <form
        v-else
        class="login-form"
        @submit.prevent="passwordMode === 'login' ? handlePasswordLogin() : handleRegister()"
      >
        <el-alert
          v-if="pwdError"
          :title="pwdError"
          type="error"
          show-icon
          :closable="false"
          class="login-form__error"
        />

        <div class="field">
          <label class="field__label" for="pwd-email">邮箱</label>
          <el-input
            id="pwd-email"
            v-model="pwdForm.email"
            size="large"
            placeholder="请输入邮箱地址"
            maxlength="128"
            inputmode="email"
            autocomplete="email"
          >
            <template #prefix>
              <el-icon :size="22"><Message /></el-icon>
            </template>
          </el-input>
        </div>

        <div class="field">
          <label class="field__label" for="pwd-password">密码</label>
          <el-input
            id="pwd-password"
            v-model="pwdForm.password"
            size="large"
            type="password"
            placeholder="请输入密码（至少 6 位）"
            show-password
            :autocomplete="passwordMode === 'login' ? 'current-password' : 'new-password'"
          >
            <template #prefix>
              <el-icon :size="22"><Lock /></el-icon>
            </template>
          </el-input>
        </div>

        <div v-if="passwordMode === 'register'" class="field">
          <label class="field__label" for="pwd-name">昵称（可不填）</label>
          <el-input
            id="pwd-name"
            v-model="pwdForm.name"
            size="large"
            placeholder="比如：张阿姨"
            maxlength="20"
            autocomplete="nickname"
          >
            <template #prefix>
              <el-icon :size="22"><User /></el-icon>
            </template>
          </el-input>
        </div>

        <el-button
          native-type="submit"
          type="primary"
          size="large"
          class="btn-login"
          :loading="pwdLoading"
        >
          {{ passwordMode === 'login' ? '登录' : '注册并登录' }}
        </el-button>

        <div class="switch-row">
          <button
            v-if="passwordMode === 'login'"
            type="button"
            class="switch-link"
            @click="switchPasswordMode('register')"
          >
            没有账号？去注册
          </button>
          <button v-else type="button" class="switch-link" @click="switchPasswordMode('login')">
            已有账号？去登录
          </button>
        </div>

        <p v-if="USE_MOCK" class="login-form__hint login-form__hint--mock">
          演示模式：密码只保存在本机（加密存储、非明文），符合 6
          位以上格式即可；新邮箱请点上面的“注册并登录”
        </p>
      </form>

      <p class="login-form__hint">
        {{ USE_MOCK ? '演示版本，输入符合格式即可，不会真的联网验证' : '登录后数据将保存到服务器' }}
      </p>

      <div class="divider" aria-hidden="true"><span>或者</span></div>

      <el-button class="btn-demo" :disabled="demoLoading" @click="handleDemoLogin">
        一键体验登录
      </el-button>

      <p class="privacy">
        {{ USE_MOCK ? '数据只保存在这台电脑上，不会上传' : '您的数据将加密存储，请妥善保管账号' }}
      </p>
    </div>
  </main>
</template>

<style scoped src="./Login.css"></style>
