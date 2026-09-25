<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CircleCheck, RefreshLeft } from '@element-plus/icons-vue'
import { useProfileStore } from '@/stores/profile'
import { useMedicationStore } from '@/stores/medication'
import { formatRelTime } from '@/utils/date'
import type { MedicationRecord } from '@/types'

const profileStore = useProfileStore()
const medicationStore = useMedicationStore()

// 显隐条件：确诊高血压 且 规律服药
const visible = computed(
  () =>
    profileStore.profile.htnStatus === 'confirmed' &&
    profileStore.profile.htnDetail?.medicated === true,
)

const taking = ref(false)
const undoing = ref(false)

onMounted(async () => {
  if (visible.value) {
    await medicationStore.load()
  }
})

const takenToday = computed(() => medicationStore.isTakenToday())
const todayRec = computed<MedicationRecord | null>(() => medicationStore.todayRecord())
const streak = computed(() => medicationStore.streakDays())

// 服药时间口语化：formatRelTime 需时段，按时段推断（早 <12 为早起后，否则睡前）
const takenTimeText = computed(() => {
  const rec = todayRec.value
  if (!rec) return ''
  const hour = new Date(rec.takenAt).getHours()
  const period = hour < 12 ? 'morning' : 'evening'
  const rel = formatRelTime(rec.takenAt, period)
  const hm = new Date(rec.takenAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${rel} ${hm}`
})

// 昨天是否断签：用于显示温和提示（不惩罚）
const missedYesterday = computed(() => {
  if (!medicationStore.records.length) return false
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const key = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
  return !medicationStore.records.some((r) => r.date === key)
})

async function handleCheckIn() {
  if (taking.value) return
  taking.value = true
  try {
    await medicationStore.takeMedication()
  } finally {
    taking.value = false
  }
}

async function handleUndo() {
  const rec = todayRec.value
  if (!rec || undoing.value) return
  undoing.value = true
  try {
    await medicationStore.undo(rec.id)
  } finally {
    undoing.value = false
  }
}
</script>

<template>
  <section v-if="visible" class="med-card nd-card" aria-label="规律服药打卡">
    <header class="med-card__head">
      <h2 class="med-card__title">今天吃过降压药了吗？</h2>
    </header>

    <!-- 未打卡 -->
    <button
      v-if="!takenToday"
      type="button"
      class="med-card__checkin"
      :disabled="taking"
      @click="handleCheckIn"
    >
      <el-icon aria-hidden="true"><CircleCheck /></el-icon>
      <span>{{ taking ? '正在记录…' : '吃过了，打卡' }}</span>
    </button>

    <!-- 已打卡 -->
    <div v-else class="med-card__done">
      <p class="med-card__done-time">
        <el-icon class="med-card__done-icon" aria-hidden="true"><CircleCheck /></el-icon>
        今天已服：{{ takenTimeText }}
      </p>
      <p class="med-card__streak">
        连续打卡 <strong>{{ streak }}</strong> 天
      </p>
      <button type="button" class="med-card__undo" :disabled="undoing" @click="handleUndo">
        <el-icon aria-hidden="true"><RefreshLeft /></el-icon>
        <span>{{ undoing ? '撤销中…' : '撤销今天打卡' }}</span>
      </button>
    </div>

    <p v-if="missedYesterday && !takenToday" class="med-card__miss">昨天没记，今天记上就好。</p>
    <p class="med-card__safety">忘了吃别自己补双倍，按大夫交代的来。</p>
  </section>
</template>

<style scoped>
.med-card {
  padding: var(--space-xl);
}

.med-card__head {
  margin-bottom: var(--space-lg);
}

.med-card__title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-text);
}

.med-card__checkin {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  width: 100%;
  min-height: 56px;
  font-family: inherit;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text-inverse);
  background-color: var(--color-primary);
  border: none;
  border-radius: 14px;
  box-shadow: 0 4px 14px rgba(14, 122, 95, 0.24);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.med-card__checkin:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
}

.med-card__checkin:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.med-card__done {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.med-card__done-time {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-success);
}

.med-card__done-icon {
  font-size: 1.4rem;
}

.med-card__streak {
  margin: 0;
  font-size: 1rem;
  color: var(--color-text-secondary);
}

.med-card__streak strong {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--color-primary-dark);
}

.med-card__undo {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  align-self: flex-start;
  min-height: 44px;
  padding: 0 var(--space-md);
  font-family: inherit;
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  background: none;
  border: none;
  cursor: pointer;
}

.med-card__undo:hover {
  color: var(--color-primary-dark);
}

.med-card__miss {
  margin: var(--space-md) 0 0;
  font-size: 0.95rem;
  color: var(--color-text-secondary);
}

.med-card__safety {
  margin: var(--space-md) 0 0;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}
</style>
