// 餐前状态：心率 + 情绪，经 ns* 命名空间持久化

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { LS_KEYS } from '@/constants/dict'
import { nsRead, nsWrite } from '@/utils/storage'

const DEFAULT_HEART_RATE = 78
const DEFAULT_MOOD = '平静'

interface PremealPersist {
  heartRate?: number
  mood?: string
}

function clampHeartRate(n: unknown): number {
  const v = Number(n)
  if (!Number.isFinite(v)) return DEFAULT_HEART_RATE
  return Math.min(150, Math.max(50, Math.round(v)))
}

export const usePremealStore = defineStore('premeal', () => {
  const saved = (nsRead<PremealPersist>(LS_KEYS.premeal) || {}) as PremealPersist

  const heartRate = ref(clampHeartRate(saved.heartRate ?? DEFAULT_HEART_RATE))
  const mood = ref(saved.mood || DEFAULT_MOOD)

  function persist(): void {
    nsWrite<PremealPersist>(LS_KEYS.premeal, { heartRate: heartRate.value, mood: mood.value })
  }

  function setHeartRate(n: unknown): void {
    heartRate.value = clampHeartRate(n)
    persist()
  }

  function setMood(m: string): void {
    mood.value = m
    persist()
  }

  function reset(): void {
    heartRate.value = DEFAULT_HEART_RATE
    mood.value = DEFAULT_MOOD
    persist()
  }

  return { heartRate, mood, setHeartRate, setMood, reset }
})
