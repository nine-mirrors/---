// 个人画像：问卷答案 + 慢病状态
// 持久化收口到 @/api：mock 模式写 ns 命名空间（按 uid 隔离），真实模式走 PUT /api/profile；
// R2.3：移除 t2dStatus/sweetFreq；renalKRestriction 三态；ensureLoaded() 供守卫调用

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { LS_KEYS } from '@/constants/dict'
import { nsRead } from '@/utils/storage'
import { getProfile, saveProfile } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { todayStr } from '@/utils/date'
import type { Profile } from '@/types'

function createDefaultProfile(): Profile {
  return {
    name: '',
    phone: '',
    age: null,
    gender: '',
    heightCm: null,
    weightKg: null,
    occupation: '',
    activity: 'low',
    dental: '好',
    taste: '一般',
    staplePref: '',
    eatOutFreq: '',
    smoke: '否',
    drink: '否',
    allergies: [],
    htnStatus: null,
    htnDetail: null,
    onboarded: false,
    onboardedAt: null,
    // R2.2：肾不好/需控钾三态，null=不清楚（默认）
    renalKRestriction: null,
    // 紧急联系人（急症时与 120 并列一键拨打），默认未设置
    emergencyContactName: '',
    emergencyContactPhone: '',
  }
}

// 默认结构与已存数据深合并（数组字段拷贝，undefined 字段回落默认值）
// 同时清洗旧数据：剥离 t2dStatus/sweetFreq 等 R1 遗留字段
function mergeProfile(saved: unknown): Profile {
  const defaults = createDefaultProfile()
  if (!saved || typeof saved !== 'object') return defaults
  const savedRec = saved as Record<string, unknown>
  const merged: Record<string, unknown> = { ...defaults }
  for (const key of Object.keys(defaults)) {
    const value = savedRec[key]
    if (value === undefined) continue
    const def = defaults[key as keyof Profile]
    if (Array.isArray(def)) {
      merged[key] = Array.isArray(value) ? [...(value as unknown[])] : [...(def as unknown[])]
    } else {
      merged[key] = value
    }
  }
  return merged as unknown as Profile
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

export const useProfileStore = defineStore('profile', () => {
  // 首帧仍同步读本地缓存（真实模式下仅作离线缓存），随后由 ensureLoaded 拉服务端画像
  const profile = ref<Profile>(mergeProfile(nsRead<Profile>(LS_KEYS.profile)))

  /** 已加载过画像的会话 uid：避免每次路由守卫都重复 GET；换账号登录后自动重拉 */
  let loadedUid: string | null = null

  async function persist(): Promise<void> {
    await saveProfile(profile.value)
  }

  // 体质指数：kg / m²，保留 1 位；身高体重缺失时为 null
  const bmi = computed(() => {
    const height = Number(profile.value.heightCm)
    const weight = Number(profile.value.weightKg)
    if (!height || !weight) return null
    return round1(weight / Math.pow(height / 100, 2))
  })

  // 每日蛋白质目标 g（体重 × 1.2），无体重时为 null
  const proteinTarget = computed(() => {
    const weight = Number(profile.value.weightKg)
    if (!weight) return null
    return round1(weight * 1.2)
  })

  const isOnboarded = computed(() => profile.value.onboarded === true)

  /**
   * 确保画像已加载：mock 读当前 uid 的 ns，真实模式 GET /api/profile；
   * 按 uid 缓存，换账号登录后首次守卫会重新拉取。供路由守卫调用。
   * 服务端画像同样过 mergeProfile，补默认值并清洗 R1 遗留字段。
   */
  async function ensureLoaded(): Promise<Profile> {
    const uid = useAuthStore().session?.uid ?? null
    if (loadedUid === uid) return profile.value
    const saved = await getProfile()
    if (saved) {
      profile.value = mergeProfile(saved)
    }
    loadedUid = uid
    return profile.value
  }

  async function updateProfile(patch: Partial<Profile> = {}): Promise<Profile> {
    profile.value = { ...profile.value, ...patch }
    await persist()
    return profile.value
  }

  async function completeOnboarding(data: Partial<Profile> = {}): Promise<Profile> {
    profile.value = {
      ...profile.value,
      ...data,
      onboarded: true,
      onboardedAt: todayStr(),
    }
    await persist()
    return profile.value
  }

  // 重新评估：清慢病结论但保留基础画像
  async function restartAssessment(): Promise<Profile> {
    profile.value.htnStatus = null
    profile.value.htnDetail = null
    profile.value.onboarded = false
    await persist()
    return profile.value
  }

  async function syncPhone(phone: string): Promise<Profile> {
    profile.value.phone = phone || ''
    await persist()
    return profile.value
  }

  return {
    profile,
    bmi,
    proteinTarget,
    isOnboarded,
    ensureLoaded,
    updateProfile,
    completeOnboarding,
    restartAssessment,
    syncPhone,
  }
})
