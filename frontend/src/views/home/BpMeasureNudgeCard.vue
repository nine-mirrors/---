<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, Microphone, VideoPause } from '@element-plus/icons-vue'
import { useBpLogStore } from '@/stores/bpLog'
import { useProfileStore } from '@/stores/profile'
import { useSpeech, requestSpeak } from '@/composables/useSpeech'
import { todayStr } from '@/utils/date'

const router = useRouter()
const bpLogStore = useBpLogStore()
const profileStore = useProfileStore()
const { supported: speechSupported, speaking, speak, stop } = useSpeech()
const loaded = ref(false)

onMounted(async () => {
  // 加载今天的血压记录（区间仅今天）
  const today = todayStr()
  await bpLogStore.load({ from: today, to: today })
  loaded.value = true
})

const hasMorning = computed(() => {
  const today = todayStr()
  return bpLogStore.records.some((r) => r.date === today && r.period === 'morning')
})

const hasEvening = computed(() => {
  const today = todayStr()
  return bpLogStore.records.some((r) => r.date === today && r.period === 'evening')
})

// 只对高血压/风险人群显示：none 与未评估（null）都不显示
const targetUser = computed(() => {
  const status = profileStore.profile.htnStatus
  return status === 'confirmed' || status === 'mild_risk' || status === 'high_risk'
})

// 仅在对应测量时间窗催当时段：
// 5–10 点催晨测、18–22 点催晚测；不在窗口或当时段已测则整张卡不显示
const activeNudge = computed<{ key: 'morning' | 'evening'; text: string } | null>(() => {
  if (!loaded.value || !targetUser.value) return null
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 10 && !hasMorning.value) {
    return { key: 'morning', text: '早起后的血压还没记，坐下歇 5 分钟量一下吧' }
  }
  if (hour >= 18 && hour < 22 && !hasEvening.value) {
    return { key: 'evening', text: '睡前的血压还没记，洗漱后量一下吧' }
  }
  return null
})

const visible = computed(() => activeNudge.value !== null)

function goHealth() {
  // 直达健康页血压录入弹窗
  router.push({ path: '/health', query: { recordBp: '1' } })
}

// 朗读提醒：正在读→停止；未开语音开关→走统一引导（打开并朗读）
async function toggleReadAloud() {
  if (speaking.value) {
    stop()
    return
  }
  await requestSpeak({ supported: speechSupported, speaking, speak, stop }, activeNudge.value?.text)
}
</script>

<template>
  <section v-if="visible" class="bp-nudge" role="note" aria-label="血压测量提醒">
    <div class="bp-nudge__body">
      <el-icon class="bp-nudge__icon" aria-hidden="true"><Bell /></el-icon>
      <div class="bp-nudge__text">
        <p class="bp-nudge__label">血压测量提醒</p>
        <p class="bp-nudge__line">{{ activeNudge?.text }}</p>
      </div>
      <div class="bp-nudge__actions">
        <button
          type="button"
          class="bp-nudge__speak"
          :class="{ 'is-on': speaking }"
          :aria-label="speaking ? '停止朗读提醒' : '朗读这条提醒'"
          :title="speaking ? '停止朗读' : '朗读提醒'"
          @click="toggleReadAloud"
        >
          <el-icon aria-hidden="true">
            <VideoPause v-if="speaking" /><Microphone v-else />
          </el-icon>
          <span>{{ speaking ? '停止' : '朗读' }}</span>
        </button>
        <button type="button" class="bp-nudge__go" @click="goHealth">去量血压</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bp-nudge {
  margin-bottom: var(--space-lg);
  background-color: var(--color-warning-bg);
  border: 2px solid var(--color-warning);
  border-left: 8px solid var(--color-warning);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-base);
}

.bp-nudge__body {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
}

.bp-nudge__icon {
  flex-shrink: 0;
  font-size: 2.2rem;
  color: var(--color-warning-strong);
}

.bp-nudge__text {
  flex: 1;
  min-width: 0;
}

.bp-nudge__label {
  margin: 0 0 2px;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-warning-strong);
  letter-spacing: 0.02em;
}

.bp-nudge__line {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--color-warning-text);
  line-height: 1.5;
}

.bp-nudge__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-sm);
}

/* 朗读提醒：与 AI 气泡“朗读”同款图标语言，48px 热区 */
.bp-nudge__speak {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  min-height: 48px;
  padding: 0 var(--space-md);
  font-family: inherit;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-warning-text);
  background-color: var(--color-bg-card);
  border: 2px solid var(--color-warning);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.bp-nudge__speak:hover,
.bp-nudge__speak.is-on {
  color: #fff;
  background-color: var(--color-warning-strong);
  border-color: var(--color-warning-strong);
}

.bp-nudge__go {
  /* 全 App 主操作标准：56px 高 */
  flex-shrink: 0;
  min-height: 56px;
  padding: 0 var(--space-xl);
  font-family: inherit;
  font-size: 1.15rem;
  font-weight: 700;
  color: #fff;
  background-color: var(--color-warning-strong);
  border: none;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
}

.bp-nudge__go:hover {
  background-color: var(--color-warning-text);
}

/* 手机窄屏：图标与文字一行，按钮整排折到下一行并等宽，避免挤压大字 */
@media (max-width: 560px) {
  .bp-nudge__body {
    flex-wrap: wrap;
  }
  .bp-nudge__line {
    font-size: 1.15rem;
  }
  .bp-nudge__actions {
    width: 100%;
  }
  .bp-nudge__speak,
  .bp-nudge__go {
    flex: 1;
  }
}
</style>
