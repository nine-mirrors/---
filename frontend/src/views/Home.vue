<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Bowl,
  Camera,
  Close,
  EditPen,
  Picture,
  RefreshLeft,
  RefreshRight,
} from '@element-plus/icons-vue'
import { recognizeImage } from '@/api'
import { isApiError } from '@/api/http'
import { nextScenario } from '@/mock/scenarios'
import { FOOD_MAP } from '@/mock/foods'
import { prepareMealImage } from '@/utils/image'
import { useMealsStore } from '@/stores/meals'
import { usePremealStore } from '@/stores/premeal'
import { useProfileStore } from '@/stores/profile'
import PremealCard from './home/PremealCard.vue'
import MealCameraDialog from './home/MealCameraDialog.vue'
import VoiceAskButton from './home/VoiceAskButton.vue'
import DashTodayCard from './home/DashTodayCard.vue'
import MedicationCard from './home/MedicationCard.vue'
import BpMeasureNudgeCard from './home/BpMeasureNudgeCard.vue'
import ManualMealSheet from './home/ManualMealSheet.vue'
import type { Food, HtnStatus, MealItem, RecognizedItem } from '@/types'

const router = useRouter()
const mealsStore = useMealsStore()
const premealStore = usePremealStore()
const profileStore = useProfileStore()

// 与 src/api 同一口径：VITE_USE_MOCK !== 'false' 即为 mock 演示模式
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

const albumInputRef = ref<HTMLInputElement | null>(null)

/* ---------------- 问候区 ---------------- */

const hour = new Date().getHours()
const period = hour < 11 ? '早上好' : hour < 18 ? '下午好' : '晚上好'
const displayName = computed(() => profileStore.profile.name?.trim() || '您好')

const BP_RISK_STATUS: HtnStatus[] = ['mild_risk', 'high_risk', 'confirmed']
const subGreeting = computed(() =>
  BP_RISK_STATUS.includes(profileStore.profile.htnStatus ?? 'none')
    ? '今天也记得留意血压，饭菜淡一点'
    : '今天也要好好吃饭呀',
)

/* ---------------- 拍照 / 相册 / 识别 ---------------- */

/** 识别确认区行模型：baseWeightG 为"标准份"基准，分量按系数实时换算 */
interface HomeItem {
  _uid: string
  id: string
  kind: string
  name?: string
  gi?: number | null
  confidence: number | null
  baseWeightG: number
  weightG: number
  portion: string
  manual: boolean
}

type RecogMode = 'idle' | 'photo'
type RecogError = { type: 'timeout' | 'unrecognized' } | null

const mode = ref<RecogMode>('idle')
const dialogVisible = ref(false)
const photo = ref<{ dataUrl: string } | null>(null)
const recognizing = ref(false)
const recognizedOnce = ref(false)
const recognizeError = ref<RecogError>(null)
const items = ref<HomeItem[]>([])
const lastBlob = ref<Blob | null>(null)

let itemSeq = 0
let recognizeToken = 0
let recognizeDelayTimer: ReturnType<typeof setTimeout> | null = null

function nextUid() {
  itemSeq += 1
  return `item_${Date.now()}_${itemSeq}`
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    recognizeDelayTimer = setTimeout(resolve, ms)
  })
}

onBeforeUnmount(() => {
  if (recognizeDelayTimer !== null) {
    clearTimeout(recognizeDelayTimer)
    recognizeDelayTimer = null
  }
})

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(blob)
  })
}

/** 调味品等 preset 食物：匹配最接近的份量档（识别给出 weightG 时），否则默认第一档 */
function presetPortion(
  foodId: string,
  weightG: number,
): { portion: string; weight: number } | null {
  const presets = FOOD_MAP[foodId]?.servingPresets
  if (!presets || !presets.length) return null
  if (weightG > 0) {
    let best = 0
    let diff = Infinity
    presets.forEach((p, i) => {
      const d = Math.abs(p.weightG - weightG)
      if (d < diff) {
        diff = d
        best = i
      }
    })
    return { portion: `preset-${best}`, weight: presets[best].weightG }
  }
  return { portion: 'preset-0', weight: presets[0].weightG }
}

