<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Microphone } from '@element-plus/icons-vue'

const SETTINGS_KEY = 'ndh_settings_v1'

function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')
    if (raw && typeof raw === 'object') {
      return { speechEnabled: raw.speechEnabled === true, ...raw }
    }
  } catch {
    // 数据损坏时回退默认值
  }
  return { speechEnabled: false }
}

const settings = ref(loadSettings())

/* ---------- 浮条默认收拢成图标圆钮，不长期遮挡页面内容；
   桌面 hover / 手机点图标 才展开"语音播报 + 开关"，操作后 2.5 秒自动收回 ---------- */
const open = ref(false)
let closeTimer: ReturnType<typeof setTimeout> | null = null

function clearCloseTimer(): void {
  if (closeTimer !== null) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
}

function expand(): void {
  clearCloseTimer()
  open.value = true
}

function scheduleCollapse(): void {
  clearCloseTimer()
  closeTimer = setTimeout(() => {
    open.value = false
    closeTimer = null
  }, 2500)
}

/** 桌面端（真 hover 设备）鼠标移入才自动展开；
    触屏浏览器会在 tap 时合成 mouseenter，不区分会导致"点开又立刻收起"，故触屏忽略 */
function onMouseEnter(): void {
  if (window.matchMedia('(hover: hover)').matches) expand()
}

/** 点图标：收拢态点一下展开；已展开再点一下收回（触屏没有 mouseleave，必须给出收起途径） */
function onIconClick(): void {
  if (open.value) {
    clearCloseTimer()
    open.value = false
    return
  }
  expand()
}

function toggleSpeech(raw: string | number | boolean) {
  const value = Boolean(raw)
  // 保留完整 settings 对象后写回
  const next = { ...settings.value, speechEnabled: value }
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  } catch {
    // 隐私模式 / 配额满等场景写入会抛错：提示且不更新 settings，开关视觉自动回滚
    ElMessage.error('浏览器存储不可用，设置没法保存')
    return
  }
  settings.value = next
  // 通知同页 useSpeech 实例即时刷新（事件名需与其监听保持一致）
  window.dispatchEvent(new Event('ndh-settings-change'))
  // 老人操作完给一个确认状态的短暂窗口，再自动收回
  scheduleCollapse()
}

onBeforeUnmount(clearCloseTimer)
</script>

<template>
  <div
    class="speech-toggle"
    :class="{ 'is-open': open, 'is-on': settings.speechEnabled }"
    title="语音播报开关"
    @mouseenter="onMouseEnter"
    @mouseleave="scheduleCollapse"
  >
    <button
      type="button"
      class="speech-toggle__icon-btn"
      :aria-label="open ? '语音播报开关已展开' : '展开语音播报开关'"
      :aria-expanded="open"
      @click="onIconClick"
    >
      <el-icon class="speech-toggle__icon" aria-hidden="true"><Microphone /></el-icon>
    </button>
    <span class="speech-toggle__text" aria-hidden="true">语音播报</span>
    <el-switch
      class="speech-toggle__switch"
      :model-value="settings.speechEnabled"
      aria-label="语音朗读开关"
      title="语音朗读开关"
      @focus="expand"
      @blur="scheduleCollapse"
      @update:model-value="toggleSpeech"
    />
  </div>
</template>

<style scoped>
.speech-toggle {
  position: fixed;
  right: 20px;
  /* 矮屏：抬到底部 tabbar 之上，再让开右下角 AI 营养师悬浮球。
     偏移递增：tabbar(64) + 间距12 + AI球56 + 间距12 = 144，竖向紧邻不重叠
     （AI 球右侧文字胶囊与球同高，不增加竖向占位）；
     变量缺失时按 BottomTab 实际高度 64px 兜底 */
  bottom: calc(var(--tabbar-height, 64px) + 80px);
  z-index: 90;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  /* 默认只露 44px 圆钮，展开时再露出文字和开关，尽量少挡页面内容 */
  width: 44px;
  height: 44px;
  padding: 0;
  overflow: hidden;
  background-color: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  box-shadow: var(--shadow-base);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  transition:
    width 0.2s ease,
    border-radius 0.2s ease,
    padding 0.2s ease;
}

/* 展开：胶囊形态，文字与开关可见；宽度包住内容，不写死 */
.speech-toggle.is-open {
  width: auto;
  padding: 0 14px 0 0;
  border-radius: var(--radius-lg);
}

.speech-toggle__icon-btn {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  color: inherit;
  cursor: pointer;
}

.speech-toggle__icon {
  font-size: var(--font-size-lg);
  color: var(--color-primary);
}

/* 已开启：圆钮带主色淡底，收拢状态下也能一眼看出"开着" */
.speech-toggle.is-on .speech-toggle__icon-btn {
  background-color: color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-card));
}

.speech-toggle__text {
  flex: none;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.speech-toggle.is-open .speech-toggle__text {
  opacity: 1;
}

.speech-toggle__switch {
  flex: none;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.speech-toggle.is-open .speech-toggle__switch {
  opacity: 1;
  pointer-events: auto;
}

/* ≥1200px 桌面侧栏布局（无底部 tabbar）：让开右下角 AI 球：bottom20 + 球高56 + 间距12 */
@media (min-width: 1200px) {
  .speech-toggle {
    bottom: 88px;
  }
}
</style>
