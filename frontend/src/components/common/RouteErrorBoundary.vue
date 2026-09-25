<script setup lang="ts">
// 路由级渲染兜底：子页面在 setup/render 阶段抛错时（如旧数据字段缺失），
// 不再留下白屏或半残页面（用户会描述成“点不开”），改为可一键刷新的中文兜底卡。
import { onErrorCaptured, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { RefreshRight, WarningFilled } from '@element-plus/icons-vue'

const route = useRoute()
const failed = ref(false)

onErrorCaptured((error) => {
  console.error('[route] 页面渲染失败:', error)
  failed.value = true
  // 阻止继续冒泡：兜底卡已承接提示，不再弹全局 ElMessage 惊扰

  return false
})

// 切到别的路由后恢复渲染（错误页只影响当前路由）
watch(
  () => route.fullPath,
  () => {
    failed.value = false
  },
)

function reload() {
  window.location.reload()
}
</script>

<template>
  <div v-if="failed" class="route-error page-container" role="alert">
    <div class="route-error__card nd-card">
      <el-icon class="route-error__icon" aria-hidden="true"><WarningFilled /></el-icon>
      <h1 class="route-error__title">这个页面没能打开</h1>
      <p class="route-error__text">
        可能是本机保存的旧数据与新版本不太兼容，刷新一下通常就好；刷新后仍打不开，可以重新登录再试。
      </p>
      <button type="button" class="route-error__btn" @click="reload">
        <el-icon aria-hidden="true"><RefreshRight /></el-icon>
        <span>刷新页面</span>
      </button>
    </div>
  </div>
  <slot v-else />
</template>

<style scoped>
.route-error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.route-error__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  max-width: 480px;
  padding: var(--space-xl);
  text-align: center;
}

.route-error__icon {
  font-size: 2.6rem;
  color: var(--color-warning-text);
}

.route-error__title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--color-text);
}

.route-error__text {
  margin: 0;
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  color: var(--color-text-secondary);
}

.route-error__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  min-height: 56px;
  margin-top: var(--space-sm);
  padding: 0 var(--space-xl);
  font-family: inherit;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text-inverse);
  background-color: var(--color-primary);
  border: none;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-primary);
  cursor: pointer;
}

.route-error__btn:hover {
  background-color: var(--color-primary-dark);
}
</style>
