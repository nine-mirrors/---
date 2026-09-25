<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { EditPen } from '@element-plus/icons-vue'
import DemoCard from '@/components/common/DemoCard.vue'
import { useDevicesStore } from '@/stores/devices'
import { STEPS_GOAL } from '@/constants/dict'

const props = defineProps({
  // 今日步数（day.steps）
  steps: {
    type: Number,
    default: null,
  },
  // 步数为手动录入：角标改“手动记录”
  manual: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<{
  // 点击“自己记一下”，Health.vue 统一打开录入弹窗
  (e: 'manual'): void
}>()

const router = useRouter()
const devices = useDevicesStore()
const connected = computed(() => devices.isConnected('band'))

const GOAL = STEPS_GOAL // 6000

const stepsValue = computed(() => (Number(props.steps) >= 0 ? Number(props.steps) : null))
const progress = computed(() => {
  if (stepsValue.value === null) return 0
  return Math.min(1, stepsValue.value / GOAL)
})

const status = computed(() => {
  const v = stepsValue.value
  if (v === null) return { level: 'default', text: '今天还没有步数数据' }
  if (v >= GOAL) return { level: 'success', text: '达标啦，继续保持' }
  if (v >= 4000) return { level: 'warning', text: '再多走一走' }
  return { level: 'default', text: '饭后散步 15 分钟吧' }
})

// SVG 圆环参数（viewBox 140 × 140）
const RADIUS = 58
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const dashOffset = computed(() => CIRCUMFERENCE * (1 - progress.value))

function goDevices() {
  router.push('/devices')
}
</script>

<template>
  <DemoCard
    title="步数"
    subtitle="今日步数（手环或自己记）"
    :badge-text="manual ? '手动记录' : '演示数据'"
    :disconnected="!connected"
    @click="goDevices"
  >
    <template #footer>
      <el-button text type="primary" class="manual-btn" @click.stop="emit('manual')">
        <el-icon class="manual-btn__icon" aria-hidden="true"><EditPen /></el-icon>
        自己记一下
      </el-button>
    </template>
    <div class="ring">
      <svg class="ring__svg" viewBox="0 0 140 140" role="img" aria-label="今日步数完成进度">
        <circle class="ring__track" cx="70" cy="70" :r="RADIUS" />
        <circle
          class="ring__progress"
          cx="70"
          cy="70"
          :r="RADIUS"
          :stroke-dasharray="CIRCUMFERENCE"
          :stroke-dashoffset="dashOffset"
        />
        <text x="70" y="66" text-anchor="middle" class="ring__num">
          {{ stepsValue ?? '—' }}
        </text>
        <text x="70" y="88" text-anchor="middle" class="ring__unit">步</text>
      </svg>
    </div>
    <p class="ring__goal">目标 {{ GOAL }} 步</p>
    <p class="hint" :class="`hint--${status.level}`">{{ status.text }}</p>
  </DemoCard>
</template>

<style scoped>
.manual-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  min-height: var(--control-touch);
  padding: 0 var(--space-xs);
  font-size: var(--font-size-base);
}

.manual-btn__icon {
  font-size: 1.1rem;
}

.ring {
  display: flex;
  justify-content: center;
}

.ring__svg {
  /* 随视口/根字号缩放：320px 小屏约 122px，大屏上限 160px（原为固定 150px 物理 px） */
  width: clamp(120px, 38vw, 160px);
  height: clamp(120px, 38vw, 160px);
}

.ring__track,
.ring__progress {
  fill: none;
  stroke-width: 10;
}

.ring__track {
  stroke: var(--color-bg-warm);
}

.ring__progress {
  stroke: var(--color-primary);
  stroke-linecap: round;
  transform: rotate(-90deg);
  transform-origin: 70px 70px;
  transition: stroke-dashoffset 0.4s ease;
}

.ring__num {
  /* rem 随根字号适老缩放（原物理 24px，1rem=20px 下即 1.2rem）；
     SVG 内文字同样吃 CSS rem，viewBox 坐标不变故定位不受影响 */
  font-size: 1.2rem;
  font-weight: 700;
  fill: var(--color-text);
}

.ring__unit {
  /* 对齐 CHART_FONT.small（0.66rem ≈ 13px） */
  font-size: 0.66rem;
  fill: var(--color-text-secondary);
}

.ring__goal {
  margin: 0;
  font-size: var(--font-size-sm);
  text-align: center;
  color: var(--color-text-secondary);
}

.hint {
  margin: 0;
  font-size: var(--font-size-base);
  text-align: center;
  color: var(--color-text-secondary);
}

.hint--success {
  color: var(--color-success);
  font-weight: 600;
}

.hint--warning {
  color: var(--color-warning-text);
  font-weight: 600;
}

/* 桌面一屏仪表盘（见 Health.vue）：footer 不再独占剩余空间，
   让步数圆环 .ring 弹性吃掉卡片剩余高度 */
@media (min-width: 1200px) and (min-height: 700px) {
  :deep(.demo-card__footer) {
    margin-top: 0;
    padding-top: 0;
  }
}
</style>
