<script setup lang="ts">
// 急诊面板：
//  1) 症状急症入口（不依赖血压值，常驻折叠条）：红旗症状 + tel:120 大按钮
//  2) 数值急诊条：当周出现 ≥180/120（含任一原始读数）时展示。
//     dismiss 态只记“已确认的最后一条急症记录标识”（记录 id；无 id 时 measuredAt+sys+dia），
//     经 nsRead/nsWrite 落业务键 ndh_emergency_dismissed_v1（自动带 uid）：
//     最新急症记录标识与已确认不同才显示红条；同一条已确认则跨天也不重弹。
//     仅最新一次读数分级为 normal 才允许“我已复测正常”关闭。
//  3) 两个入口都在 120 红钮下并列“紧急联系人”一键拨号（读 profile，未设置则引导去“我的”）

import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowDown, Phone } from '@element-plus/icons-vue'
import { nsRead, nsWrite } from '@/utils/storage'
import { isPhone } from '@/utils/account'
import { useProfileStore } from '@/stores/profile'
import { RED_FLAG_SYMPTOMS } from '@/constants/clinical'
import type { BpLevel } from '@/types'

const router = useRouter()
const profileStore = useProfileStore()

// 紧急联系人：在“我的”页设置；姓名+11 位手机号齐全才出现一键拨号
const emergencyContact = computed<{ name: string; phone: string } | null>(() => {
  const name = profileStore.profile.emergencyContactName?.trim() || ''
  const phone = profileStore.profile.emergencyContactPhone?.trim() || ''
  if (!isPhone(phone)) return null
  return { name: name || '紧急联系人', phone }
})

function goSetupContact() {
  router.push('/profile')
}

const props = withDefaults(
  defineProps<{
    /** 最新一条急症记录标识（id，或 measuredAt+sys+dia 拼接）；null 表示本周无数值急症 */
    emergencyKey?: string | null
    /** 最新一次读数的分级：仅 normal 时允许“我已复测正常”关闭 */
    latestLevel?: BpLevel | null
  }>(),
  { emergencyKey: null, latestLevel: null },
)

// —— 症状急症入口（常驻，默认折叠） ——
const symptomOpen = ref(false)

// —— 数值急诊条 ——
// 红旗症状勾选：仅作附加信息展示，不再 gating 120 按钮（120 无条件常显）
const redFlags = ref<string[]>([])
const hasRedFlag = computed(() => redFlags.value.length > 0)

const DISMISS_KEY = 'ndh_emergency_dismissed_v1'

// 已确认的最后一条急症记录标识（按 uid 隔离）
const dismissedKey = ref<string | null>(nsRead<string>(DISMISS_KEY))

// 最新急症记录标识与已确认不同（含更新的急症记录）才显示红条
const numericBarVisible = computed(
  () => !!props.emergencyKey && dismissedKey.value !== props.emergencyKey,
)

// 仅最新一次读数已回到 normal 才允许关闭；high 及以上不显示关闭钮，只保留复测引导
const canDismiss = computed(() => props.latestLevel === 'normal')

function dismissNumeric() {
  if (!canDismiss.value || !props.emergencyKey) return
  // dismiss 失败不阻断 UI（本次会话内仍关闭），仅留证
  try {
    nsWrite(DISMISS_KEY, props.emergencyKey)
  } catch (err) {
    console.warn('[emergency] 关闭状态未持久化', err)
  }
  dismissedKey.value = props.emergencyKey
}
</script>

