<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings'
import SideNav from './SideNav.vue'
import BottomTab from './BottomTab.vue'
import GlobalSpeechToggle from '@/components/common/GlobalSpeechToggle.vue'

const settings = useSettingsStore()
</script>

<template>
  <div class="app-layout" :class="{ 'app-layout--sider-collapsed': settings.siderCollapsed }">
    <SideNav />
    <main class="app-layout__main">
      <slot />
    </main>
    <BottomTab />
    <GlobalSpeechToggle />
  </div>
</template>

<style scoped>
.app-layout__main {
  min-height: 100vh;
}

/* <1200px：底部 tabbar 占位（与 BottomTab 断点一致） */
@media (max-width: 1199.98px) {
  .app-layout__main {
    padding-bottom: var(--tabbar-height);
  }
}

/* 宽屏：左侧导航占位，随侧栏收放过渡（窄屏侧栏 display:none，不受折叠态影响） */
@media (min-width: 1200px) {
  .app-layout__main {
    margin-left: var(--sider-width);
    transition: margin-left 0.2s ease;
  }

  .app-layout--sider-collapsed .app-layout__main {
    margin-left: var(--sider-width-collapsed);
  }
}
</style>
