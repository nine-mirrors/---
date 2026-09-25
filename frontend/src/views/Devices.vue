<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { Component } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Cpu, Dish, Odometer, Watch } from '@element-plus/icons-vue'
import DemoBadge from '@/components/common/DemoBadge.vue'
import { DEVICES } from '@/constants/dict'
import { useDevicesStore } from '@/stores/devices'

const router = useRouter()
const devicesStore = useDevicesStore()

// 各设备对应的圆形图标（均为 @element-plus/icons-vue 已导出的图标）
// R2.3：4 设备，无 CGM
const DEVICE_ICONS: Record<string, Component> = {
  bp: Odometer,
  band: Watch,
  scale: Cpu,
  plate: Dish,
}

function goBack() {
  router.back()
}

// 开关与整行点击共用：切换后按最新状态弹提示
async function toggleDevice(device: (typeof DEVICES)[number]) {
  // 已连接 → 断开：先二次确认，避免长辈误触断掉自动同步；未连接 → 连接不拦截
  if (devicesStore.isConnected(device.key)) {
    try {
      await ElMessageBox.confirm('断开后健康数据就不能自动同步了，确定断开吗？', '断开设备', {
        confirmButtonText: '断开',
        cancelButtonText: '再想想',
        type: 'warning',
      })
    } catch {
      // 选择“再想想”或关闭弹窗：保持连接，不做切换
      return
    }
  }
  devicesStore.toggle(device.key)
  if (devicesStore.isConnected(device.key)) {
    ElMessage.success(`已连接 ${device.name}`)
  } else {
    ElMessage.info(`${device.name} 已断开，健康页暂不显示它的数据`)
  }
}
</script>

<template>
  <div class="page-container devices-page">
    <header class="devices-header">
      <el-button text class="devices-back" @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        <span>返回</span>
      </el-button>
      <div class="devices-heading">
        <h1 class="devices-title">我的设备</h1>
        <DemoBadge text="演示数据" />
      </div>
    </header>

    <p class="devices-tip">
      这里是演示版的设备连接状态。真正使用时，打开手机蓝牙和设备电源就能自动连上。
    </p>

    <ul class="device-list list-unstyled">
      <li
        v-for="device in DEVICES"
        :key="device.key"
        class="device-card nd-card"
        role="switch"
        tabindex="0"
        :aria-checked="devicesStore.isConnected(device.key)"
        @click="toggleDevice(device)"
        @keydown.enter.space.prevent="toggleDevice(device)"
      >
        <span class="device-icon">
          <el-icon :size="28"><component :is="DEVICE_ICONS[device.key]" /></el-icon>
        </span>

        <div class="device-info">
          <h2 class="device-name">{{ device.name }}</h2>
          <p class="device-desc">{{ device.desc }}</p>
          <p class="device-status" :class="{ 'is-on': devicesStore.isConnected(device.key) }">
            <span class="device-status-dot" aria-hidden="true"></span>
            {{ devicesStore.isConnected(device.key) ? '已连接' : '未连接' }}
          </p>
          <p v-if="device.key === 'plate'" class="device-note">
            连上后可以自动称出饭菜分量；演示版在拍照页手动选分量
          </p>
        </div>

        <!--
          a11y：li[role=switch] 是唯一键盘焦点（tabindex=0 / aria-checked /
          enter+space 已在 li 的 keydown 上 prevent 并切换）。内部真实 el-switch
          仅作视觉与状态镜像：tabindex=-1 移出 Tab 序列、aria-hidden 对读屏隐藏，
          避免同一状态两个焦点位；鼠标直接点它时 @change 仍切换，外层 @click.stop
          阻止冒泡到 li 造成重复 toggle。
        -->
        <span class="device-switch" @click.stop>
          <el-switch
            :model-value="devicesStore.isConnected(device.key)"
            size="large"
            tabindex="-1"
            aria-hidden="true"
            :aria-label="`${device.name}连接开关`"
            @change="toggleDevice(device)"
          />
        </span>
      </li>
    </ul>

    <p class="devices-foot">开关状态只保存在这台电脑上</p>
  </div>
</template>

<style scoped>
.devices-page {
  padding-top: var(--space-xl);
  padding-bottom: var(--space-xl);
}

.devices-header {
  margin-bottom: var(--space-lg);
}

.devices-back {
  min-height: var(--control-touch);
  margin-left: calc(var(--space-xs) * -1);
  font-size: var(--font-page-body);
}

.devices-heading {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-top: var(--space-sm);
}

.devices-title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: 700;
  line-height: 1.4;
}

.devices-tip {
  margin: 0 0 var(--space-xl);
  padding: var(--space-lg) var(--space-xl);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  color: var(--color-text-secondary);
  background-color: var(--color-bg-warm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.device-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-lg);
}

.device-card {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-xl);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.device-card:hover {
  border-color: var(--el-color-primary-light-7);
}

.device-icon {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  color: var(--color-text-inverse);
  background-color: var(--color-primary);
  border-radius: 50%;
}

.device-info {
  flex: 1;
  min-width: 0;
}

.device-name {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 700;
  line-height: 1.4;
}

.device-desc {
  margin: var(--space-xs) 0 0;
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.device-status {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: var(--space-sm) 0 0;
  font-size: 0.9rem;
  line-height: 1.4;
  color: var(--color-text-secondary);
}

.device-status.is-on {
  color: var(--color-success);
}

.device-status-dot {
  width: 8px;
  height: 8px;
  background-color: currentColor;
  border-radius: 50%;
}

.device-note {
  margin: var(--space-sm) 0 0;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.device-switch {
  flex: none;
  display: inline-flex;
  align-items: center;
  /* 开关自身处理切换，阻止冒泡到整行，避免重复 toggle */
}

.devices-foot {
  margin: var(--space-xl) 0 0;
  font-size: 0.85rem;
  text-align: center;
  color: var(--color-text-secondary);
}

@media (max-width: 767px) {
  .device-list {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