// 识别结果 → 页面行模型
function toItem(detected: RecognizedItem): HomeItem {
  const detectedWeight = Number(detected.weightG) > 0 ? Math.round(Number(detected.weightG)) : 0
  const preset = presetPortion(detected.id, detectedWeight)
  if (preset) {
    return {
      _uid: nextUid(),
      id: detected.id,
      kind: detected.kind || 'food',
      name: detected.name,
      gi: detected.gi ?? null,
      confidence: typeof detected.confidence === 'number' ? detected.confidence : null,
      baseWeightG: preset.weight,
      weightG: preset.weight,
      portion: preset.portion,
      manual: false,
    }
  }
  const base = detectedWeight || 100
  return {
    _uid: nextUid(),
    id: detected.id,
    kind: detected.kind || 'food',
    name: detected.name,
    gi: detected.gi ?? null,
    confidence: typeof detected.confidence === 'number' ? detected.confidence : null,
    baseWeightG: base,
    weightG: base,
    portion: 'standard',
    manual: false,
  }
}

/**
 * 三级降级识别：
 * 1. 超时/网络 → "没连上，再试一次"，保留图片可重试
 * 2. 422 识别失败 → "这张没认出来，手动选一下也一样"，直接进确认区
 * 3. 404/未部署 → 仅开发环境且 mock 模式无缝走 mock 五场景；真实模式按错误提示处理
 */
async function runRecognize(blob: Blob) {
  const token = ++recognizeToken
  recognizing.value = true
  recognizeError.value = null
  const startedAt = Date.now()
  try {
    const scenario = await recognizeImage(blob)
    if (token !== recognizeToken) return
    // 人为最短等待只在 mock 演示模式保留，真实网络不人为延迟
    if (USE_MOCK) {
      const rest = 1500 - (Date.now() - startedAt)
      if (rest > 0) await delay(rest)
    }
    items.value = Array.isArray(scenario?.detected) ? scenario.detected.map(toItem) : []
    recognizedOnce.value = true
  } catch (err) {
    if (token !== recognizeToken) return
    if (isApiError(err) && err.code === 404 && import.meta.env.DEV && USE_MOCK) {
      // 仅开发环境 + mock 模式：后端未部署时无缝走 mock 五场景
      const mock = nextScenario()
      items.value = mock.detected.map(toItem)
      recognizedOnce.value = true
    } else if (isApiError(err) && err.code === 422) {
      // 识别失败：直接进确认区手动加菜
      recognizeError.value = { type: 'unrecognized' }
      items.value = []
      recognizedOnce.value = true
    } else {
      // 超时/网络：保留图片，提示重试
      recognizeError.value = { type: 'timeout' }
    }
  } finally {
    if (token === recognizeToken) recognizing.value = false
  }
}

// 取消识别：使当前请求结果失效
function cancelRecognize() {
  recognizeToken += 1
  recognizing.value = false
}

async function handleCaptured(payload: { dataUrl: string; file: File }) {
  dialogVisible.value = false
  try {
    const blob = await prepareMealImage(payload.file)
    const dataUrl = await blobToDataUrl(blob)
    photo.value = { dataUrl }
    mode.value = 'photo'
    items.value = []
    recognizedOnce.value = false
    recognizeError.value = null
    lastBlob.value = blob
    await runRecognize(blob)
  } catch {
    ElMessage.error('这张图片读不出来，换一张试试')
  }
}

function openAlbum() {
  albumInputRef.value?.click()
}

async function handleAlbumChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files && input.files[0]
  input.value = ''
  if (!file) return
  try {
    const blob = await prepareMealImage(file)
    const dataUrl = await blobToDataUrl(blob)
    photo.value = { dataUrl }
    mode.value = 'photo'
    items.value = []
    recognizedOnce.value = false
    recognizeError.value = null
    lastBlob.value = blob
    await runRecognize(blob)
  } catch {
    ElMessage.error('这张图片读不出来，换一张试试')
  }
}

