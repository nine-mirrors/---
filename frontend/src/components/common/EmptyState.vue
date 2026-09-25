<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import {
  Bell,
  Bowl,
  Box,
  Camera,
  Connection,
  Document,
  Files,
  FirstAidKit,
  FolderOpened,
  Food,
  InfoFilled,
  Picture,
  Refresh,
  Search,
  Upload,
  Warning,
} from '@element-plus/icons-vue'

// 图标白名单：未命中时回退默认 Box
const ICON_MAP: Record<string, Component> = {
  Box,
  Picture,
  Search,
  Files,
  FolderOpened,
  Connection,
  Refresh,
  Bell,
  Food,
  Bowl,
  Camera,
  Upload,
  InfoFilled,
  Warning,
  Document,
  FirstAidKit,
}

const props = defineProps({
  icon: {
    type: String,
    default: 'Box',
  },
  title: {
    type: String,
    default: '',
  },
  desc: {
    type: String,
    default: '',
  },
  /** 存在时显示主色大按钮 */
  actionText: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['action'])

const iconComponent = computed(() => ICON_MAP[props.icon] || Box)

function handleAction() {
  emit('action')
}
</script>

<template>
  <div class="empty-state">
    <el-icon class="empty-state__icon" aria-hidden="true">
      <component :is="iconComponent" />
    </el-icon>
    <h3 v-if="title" class="empty-state__title">{{ title }}</h3>
    <p v-if="desc" class="empty-state__desc">{{ desc }}</p>
    <el-button v-if="actionText" type="primary" class="empty-state__action" @click="handleAction">
      {{ actionText }}
    </el-button>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  padding: var(--space-xl) var(--space-lg);
  text-align: center;
}

.empty-state__icon {
  font-size: 48px;
  color: var(--color-text-secondary);
}

.empty-state__title {
  margin: 0;
  font-size: calc(var(--font-size-base) * 1.1);
  font-weight: 600;
  color: var(--color-text);
}

.empty-state__desc {
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-base);
  color: var(--color-text-secondary);
}

.empty-state__action {
  min-height: 48px;
  margin-top: var(--space-sm);
  padding: 0 var(--space-xl);
  font-size: var(--font-size-base);
  border-radius: var(--radius-md);
}
</style>
