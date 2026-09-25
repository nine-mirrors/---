<script setup lang="ts">
import {
  Camera,
  ChatDotRound,
  DataLine,
  Expand,
  Fold,
  ForkSpoon,
  TrendCharts,
  User,
} from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()

// 演示环境标识：仅未显式关闭 mock（VITE_USE_MOCK !== 'false'）时出现
const isMockEnv = import.meta.env.VITE_USE_MOCK !== 'false'

const navItems = [
  { path: '/', label: '拍照', icon: Camera },
  { path: '/health', label: '健康', icon: DataLine },
  { path: '/weekly', label: '周报', icon: TrendCharts },
  { path: '/recipes', label: '食谱', icon: ForkSpoon },
  { path: '/profile', label: '我的', icon: User },
  { path: '/ai', label: 'AI 营养师', icon: ChatDotRound },
]
</script>

<template>
  <aside class="side-nav" :class="{ 'is-collapsed': settings.siderCollapsed }">
    <div class="side-nav__brand">
      <span class="side-nav__brand-text">营养膳食助手</span>
      <span class="side-nav__brand-logo" aria-hidden="true">营</span>
    </div>
    <nav class="side-nav__nav">
      <el-tooltip
        v-for="item in navItems"
        :key="item.path"
        :content="item.label"
        placement="right"
        :show-after="200"
        :disabled="!settings.siderCollapsed"
      >
        <router-link :to="item.path" class="side-nav__item">
          <el-icon class="side-nav__icon"><component :is="item.icon" /></el-icon>
          <span class="side-nav__label">{{ item.label }}</span>
        </router-link>
      </el-tooltip>
    </nav>
    <el-tooltip
      content="展开菜单"
      placement="right"
      :show-after="200"
      :disabled="!settings.siderCollapsed"
    >
      <button
        type="button"
        class="side-nav__toggle"
        :aria-label="settings.siderCollapsed ? '展开侧边栏' : '收起侧边栏'"
        :aria-expanded="!settings.siderCollapsed"
        @click="settings.toggleSider()"
      >
        <el-icon class="side-nav__icon">
          <component :is="settings.siderCollapsed ? Expand : Fold" />
        </el-icon>
        <span v-if="!settings.siderCollapsed" class="side-nav__label">收起菜单</span>
      </button>
    </el-tooltip>
    <span
      v-if="isMockEnv"
      class="side-nav__env"
      title="演示环境·数据为模拟"
      aria-label="当前为演示环境，数据为模拟数据"
    >
      <span class="side-nav__env-text" aria-hidden="true">演示环境·数据为模拟</span>
    </span>
  </aside>
</template>

<style scoped>
.side-nav {
  display: none;
}

@media (min-width: 1200px) {
  .side-nav {
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0;
    left: 0;
    width: var(--sider-width);
    height: 100vh;
    background-color: var(--color-bg-card);
    border-right: 1px solid var(--color-border);
    box-shadow: var(--shadow-sm);
    z-index: 100;
    transition: width 0.2s ease;
  }

  .side-nav.is-collapsed {
    width: var(--sider-width-collapsed);
  }

  .side-nav__brand {
    display: flex;
    align-items: center;
    min-height: 64px;
    padding: var(--space-lg) var(--space-lg);
    border-bottom: 1px solid var(--color-border);
  }

  .side-nav__brand-text {
    color: var(--color-primary-dark);
    font-size: var(--font-size-lg);
    font-weight: 700;
    line-height: 1.4;
    white-space: nowrap;
  }

  .side-nav__brand-logo {
    display: none;
  }

  .side-nav.is-collapsed .side-nav__brand {
    justify-content: center;
    padding: var(--space-lg) 0;
  }

  .side-nav.is-collapsed .side-nav__brand-text {
    display: none;
  }

  .side-nav.is-collapsed .side-nav__brand-logo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-sm);
    background-color: var(--color-primary);
    color: var(--color-text-inverse);
    font-size: var(--font-size-lg);
    font-weight: 700;
  }

  .side-nav__nav {
    display: flex;
    flex-direction: column;
    padding: var(--space-md) var(--space-sm);
    gap: var(--space-xs);
  }

  .side-nav__item {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    min-height: var(--control-touch);
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    font-size: var(--font-size-base);
    border-left: 3px solid transparent;
    transition:
      background-color 0.2s ease,
      color 0.2s ease;
  }

  .side-nav__item:hover {
    background-color: var(--color-bg-warm);
    color: var(--color-primary-dark);
  }

  .side-nav__item.router-link-active {
    background-color: var(--color-primary);
    color: var(--color-text-inverse);
    border-left-color: var(--color-primary-dark);
    font-weight: 600;
  }

  .side-nav__icon {
    flex-shrink: 0;
    font-size: var(--font-size-lg);
  }

  /* 折叠态：图标居中、文字隐藏、tooltip 提供可发现性 */
  .side-nav.is-collapsed .side-nav__item {
    justify-content: center;
    gap: 0;
    padding: var(--space-sm);
    border-left-color: transparent;
  }

  .side-nav.is-collapsed .side-nav__item.router-link-active {
    border-left-color: transparent;
  }

  .side-nav.is-collapsed .side-nav__label {
    display: none;
  }

  /* 底部收放开关：全宽贴合、点击区 ≥44px */
  .side-nav__toggle {
    margin-top: auto;
    display: flex;
    align-items: center;
    gap: var(--space-md);
    width: 100%;
    min-height: 44px;
    padding: var(--space-sm) var(--space-md);
    border: 0;
    border-top: 1px solid var(--color-border);
    background-color: transparent;
    color: var(--color-text-secondary);
    font-size: var(--font-size-base);
    line-height: 1.4;
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      color 0.2s ease;
  }

  .side-nav__toggle:hover {
    background-color: var(--color-bg-warm);
    color: var(--color-primary-dark);
  }

  .side-nav.is-collapsed .side-nav__toggle {
    justify-content: center;
    gap: 0;
    padding: var(--space-sm);
  }

  /* 演示环境药丸：贴在折叠开关下方，纯提示不响应点击，不挤占导航点击区 */
  .side-nav__env {
    margin: var(--space-sm) var(--space-md) var(--space-md);
    padding: 4px var(--space-sm);
    font-size: var(--font-size-xs);
    line-height: 1.4;
    text-align: center;
    color: var(--color-warning-text);
    background-color: var(--color-warning-bg);
    border: 1px solid color-mix(in srgb, var(--color-warning-strong) 35%, var(--color-bg-card));
    border-radius: 999px;
    white-space: nowrap;
    pointer-events: none;
  }

  /* 折叠态宽度仅 72px，容不下整句：文字隐藏，保留一枚 ≥12px 的 warning 圆点，
     不丢“演示环境”标识；圆点放开指针事件，hover 可见 title 提示，
     读屏仍由外层 aria-label 朗读 */
  .side-nav.is-collapsed .side-nav__env {
    /* span 默认 inline，不接宽高：改为 inline-flex 才能呈现圆点 */
    display: inline-flex;
    align-self: center;
    box-sizing: content-box;
    width: 14px;
    height: 14px;
    margin: var(--space-sm) 0 var(--space-md);
    padding: 0;
    background-color: var(--color-warning-strong);
    border-color: transparent;
    border-radius: 50%;
    pointer-events: auto;
  }

  .side-nav.is-collapsed .side-nav__env-text {
    display: none;
  }
}
</style>
