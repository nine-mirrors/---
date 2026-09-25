<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { EditPen } from '@element-plus/icons-vue'
import DemoCard from '@/components/common/DemoCard.vue'
import { useDevicesStore } from '@/stores/devices'

const props = defineProps({
  // 昨夜睡眠：{ total: 小时, deepRatio: 0.15~0.25 的小数 }
  sleep: {
    type: Object,
    default: () => ({}),
  },
  // 睡眠为手动录入：角标改“手动记录”，无 deepRatio 时不展示深浅睡条
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

const total = computed(() => (Number(props.sleep?.total) > 0 ? Number(props.sleep.total) : null))
const deepPct = computed(() => {
  const ratio = Number(props.sleep?.deepRatio)
  if (!Number.isFinite(ratio) || ratio <= 0) return 0
  return Math.round(ratio * 100)
})
const lightPct = computed(() => Math.max(0, 100 - deepPct.value))
// 7.5h 左右（7~8.5h）视为合适
const good = computed(() => total.value !== null && total.value >= 7 && total.value <= 8.5)
// 手动只录了时长（deepRatio=0）时不展示深浅睡条与图例，改提示需要手环
const showDeepBar = computed(() => !(deepPct.value === 0 && props.manual))

function goDevices() {
  router.push('/devices')
}
</script>

<template>
  <DemoCard
    title="睡眠"
    subtitle="昨夜睡眠（手环或自己记）"
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
    <div class="metric">
      <span class="metric__label">昨夜睡眠</span>
      <span class="metric__value">{{ total ?? '—' }}</span>
      <span class="metric__unit">小时</span>
    </div>
    <p v-if="good" class="hint hint--success">这个时长挺合适，继续保持</p>
    <p v-else-if="total !== null" class="hint">昨晚睡得稍短，今晚可以早点休息</p>

    <template v-if="showDeepBar">
      <div class="bar" role="img" :aria-label="`深睡 ${deepPct}%，浅睡 ${lightPct}%`">
        <div class="bar__deep" :style="{ width: `${deepPct}%` }" />
        <div class="bar__light" :style="{ width: `${lightPct}%` }" />
      </div>
      <div class="legend">
        <span class="legend__item">
          <i class="legend__dot legend__dot--deep" aria-hidden="true" />
          <span class="legend__text">
            <span class="legend__pct">深睡 {{ deepPct }}%</span>
            <span class="legend__desc">深睡＝睡得最沉的那段时间</span>
          </span>
        </span>
        <span class="legend__item">
          <i class="legend__dot legend__dot--light" aria-hidden="true" />
          <span class="legend__text">
            <span class="legend__pct">浅睡 {{ lightPct }}%</span>
            <span class="legend__desc">浅睡＝睡得轻、容易醒的那段时间</span>
          </span>
        </span>
      </div>
    </template>
    <p v-else class="manual-note">深浅睡眠比例需要手环才能看到</p>
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

.manual-note {
  margin: var(--space-sm) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.metric {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
}

.metric__label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.metric__value {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-text);
}

.metric__unit {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.hint {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.hint--success {
  color: var(--color-success-text);
}

.bar {
  display: flex;
  width: 100%;
  height: 14px;
  margin-top: var(--space-sm);
  overflow: hidden;
  background-color: var(--color-bg-warm);
  border-radius: var(--radius-sm);
}

.bar__deep {
  height: 100%;
  background-color: var(--color-primary);
}

.bar__light {
  height: 100%;
  background-color: var(--el-color-primary-light-7);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm) var(--space-lg);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.legend__item {
  display: inline-flex;
  align-items: flex-start;
  gap: var(--space-xs);
}

.legend__text {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
}

.legend__desc {
  font-size: var(--font-size-xs);
  line-height: 1.3;
  color: var(--color-text-secondary);
}

.legend__dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-top: 5px;
  /* 圆角归系（原 3px 离系） */
  border-radius: var(--radius-sm);
}

.legend__dot--deep {
  background-color: var(--color-primary);
}

.legend__dot--light {
  background-color: var(--el-color-primary-light-7);
}
</style>