<template>
  <section class="emergency-panel">
    <!-- 症状急症入口：不依赖血压值，常驻折叠 -->
    <div class="emergency-panel__symptom">
      <button
        type="button"
        class="emergency-panel__symptom-head"
        :aria-expanded="symptomOpen"
        @click="symptomOpen = !symptomOpen"
      >
        <span class="emergency-panel__symptom-title">突然胸痛、喘憋、一边无力……</span>
        <el-icon class="emergency-panel__chevron" :class="{ 'is-open': symptomOpen }">
          <ArrowDown />
        </el-icon>
      </button>

      <div v-if="symptomOpen" class="emergency-panel__symptom-body">
        <p class="emergency-panel__q">有下面任何一种情况，别等，先打 120</p>
        <ul class="emergency-panel__symptom-list">
          <li v-for="symptom in RED_FLAG_SYMPTOMS" :key="symptom.id">{{ symptom.label }}</li>
        </ul>
        <div class="emergency-panel__calls">
          <a class="emergency-panel__call" href="tel:120" aria-label="立即拨打 120 急救电话">
            <el-icon :size="26"><Phone /></el-icon>
            <span>立即拨打 120</span>
          </a>
          <!-- 已设置紧急联系人：与 120 并列的一键拨号（次级白底，不抢 120 主操作） -->
          <a
            v-if="emergencyContact"
            class="emergency-panel__call-contact"
            :href="`tel:${emergencyContact.phone}`"
            :aria-label="`拨打紧急联系人 ${emergencyContact.name} ${emergencyContact.phone}`"
          >
            <el-icon :size="24"><Phone /></el-icon>
            <span class="emergency-panel__call-contact-text">
              打给紧急联系人：{{ emergencyContact.name }}
              <small>{{ emergencyContact.phone }}</small>
            </span>
          </a>
          <!-- 未设置：引导去“我的”添加，不阻断 120 -->
          <button
            v-else
            type="button"
            class="emergency-panel__contact-setup"
            @click="goSetupContact"
          >
            还没设置紧急联系人？点这里去“我的”添加家人电话
          </button>
        </div>
        <p class="emergency-panel__warn">别自己开车去，让家人陪着或等救护车</p>
      </div>
    </div>

    <!-- 数值急诊条：本周出现过 ≥180/120（含任一原始读数），复测正常后可关闭 -->
    <div
      v-if="numericBarVisible"
      class="emergency-panel__numeric"
      role="alert"
      aria-live="assertive"
    >
      <div class="emergency-panel__numeric-head">
        <p class="emergency-panel__title">本周量到过 ≥180/120，要特别当心</p>
        <button
          v-if="canDismiss"
          type="button"
          class="emergency-panel__dismiss"
          @click="dismissNumeric"
        >
          我已复测正常
        </button>
      </div>

      <!-- 数值急症：120 红钮无条件常显（56px），不要求先勾选症状 -->
      <div class="emergency-panel__calls">
        <a class="emergency-panel__call" href="tel:120" aria-label="立即拨打 120 急救电话">
          <el-icon :size="26"><Phone /></el-icon>
          <span>立即拨打 120</span>
        </a>
        <a
          v-if="emergencyContact"
          class="emergency-panel__call-contact"
          :href="`tel:${emergencyContact.phone}`"
          :aria-label="`拨打紧急联系人 ${emergencyContact.name} ${emergencyContact.phone}`"
        >
          <el-icon :size="24"><Phone /></el-icon>
          <span class="emergency-panel__call-contact-text">
            打给紧急联系人：{{ emergencyContact.name }}
            <small>{{ emergencyContact.phone }}</small>
          </span>
        </a>
        <button v-else type="button" class="emergency-panel__contact-setup" @click="goSetupContact">
          还没设置紧急联系人？点这里去“我的”添加家人电话
        </button>
      </div>
      <p class="emergency-panel__warn">别自己开车去，让家人陪着或等救护车</p>

      <!-- 症状勾选仅作附加信息，方便家人/急救人员了解情况 -->
      <p class="emergency-panel__q emergency-panel__q--extra">现在有没有这些不舒服？有的话点一下</p>
      <el-checkbox-group v-model="redFlags" class="emergency-panel__flags">
        <el-checkbox
          v-for="symptom in RED_FLAG_SYMPTOMS"
          :key="symptom.id"
          :label="symptom.id"
          size="large"
        >
          {{ symptom.label }}
        </el-checkbox>
      </el-checkbox-group>
      <p v-if="hasRedFlag" class="emergency-panel__warn emergency-panel__warn--extra">
        已记下这些情况，打电话时一并告诉 120。
      </p>

      <!-- 无不适也必须复测：统一“安静休息 5 分钟”口径 -->
      <p class="emergency-panel__deep-text">
        没有不舒服也别大意，先安静休息 5 分钟再量一次。
        <br />
        还是这么高，就尽快联系医生或去急诊，<strong>别自己加药</strong>。
      </p>
    </div>
  </section>
</template>

<style scoped>
.emergency-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

/* —— 症状急症常驻折叠条 —— */
.emergency-panel__symptom {
  padding: var(--space-md);
  border: 1px solid color-mix(in srgb, var(--color-danger) 25%, #fffdf7);
  border-radius: var(--radius-md);
  background-color: var(--color-danger-bg);
}

.emergency-panel__symptom-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  width: 100%;
  min-height: 48px;
  padding: 0;
  font-family: inherit;
  font-size: var(--font-size-base);
  font-weight: 700;
  text-align: left;
  color: var(--color-danger-text);
  background: none;
  border: none;
  cursor: pointer;
}

