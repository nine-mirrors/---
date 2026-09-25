<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { EditPen } from '@element-plus/icons-vue'
import DemoCard from '@/components/common/DemoCard.vue'
import MoodIcon from '@/components/common/MoodIcon.vue'
import { useDevicesStore } from '@/stores/devices'
import { usePremealStore } from '@/stores/premeal'

const props = withDefaults(
  defineProps<{
    // 今日静息心率（设备数据 day.hr）
    hr?: number | null
    // 心率为手动录入：角标改“手动记录”
    manual?: boolean
  }>(),
  { hr: null, manual: false },
)

const emit = defineEmits<{
  // 点击“自己记一下”，Health.vue 统一打开录入弹窗
  manual: []
}>()

const router = useRouter()
const devices = useDevicesStore()
const premeal = usePremealStore()
const connected = computed(() => devices.isConnected('band'))

const hrValue = computed(() => (Number(props.hr) > 0 ? Number(props.hr) : null))
const hrFast = computed(() => hrValue.value !== null && hrValue.value > 100)
const hrOk = computed(() => hrValue.value !== null && hrValue.value >= 60 && hrValue.value <= 100)

const mood = computed(() => premeal.mood || '平静')

function goDevices() {
  router.push('/devices')
}
</script>

<template>
  <DemoCard
    title="心率和心情"
    subtitle="静息心率（手环或自己记）"
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
      <span class="metric__label">今日静息心率</span>
      <span class="metric__value" :class="{ 'is-success': hrOk, 'is-warning': hrFast }">
        {{ hrValue ?? '—' }}
      </span>
      <span class="metric__unit">次/分</span>
    </div>
    <p v-if="hrFast" class="hint hint--warning">有点快，注意休息，慢慢深呼吸几次</p>
    <p v-else-if="hrOk" class="hint hint--success">心率挺平稳的</p>

    <div class="mood">
      <span class="mood__emoji" aria-hidden="true">
        <MoodIcon :mood="mood" :size="32" />
      </span>
      <div class="mood__text">
        <p class="mood__label">今天餐前</p>
        <p class="mood__value">{{ mood }}</p>
      </div>
    </div>
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

.metric__value.is-success {
  color: var(--color-success);
}

.metric__value.is-warning {
  color: var(--color-warning-text);
}

.metric__unit {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.hint {
  margin: 0;
  font-size: var(--font-size-sm);
}

.hint--success {
  color: var(--color-success-text);
}

.hint--warning {
  color: var(--color-warning-text);
}

.mood {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-top: var(--space-sm);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
}

.mood__emoji {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  color: var(--color-primary);
}

.mood__text {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
}

.mood__label {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.mood__value {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text);
}
</style>
