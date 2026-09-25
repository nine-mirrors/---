<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { RefreshRight, SwitchButton } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useMealsStore } from '@/stores/meals'
import { usePremealStore } from '@/stores/premeal'
import { useProfileStore } from '@/stores/profile'
import { useBpLogStore } from '@/stores/bpLog'
import { useMedicationStore } from '@/stores/medication'
import { LS_KEYS } from '@/constants/dict'
import { nsRemove } from '@/utils/storage'
import { resetDeviceData } from '@/api'

const auth = useAuthStore()
const meals = useMealsStore()
const premeal = usePremealStore()
const profileStore = useProfileStore()
const bpLog = useBpLogStore()
const medication = useMedicationStore()

async function logout() {
  // 适老防误触：退出前必须二次确认
  try {
    await ElMessageBox.confirm(
      '退出后需要重新登录才能用；您填的个人画像仍留在本机，不会丢。确定退出吗？',
      '退出登录',
      {
        confirmButtonText: '确定退出',
        cancelButtonText: '再想想',
        type: 'warning',
      },
    )
  } catch {
    return
  }
  // 画像数据保留在本机，下次同手机号登录仍可看到
  await auth.logout()
  // store.logout 内部先做了一次 SPA 跳转；这里整页刷新到 /login，
  // 确保上个账号残留在内存里的 store 数据全部清掉
  window.location.assign('/login')
}

async function resetDemoData() {
  try {
    await ElMessageBox.confirm(
      '只会清空当前账号的拍照记录、模拟健康数据、手动血压和服药打卡，您填的个人画像会保留，其他账号数据不受影响。确定要重置吗？',
      '重置当前账号数据',
      {
        confirmButtonText: '确定重置',
        cancelButtonText: '再想想',
        type: 'warning',
      },
    )
  } catch {
    return
  }

  // 清当前账号命名空间：餐次、设备数据、餐前、血压、服药（留画像）
  // 注意：真实模式下这只清本机缓存，服务端数据的批量重置需后端另提供端点
  // （建议 DELETE /api/users/me/data，见 docs/api/_s02-business.md 交接说明）
  nsRemove(LS_KEYS.meals)
  nsRemove(LS_KEYS.deviceData)
  nsRemove(LS_KEYS.premeal)
  nsRemove(LS_KEYS.bpLog)
  nsRemove(LS_KEYS.meds)

  // 同步重置各 store 内存态
  meals.resetAllMeals()
  await resetDeviceData(profileStore.profile)
  premeal.reset()
  bpLog.records = []
  medication.records = []

  ElMessage.success('当前账号数据已重置')
}
</script>

<template>
  <section class="danger-zone">
    <h2 class="danger-zone__title">账号与数据</h2>
    <div class="danger-zone__actions">
      <el-button class="danger-zone__btn" size="large" :icon="SwitchButton" @click="logout">
        退出登录
      </el-button>
      <el-button
        class="danger-zone__btn danger-zone__btn--reset"
        size="large"
        :icon="RefreshRight"
        @click="resetDemoData"
      >
        重置当前账号数据
      </el-button>
    </div>
    <p class="danger-zone__note">
      退出登录不会删除本机的个人画像；重置只清当前账号的餐次、设备、血压和服药记录，其他账号数据不受影响。
    </p>
  </section>
</template>

<style scoped>
.danger-zone {
  padding: var(--space-lg);
  background-color: var(--color-bg-warm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.danger-zone__title {
  margin: 0 0 var(--space-md);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-text);
}

.danger-zone__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

/* Element Plus 对相邻 .el-button 默认加 margin-left:12px，
   竖排时会把第二个按钮顶出容器 12px，网格间距统一交给 gap */
.danger-zone__btn + .danger-zone__btn {
  margin-left: 0;
}

.danger-zone__btn {
  width: 100%;
  /* 允许按钮随网格列收缩，避免长文案在 320px 窄屏把列顶出内边距 */
  min-width: 0;
  min-height: 52px;
  padding-inline: 10px;
  font-size: 1rem;
  font-weight: 600;
  border-width: 2px;
  border-radius: var(--radius-md);
}

.danger-zone__btn :deep(span) {
  white-space: normal;
  line-height: 1.25;
}

.danger-zone__btn--reset {
  color: var(--color-danger);
  border-color: var(--color-danger);
  background-color: var(--color-bg-card);
}

.danger-zone__btn--reset:hover,
.danger-zone__btn--reset:focus {
  color: var(--color-danger);
  border-color: var(--color-danger);
  background-color: color-mix(in srgb, var(--color-danger) 8%, var(--color-bg-card));
}

.danger-zone__note {
  margin: var(--space-md) 0 0;
  font-size: 0.95rem;
  line-height: var(--line-height-base);
  color: var(--color-text-secondary);
}

@media (max-width: 768px) {
  .danger-zone__actions {
    grid-template-columns: 1fr;
  }
}
</style>