.emergency-panel__symptom-title {
  flex: 1;
  line-height: 1.5;
}

.emergency-panel__chevron {
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.emergency-panel__chevron.is-open {
  transform: rotate(180deg);
}

.emergency-panel__symptom-body {
  margin-top: var(--space-md);
}

.emergency-panel__symptom-list {
  margin: 0 0 var(--space-md);
  padding-left: 1.4em;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  font-size: var(--font-size-base);
  line-height: 1.6;
  color: var(--color-text);
}

/* —— 数值急诊条 —— */
.emergency-panel__numeric {
  padding: var(--space-lg);
  border: 1px solid color-mix(in srgb, var(--color-danger) 25%, #fffdf7);
  border-radius: var(--radius-md);
  background-color: var(--color-danger-bg);
}

.emergency-panel__numeric-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.emergency-panel__title {
  margin: 0 0 var(--space-md);
  font-size: var(--font-size-base);
  font-weight: 700;
  color: var(--color-danger-text);
}

.emergency-panel__numeric-head .emergency-panel__title {
  margin-bottom: var(--space-md);
}

/* “我已复测正常”小按钮：点击区 ≥44px */
.emergency-panel__dismiss {
  flex-shrink: 0;
  min-height: 44px;
  padding: 0 var(--space-md);
  margin-bottom: var(--space-md);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  background-color: #fff;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.emergency-panel__dismiss:hover,
.emergency-panel__dismiss:focus-visible {
  color: var(--color-primary);
  border-color: var(--color-primary);
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.emergency-panel__q {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text);
}

.emergency-panel__q--extra {
  margin-top: var(--space-md);
}

.emergency-panel__flags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  margin-bottom: var(--space-sm);
}

.emergency-panel__flags :deep(.el-checkbox) {
  height: var(--control-touch);
  margin-right: 0;
  font-size: var(--font-size-base);
}

.emergency-panel__calls {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.emergency-panel__call {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  width: 100%;
  min-height: 56px;
  padding: 0 var(--space-xl);
  font-size: calc(var(--font-size-base) * 1.2);
  font-weight: 700;
  color: #fff;
  text-decoration: none;
  background-color: var(--color-danger);
  border-radius: var(--radius-md);
  transition: background-color 0.15s ease;
}

.emergency-panel__call:hover,
.emergency-panel__call:focus-visible {
  background-color: var(--color-danger-text);
  outline: 3px solid color-mix(in srgb, var(--color-danger) 30%, #ffffff);
  outline-offset: 2px;
}

/* 紧急联系人：白底红框次级按钮，视觉强度低于纯红 120，但同样 56px 大热区 */
.emergency-panel__call-contact {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  width: 100%;
  min-height: 56px;
  padding: 0 var(--space-xl);
  font-size: calc(var(--font-size-base) * 1.15);
  font-weight: 700;
  color: var(--color-danger-text);
  text-decoration: none;
  background-color: #fff;
  border: 2px solid var(--color-danger);
  border-radius: var(--radius-md);
  transition: background-color 0.15s ease;
}

.emergency-panel__call-contact:hover,
.emergency-panel__call-contact:focus-visible {
  background-color: var(--color-danger-bg);
  outline: 3px solid color-mix(in srgb, var(--color-danger) 30%, #ffffff);
  outline-offset: 2px;
}

.emergency-panel__call-contact-text {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  line-height: 1.3;
}

.emergency-panel__call-contact-text small {
  font-size: var(--font-size-sm);
  font-weight: 600;
  letter-spacing: 0.04em;
}

/* 未设置紧急联系人：文字引导钮，不与 120 争抢注意力 */
.emergency-panel__contact-setup {
  width: 100%;
  min-height: 44px;
  padding: 0 var(--space-md);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-danger-text);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.emergency-panel__contact-setup:hover,
.emergency-panel__contact-setup:focus-visible {
  background-color: color-mix(in srgb, var(--color-danger) 8%, #ffffff);
}

.emergency-panel__warn {
  margin: var(--space-sm) 0 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-danger-text);
}

.emergency-panel__warn--extra {
  margin-top: 0;
}

.emergency-panel__deep-text {
  margin: var(--space-md) 0 0;
  font-size: var(--font-size-base);
  line-height: 1.7;
  color: var(--color-warning-text);
}

.emergency-panel__deep-text strong {
  color: var(--color-warning-strong);
}
</style>
