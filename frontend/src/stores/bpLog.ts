// 血压记录 store：多次读数均值、近 7 天记录、最近一条（供录入带出）
// 所有持久化走 api 层（ns 命名空间），不直接写 localStorage

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { listBpLogs, createBpLog, deleteBpLog } from '@/api'
import { recentDates } from '@/utils/date'
import { classifyBp } from '@/utils/nutrition'
import type { BpPeriod, BpReading, BpRecord, BpLevel } from '@/types'

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

// 多次读数取均值（sys/dia 分别平均，保留一位小数）
export function avgReadings(readings: BpReading[]): { sys: number; dia: number } {
  if (!readings.length) return { sys: 0, dia: 0 }
  const sys = readings.reduce((s, r) => s + r.sys, 0) / readings.length
  const dia = readings.reduce((s, r) => s + r.dia, 0) / readings.length
  return { sys: round1(sys), dia: round1(dia) }
}

// 分诊严重度排序（low/normal 同级，仅用于“取高者”）
const TRIAGE_RANK: Record<BpLevel, number> = {
  low: 0,
  normal: 0,
  high: 1,
  urgent: 2,
  emergency: 3,
}

/**
 * 家庭分诊：任一【原始读数】达阈值即升级，再与均值分级取高者。
 * 规范：任一原始读数 sys≥180 或 dia≥120 即 emergency；任一 ≥160/100 即 urgent。
 * 落库 sys/dia 仍取均值（周报统计口径），但急症提示不得被均值稀释。
 */
export function triageBpLevel(
  readings: BpReading[] | undefined,
  sys: number,
  dia: number,
): BpLevel {
  let level = classifyBp(sys, dia)
  for (const r of readings ?? []) {
    const rawLevel = classifyBp(r.sys, r.dia)
    if (TRIAGE_RANK[rawLevel] > TRIAGE_RANK[level]) level = rawLevel
  }
  return level
}

export const useBpLogStore = defineStore('bpLog', () => {
  const records = ref<BpRecord[]>([])
  const loaded = ref(false)

  async function load(range: { from?: string; to?: string } = {}): Promise<void> {
    records.value = await listBpLogs(range)
    loaded.value = true
  }

  /** 近 7 天记录 */
  async function recordsOfLast7(): Promise<BpRecord[]> {
    const dates = recentDates(7)
    const from = dates[0]
    const to = dates[dates.length - 1]
    const list = await listBpLogs({ from, to })
    records.value = list
    return list
  }

  /** 最近一条记录（供录入带出默认值） */
  function lastRecord(): BpRecord | null {
    if (!records.value.length) return null
    return records.value[0]
  }

  /**
   * 新增血压记录（弹窗唯一入口，不再绕过 store 直调 api）
   * @param readings 1~3 次原始读数；落库 sys/dia 取均值
   * @param arm 臂别 / pulseRegular 脉搏是否整齐 / symptoms 症状备注（均选填）
   */
  async function addRecord(params: {
    measuredAt: string
    date: string
    period: BpPeriod
    readings: BpReading[]
    hr?: number | null
    source?: 'manual' | 'device'
    arm?: 'left' | 'right' | null
    pulseRegular?: boolean | null
    symptoms?: string
  }): Promise<BpRecord> {
    const { sys, dia } = avgReadings(params.readings)
    const record = await createBpLog({
      measuredAt: params.measuredAt,
      date: params.date,
      period: params.period,
      sys,
      dia,
      hr: params.hr ?? null,
      source: params.source ?? 'manual',
      readings: params.readings,
      ...(params.arm ? { arm: params.arm } : {}),
      ...(params.pulseRegular !== undefined && params.pulseRegular !== null
        ? { pulseRegular: params.pulseRegular }
        : {}),
      ...(params.symptoms ? { symptoms: params.symptoms } : {}),
    })
    records.value.unshift(record)
    return record
  }

  async function removeRecord(id: string): Promise<void> {
    await deleteBpLog(id)
    records.value = records.value.filter((r) => r.id !== id)
  }

  return {
    records,
    loaded,
    load,
    recordsOfLast7,
    lastRecord,
    addRecord,
    removeRecord,
  }
})
