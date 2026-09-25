<script setup lang="ts">
import { Camera, DataLine, TrendCharts, ForkSpoon, User } from '@element-plus/icons-vue'

const tabItems = [
  { path: '/', label: '拍照', icon: Camera },
  { path: '/health', label: '健康', icon: DataLine },
  { path: '/weekly', label: '周报', icon: TrendCharts },
  { path: '/recipes', label: '食谱', icon: ForkSpoon },
  { path: '/profile', label: '我的', icon: User },
]
</script>

<template>
  <nav class="bottom-tab">
    <router-link v-for="item in tabItems" :key="item.path" :to="item.path" class="bottom-tab__item">
      <el-icon class="bottom-tab__icon"><component :is="item.icon" /></el-icon>
      <span class="bottom-tab__label">{{ item.label }}</span>
    </router-link>
  </nav>
</template>

<style scoped>
.bottom-tab {
  display: none;
}

/* <1200px 均为底部 tabbar（≥1200px 切换为桌面侧栏 SideNav）：
   原 767.98 断点会导致 768–1199 的平板/小窗口完全没有导航入口 */
@media (max-width: 1199.98px) {
  .bottom-tab {
    display: flex;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: var(--tabbar-height);
    background-color: var(--color-bg-card);
    border-top: 1px solid var(--color-border);
    /* 向上投影：方向保留（--shadow-sm 向下会投到屏外），暖色字面量改由文字 token 混出 */
    box-shadow: 0 -2px 10px color-mix(in srgb, var(--color-text) 8%, transparent);
    z-index: 100;
  }

  .bottom-tab__item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: var(--control-touch);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .bottom-tab__item.router-link-active {
    /* 非颜色通道：选中项加浅色底块（色弱用户也能分辨）；
       上下各留 6px，底块高约 52px，点击区仍 ≥44px。
       暖色纸体系混合（原 #e3f0eb 薄荷冷块发跳）：主色与卡片底混 10%——
       主色文字 #0e7a5f 在该底上对比度 ≈4.54:1（WCAG，≥4.5 达标；
       12% 混合仅 ≈4.42:1，不达标，故取 10%） */
    margin: 6px;
    color: var(--color-primary);
    background-color: color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-card));
    border-radius: var(--radius-md);
    font-weight: 600;
  }

  .bottom-tab__icon {
    font-size: 22px;
  }

  .bottom-tab__label {
    line-height: 1.2;
  }
}
</style>
