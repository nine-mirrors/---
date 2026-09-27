<script setup lang="ts">
/**
 * 全局拨号兜底：挂在 App 根部，全应用唯一一份。
 * - 手机端点拨号：dial() 唤起系统拨号盘，这里提示"再按一下拨号键"
 *   （网页无法自动拨出，系统安全限制）；
 * - 电脑/无电话能力设备：弹大字号码窗，可一键复制，杜绝"点了没反应"。
 */
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { closeDialPrompt, copyPhone, dialState } from '@/utils/dial'

const copied = ref(false)
const copyHint = ref('')

watch(
  () => dialState.prompt,
  (prompt) => {
    if (prompt) {
      copied.value = false
      copyHint.value = ''
    }
  },
)

// 手机端：拨号盘已被唤起（会盖住页面），用户取消后回到页面能看到提示
watch(
  () => dialState.launchedAt,
  (at) => {
    if (at > 0) {
      ElMessage({ message: '正在打开手机拨号盘，请再按一下屏幕上的拨号键', duration: 4000 })
    }
  },
)

async function doCopyNumber() {
  if (!dialState.prompt) return
  const ok = await copyPhone(dialState.prompt.phone)
  if (ok) {
    copied.value = true
    copyHint.value = ''
  } else {
    copyHint.value = '复制没成功，请照着上面的号码，在手机上手动输入拨打'
  }
}
</script>

<template>
  <teleport to="body">
    <div
      v-if="dialState.prompt"
      class="dial-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dial-modal-title"
      @click.self="closeDialPrompt"
    >
      <div class="dial-modal__card">
        <h2 id="dial-modal-title" class="dial-modal__title">这台设备不能直接打电话</h2>
        <p v-if="dialState.prompt.isEmergency120" class="dial-modal__lead">
          情况紧急！请立刻用<strong>手机拨打 120</strong> 急救电话
        </p>
        <p v-else class="dial-modal__lead">
          请用手机拨打紧急联系人<template v-if="dialState.prompt.name">
            「{{ dialState.prompt.name }}」</template
          >的电话
        </p>
        <p class="dial-modal__num">{{ dialState.prompt.phone }}</p>
        <p v-if="copyHint" class="dial-modal__copy-hint">{{ copyHint }}</p>
        <div class="dial-modal__actions">
          <button type="button" class="dial-modal__btn dial-modal__btn--copy" @click="doCopyNumber">
            {{ copied ? '号码已复制 ✓' : '复制号码' }}
          </button>
          <button
            type="button"
            class="dial-modal__btn dial-modal__btn--close"
            @click="closeDialPrompt"
          >
            我知道了
          </button>
        </div>
        <p class="dial-modal__tip">在手机上打开本应用、点这个拨号按钮，就会自动弹出手机拨号盘</p>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
/* 适老：大字号、56px 热区；z-index 高于 tabbar/悬浮球/业务弹层 */
.dial-modal {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
  background: rgba(0, 0, 0, 0.45);
}

.dial-modal__card {
  width: min(440px, 100%);
  padding: var(--space-lg) var(--space-md);
  text-align: center;
  background: #fffdf7;
  border-radius: var(--radius-lg, 16px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
}

.dial-modal__title {
  margin: 0 0 var(--space-sm);
  font-size: calc(var(--font-size-base) * 1.3);
  font-weight: 800;
  color: var(--color-text);
}

.dial-modal__lead {
  margin: 0 0 var(--space-md);
  font-size: calc(var(--font-size-base) * 1.15);
  font-weight: 600;
  line-height: 1.6;
  color: var(--color-text);
}

.dial-modal__lead strong {
  color: var(--color-danger-text);
}

.dial-modal__num {
  margin: 0 0 var(--space-md);
  padding: var(--space-sm) var(--space-md);
  font-size: calc(var(--font-size-base) * 2.2);
  font-weight: 800;
  letter-spacing: 0.08em;
  font-variant-numeric: tabular-nums;
  color: var(--color-danger-text);
  background: var(--color-danger-bg);
  border-radius: var(--radius-md);
}

.dial-modal__copy-hint {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-base);
  font-weight: 600;
  line-height: 1.5;
  color: var(--color-danger-text);
}

.dial-modal__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.dial-modal__btn {
  min-height: 56px;
  padding: 0 var(--space-lg);
  font-family: inherit;
  font-size: calc(var(--font-size-base) * 1.15);
  font-weight: 700;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.dial-modal__btn--copy {
  color: #fff;
  background: var(--color-primary);
  border: none;
}

.dial-modal__btn--copy:active {
  filter: brightness(0.92);
}

.dial-modal__btn--close {
  color: var(--color-text);
  background: #fff;
  border: 2px solid var(--color-border);
}

.dial-modal__tip {
  margin: var(--space-md) 0 0;
  font-size: var(--font-size-sm);
  line-height: 1.5;
  color: var(--color-text-secondary);
}
</style>
