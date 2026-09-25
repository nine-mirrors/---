// 服药记录 store：打卡/撤销/近 7 天/按日期查询
// 所有持久化走 api 层（ns 命名空间），不直接写 localStorage

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { listMedications, createMedication, deleteMedication } from '@/api'
import { todayStr } from '@/utils/date'
import type { MedicationRecord } from '@/types'

export const useMedicationStore = defineStore('medication', () => {
  const records = ref<MedicationRecord[]>([])
  const loaded = ref(false)

  async function load(range: { from?: string; to?: string } = {}): Promise<void> {
    records.value = await listMedications(range)
    loaded.value = true
  }

  /** 今天是否已服药 */
  function isTakenToday(): boolean {
    const today = todayStr()
    return records.value.some((r) => r.date === today)
  }

  /** 今日服药记录 */
  function todayRecord(): MedicationRecord | null {
    const today = todayStr()
    return records.value.find((r) => r.date === today) || null
  }

  /** 连续打卡天数（从今天往前数，中断即停） */
  function streakDays(): number {
    if (!records.value.length) return 0
    const dateSet = new Set(records.value.map((r) => r.date))
    let streak = 0
    const now = new Date()
    for (let i = 0; i < 365; i += 1) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (dateSet.has(key)) {
        streak += 1
      } else {
        break
      }
    }
    return streak
  }

  /** 打卡服药 */
  async function takeMedication(name?: string): Promise<MedicationRecord> {
    const now = new Date()
    const record = await createMedication({
      date: todayStr(),
      takenAt: now.toISOString(),
      name,
    })
    records.value.unshift(record)
    return record
  }

  /** 撤销打卡 */
  async function undo(id: string): Promise<void> {
    await deleteMedication(id)
    records.value = records.value.filter((r) => r.id !== id)
  }

  return {
    records,
    loaded,
    load,
    isTakenToday,
    todayRecord,
    streakDays,
    takeMedication,
    undo,
  }
})