function retake() {
  dialogVisible.value = true
}

function retryRecognize() {
  if (lastBlob.value) runRecognize(lastBlob.value)
}

/* ---------------- 手动记一餐 ---------------- */

// 手动记餐区在页面上常驻（默认就能看到、直接加菜）；
// 这个入口只负责把视线带到下方的记餐卡，不再做模式切换/清空
function openManual() {
  document
    .getElementById('manual-meal-card')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const recentFavorites = computed<MealItem[]>(() => mealsStore.recentFavorites())

function handleAddFavorite(item: MealItem) {
  const weight = Math.round(Number(item.weightG) || 100)
  // 调味品等 preset 食物：按保存过的克重反选最近档位，避免回到 100g 一份
  const preset = presetPortion(item.id, weight)
  items.value.push({
    _uid: nextUid(),
    id: item.id,
    kind: item.kind || 'food',
    name: item.name,
    gi: item.gi ?? null,
    confidence: null,
    baseWeightG: preset ? preset.weight : weight,
    weightG: preset ? preset.weight : weight,
    portion: preset ? preset.portion : 'standard',
    manual: true,
  })
  ElMessage.success(`已加入「${item.name || item.id}」`)
}

/* ---------------- 识别确认区交互 ---------------- */

const PORTION_FACTORS: Record<string, number> = { small: 0.7, standard: 1, large: 1.3 }

function handlePortion({
  uid,
  portion,
  weightG,
}: {
  uid: string
  portion: string
  weightG?: number
}) {
  const item = items.value.find((row) => row._uid === uid)
  if (!item) return
  // 调味品 preset 档：选中 weightG 直接用 preset 实际克数（1/5/10g、5/10/20ml），
  // 不再走 0.7/1/1.3 × 100g
  if (portion.startsWith('preset-')) {
    const w = Math.round(Number(weightG) || 0)
    if (!w) return
    item.portion = portion
    item.baseWeightG = w
    item.weightG = w
    return
  }
  if (!PORTION_FACTORS[portion]) return
  item.portion = portion
  item.weightG = Math.round(item.baseWeightG * PORTION_FACTORS[portion])
}

function handleRemove(uid: string) {
  items.value = items.value.filter((row) => row._uid !== uid)
}

function handleAddFood(food: Food) {
  // 调味品等不适合按 100g 一份录入的食物：默认第一档 preset（如盐 1 小撮 1g）
  const preset = food.servingPresets?.length ? food.servingPresets[0] : null
  const weightG = preset ? preset.weightG : 100
  items.value.push({
    _uid: nextUid(),
    id: food.id,
    kind: 'food',
    name: food.name,
    gi: food.gi ?? null,
    confidence: null,
    baseWeightG: weightG,
    weightG,
    portion: preset ? 'preset-0' : 'standard',
    manual: true,
  })
  ElMessage.success(`已加入「${food.name}」`)
}

/* ---------------- 提交待评估 ---------------- */

function handleSubmit() {
  if (recognizing.value) return
  // 空餐不再置灰按钮：给老人一句明确指引，而不是没反应
  if (!items.value.length) {
    ElMessage({
      message: '这餐还没有菜，先拍一张，或在下面手动加一道菜',
      duration: 5000,
    })
    return
  }
  mealsStore.setPending({
    items: items.value.map((item) => ({
      id: item.id,
      kind: item.kind,
      name: item.name,
      weightG: item.weightG,
      gi: item.gi,
      confidence: item.confidence,
    })),
    photo: photo.value?.dataUrl || null,
    premeal: {
      heartRate: premealStore.heartRate,
      mood: premealStore.mood,
    },
  })
  router.push('/result')
}
</script>

<template>
  <div class="page-container home-page">
    <header class="home-greet">
      <h1 class="home-greet__title">{{ period }}，{{ displayName }}</h1>
      <p class="home-greet__sub">{{ subGreeting }}</p>
    </header>

    <BpMeasureNudgeCard />

    <div class="home-grid">
      <div class="home-main">
        <!-- 主操作区 -->
        <section class="hero nd-card">
          <button type="button" class="hero__shoot" @click="dialogVisible = true">
            <el-icon class="hero__shoot-icon" aria-hidden="true"><Camera /></el-icon>
            <span>拍一拍今天的饭菜</span>
          </button>
          <div class="hero__row">
            <button type="button" class="hero__album" @click="openAlbum">
              <el-icon aria-hidden="true"><Picture /></el-icon>
              <span>或者从相册选一张</span>
            </button>
            <button type="button" class="hero__manual" @click="openManual">
              <el-icon aria-hidden="true"><EditPen /></el-icon>
              <span>不拍照，手动记一餐</span>
            </button>
          </div>
          <VoiceAskButton class="hero__voice" />
        </section>

        <!-- 拍照识别确认区 -->
        <section v-if="mode === 'photo' && (photo || recognizing)" class="recog nd-card">
          <div class="recog__head">
            <h2 class="recog__title">识别确认</h2>
            <button v-if="!recognizing" type="button" class="recog__retake" @click="retake">
              <el-icon aria-hidden="true"><RefreshLeft /></el-icon>
              <span>换一张</span>
            </button>
          </div>

          <div class="recog__preview-row">
            <img v-if="photo" :src="photo.dataUrl" alt="本次饭菜照片" class="recog__thumb" />
            <div v-if="recognizing" class="recog__loading">
              <el-icon class="recog__loading-icon" aria-hidden="true"><Bowl /></el-icon>
              <p class="recog__loading-text">正在看您今天的菜…</p>
              <el-skeleton :rows="3" animated class="recog__skeleton" />
              <button type="button" class="recog__cancel" @click="cancelRecognize">
                <el-icon aria-hidden="true"><Close /></el-icon>
                <span>取消</span>
              </button>
            </div>
            <p v-else-if="recognizedOnce && items.length" class="recog__status">
              认好了，在下面核对一下菜名和分量
            </p>
          </div>

          <template v-if="!recognizing">
            <div v-if="recognizeError?.type === 'unrecognized'" class="recog__failed">
              <p class="recog__failed-text">这张没认出来，在下面手动选一下也一样。</p>
            </div>
            <div v-else-if="recognizeError?.type === 'timeout'" class="recog__failed">
              <p class="recog__failed-text">没连上，再试一次。</p>
              <button type="button" class="recog__retry" @click="retryRecognize">
                <el-icon aria-hidden="true"><RefreshRight /></el-icon>
                <span>再试一次识别</span>
              </button>
            </div>
          </template>
        </section>

        <!-- 手动记一餐（常驻默认展示；拍照认出的菜也会汇集到这里核对） -->
        <section id="manual-meal-card" class="manual nd-card">
          <div class="manual__head">
            <h2 class="manual__title">这一餐的菜</h2>
            <p class="manual__sub">拍照认出的菜会出现在这里，也可以直接手动加菜</p>
          </div>
          <ManualMealSheet
            :items="items"
            :recent-favorites="recentFavorites"
            @portion="handlePortion"
            @remove="handleRemove"
            @add="handleAddFood"
            @add-favorite="handleAddFavorite"
          />
          <button type="button" class="recog__submit" :disabled="recognizing" @click="handleSubmit">
            看看这餐营养怎么样
          </button>
        </section>
      </div>

      <aside class="home-side">
        <PremealCard />
        <DashTodayCard />
        <MedicationCard />
      </aside>
    </div>

    <MealCameraDialog v-model="dialogVisible" @captured="handleCaptured" />
    <input
      ref="albumInputRef"
      type="file"
      accept="image/*"
      class="home-file"
      @change="handleAlbumChange"
    />
  </div>
</template>

<style scoped src="./Home.css"></style>
