<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import AppLayout from '@/components/layout/AppLayout.vue'
import RouteErrorBoundary from '@/components/common/RouteErrorBoundary.vue'
import AiAssistant from '@/components/ai/AiAssistant.vue'
import { routeLoading } from '@/router'

const route = useRoute()

// 登录与引导页为全屏页面，不套应用布局
const useAppLayout = computed(() => route.meta.layout === 'app')

// 登录页与 onboarding 引导流程不挂 AI 悬浮球/面板（/ai 全屏页由组件自身隐藏）
const showAiAssistant = computed(
  () => !route.path.startsWith('/login') && !route.path.startsWith('/onboarding'),
)
</script>

<template>
  <!-- 按需引入后不再 app.use(ElementPlus)，中文语言包通过 ConfigProvider 注入 -->
  <el-config-provider :locale="zhCn">
    <AppLayout v-if="useAppLayout">
      <RouteErrorBoundary>
        <router-view />
      </RouteErrorBoundary>
    </AppLayout>
    <RouteErrorBoundary v-else>
      <router-view />
    </RouteErrorBoundary>

    <!-- AI 营养师悬浮球：登录页与 onboarding 引导流程不渲染，z-index 低于 routeLoading 遮罩 -->
    <AiAssistant v-if="showAiAssistant" />

    <!--
      守卫异步加载期间的"正在进入…"全屏遮罩（AC-28）。
      刻意不用 <transition>：冷加载时遮罩在首帧绘制前就离场（或窗口在后台/合成器停帧），
      Vue 过渡会卡死在 enter/leave 类上，留下透明却拦截所有点击的"幽灵节点"。
      纯 class 常驻方案：状态为假的同一帧即 opacity:0 + pointer-events:none，
      可见性只由当前状态决定，不依赖 transitionend，结构上不可能卡死。
    -->
    <div
      class="route-loading"
      :class="{ 'route-loading--show': routeLoading }"
      role="status"
      aria-live="polite"
      :aria-hidden="!routeLoading"
    >
      <div class="route-loading__spinner" aria-hidden="true" />
      <p class="route-loading__text">正在进入…</p>
    </div>
  </el-config-provider>
</template>

<style scoped>
.route-loading {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: rgba(250, 247, 240, 0.92);
  /* 隐藏态：同帧立即不拦截点击、移出可访问性树；仅透明度走 0.2s 渐变 */
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity 0.2s ease,
    visibility 0s linear 0.2s;
}

.route-loading--show {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transition:
    opacity 0.2s ease,
    visibility 0s;
}

.route-loading__spinner {
  width: 44px;
  height: 44px;
  border: 4px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  /* 隐藏时停转，省 CPU；显示时再转 */
  animation: spin 0.9s linear infinite;
}

.route-loading:not(.route-loading--show) .route-loading__spinner {
  animation-play-state: paused;
}

.route-loading__text {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-text-secondary);
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
