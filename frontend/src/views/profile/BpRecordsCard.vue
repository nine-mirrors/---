<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Histogram } from '@element-plus/icons-vue'
import { useBpLogStore } from '@/stores/bpLog'
import { useRouter } from 'vue-router'
import { formatRelTime } from '@/utils/date'
import type { BpPeriod, BpRecord } from '@/types'

const bpLog = useBpLogStore()
const router = useRouter()

const loading = ref(false)
const deletingId = ref<string | null>(null)

// 时段中文映射
function periodLabel(period: BpPeriod): string {
  return period === 'morning' ? '早起后' : '睡前'
}

onMounted(async () => {
  loading.value = true
  try {
    await bpLog.recordsOfLast7()
  } finally {
    loading.value = false
  }
})

// 最近记录（store 已按 measuredAt 倒序）
const records = computed<BpRecord[]>(() => bpLog.records)

// 读数明细：若有多次读数，展示各次与均值
function readingsText(record: BpRecord): string {
  const readings = record.readings ?? []
  if (readings.length <= 1) {
    return `${record.sys} / ${record.dia}`
  }
  const parts = readings.map((r) => `${r.sys}/${r.dia}`)
  return `${parts.join('、')} → 均值 ${record.sys}/${record.dia}`
}

async function handleDelete(record: BpRecord) {
  try {
    await ElMessageBox.confirm(
      `确定删除这条 ${formatRelTime(record.measuredAt, record.period)} 的血压记录吗？`,
      '删除血压记录',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }
  deletingId.value = record.id
  try {
    await bpLog.removeRecord(record.id)
    ElMessage.success('已删除')
  } catch {
    ElMessage.error('删除失败，请重试')
  } finally {
    deletingId.value = null
  }
}

function goHealth() {
  router.push('/health')
}
</script>

<template>
  <section class="nd-card bp-records-card">
    <header class="bp-records-card__header">
      <span class="bp-records-card__icon" aria-hidden="true">
        <el-icon><Histogram /></el-icon>
      </span>
      <h2 class="bp-records-card__title">最近血压记录</h2>
    </header>

    <div v-if="loading" class="bp-records-card__loading">加载中…</div>

    <ul v-else-if="records.length" class="bp-list">
      <li v-for="record in records" :key="record.id" class="bp-list__item">
        <div class="bp-list__main">
          <p class="bp-list__time">
            {{ formatRelTime(record.measuredAt, record.period) }}
            <span class="bp-list__period">（{{ periodLabel(record.period) }}）</span>
          </p>
          <p class="bp-list__reading">
            <span class="bp-list__num">{{ record.sys }}</span>
            <span class="bp-list__slash">/</span>
            <span class="bp-list__num">{{ record.dia }}</span>
            <span class="bp-list__unit">mmHg</span>
          </p>
          <p v-if="record.hr != null" class="bp-list__hr">心率 {{ record.hr }} 次/分</p>
          <p v-if="(record.readings?.length ?? 0) > 1" class="bp-list__detail">
            共 {{ record.readings?.length }} 次：{{ readingsText(record) }}
          </p>
          <p class="bp-list__source">
            {{ record.source === 'device' ? '设备同步' : '手动记录' }}
          </p>
        </div>
        <button
          type="button"
          class="bp-list__delete"
          :aria-label="`删除这条血压记录`"
          :disabled="deletingId === record.id"
          @click="handleDelete(record)"
        >
          <el-icon aria-hidden="true"><Delete /></el-icon>
        </button>
      </li>
    </ul>

    <div v-else class="bp-empty">
      <p class="bp-empty__text">还没有手动血压记录</p>
      <p class="bp-empty__hint">去健康页记一下，每天早晚各一次更准。</p>
      <el-button type="primary" plain class="bp-empty__btn" size="large" @click="goHealth">
        去记血压
      </el-button>
    </div>
  </section>
</template>

<style scoped>
.bp-records-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.bp-records-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.bp-records-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  font-size: 1.35rem;
  color: var(--color-primary);
  background-color: color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-card));
  border-radius: 50%;
}

.bp-records-card__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-text);
}

.bp-records-card__loading {
  padding: var(--space-lg) 0;
  font-size: 1rem;
  color: var(--color-text-secondary);
  text-align: center;
}

.bp-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.bp-list__item {
  display: flex;
  gap: var(--space-md);
  align-items: flex-start;
  padding: var(--space-md) 0;
  border-bottom: 1px solid var(--color-border);
}

.bp-list__item:last-child {
  border-bottom: none;
}

.bp-list__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.bp-list__time {
  margin: 0;
  font-size: 0.95rem;
  color: var(--color-text-secondary);
}

.bp-list__period {
  color: var(--color-text-secondary);
}

.bp-list__reading {
  display: flex;
  align-items: baseline;
  gap: 2px;
  margin: var(--space-xs) 0 0;
}

.bp-list__num {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-text);
}

.bp-list__slash {
  font-size: 1.2rem;
  color: var(--color-text-secondary);
}

.bp-list__unit {
  margin-left: 4px;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.bp-list__hr {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.bp-list__detail {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.bp-list__source {
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.bp-list__delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  font-size: 1.1rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 50%;
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
}

.bp-list__delete:hover:not(:disabled) {
  color: var(--color-danger);
  background-color: color-mix(in srgb, var(--color-danger) 8%, var(--color-bg-card));
}

.bp-list__delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xl) var(--space-md);
  text-align: center;
}

.bp-empty__text {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-text);
}

.bp-empty__hint {
  margin: 0;
  font-size: 0.95rem;
  line-height: var(--line-height-base);
  color: var(--color-text-secondary);
}

.bp-empty__btn {
  margin-top: var(--space-sm);
  min-height: 48px;
  font-size: 1rem;
  font-weight: 600;
  border-width: 2px;
  border-radius: var(--radius-md);
}
</style>
