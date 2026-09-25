<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { Document, FirstAidKit, RefreshLeft, Warning } from '@element-plus/icons-vue'
import { useProfileStore } from '@/stores/profile'
import {
  assessedDateText,
  htnConclusionText,
  htnConclusionTone,
  recordFiles,
} from './assessmentText'
import type { Profile } from '@/types'

const props = defineProps<{
  profile: Profile
}>()

const router = useRouter()
const profileStore = useProfileStore()

const conclusion = computed(() => htnConclusionText(props.profile))
const tone = computed(() => htnConclusionTone(props.profile.htnStatus))
const assessedDate = computed(() => assessedDateText(props.profile))
const files = computed(() => recordFiles(props.profile))
const hasRedFlags = computed(() => (props.profile.htnDetail?.redFlags?.length || 0) > 0)

async function restartAssessment() {
  try {
    await ElMessageBox.confirm('重新测评会更新现在的评估结果，其他记录不变', '重新进行健康测评', {
      confirmButtonText: '重新测评',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  // 即使保存失败也放行进入引导页，用户重填后会再次保存（mock 下不会失败）
  try {
    await profileStore.restartAssessment()
  } catch {
    /* 忽略保存失败，继续引导流程 */
  }
  router.push('/onboarding')
}
</script>

<template>
  <section class="nd-card assessment-card" :data-tone="tone">
    <header class="assessment-card__header">
      <span class="assessment-card__icon" aria-hidden="true">
        <el-icon><FirstAidKit /></el-icon>
      </span>
      <h2 class="assessment-card__title">健康评估</h2>
      <span v-if="assessedDate" class="assessment-card__date">评估时间：{{ assessedDate }}</span>
    </header>

    <p class="assessment-card__conclusion">{{ conclusion }}</p>

    <p v-if="hasRedFlags" class="assessment-card__redflag">
      <el-icon aria-hidden="true"><Warning /></el-icon>
      <span>您曾勾选过需要尽快就医的症状，请及时线下就诊</span>
    </p>

    <ul v-if="files.length" class="assessment-card__files">
      <li v-for="(name, index) in files" :key="`${name}-${index}`" class="assessment-card__file">
        <el-icon aria-hidden="true"><Document /></el-icon>
        <span>病历资料：{{ name }}（仅保存在本机）</span>
      </li>
    </ul>

    <el-button
      type="primary"
      plain
      class="assessment-card__action"
      :icon="RefreshLeft"
      @click="restartAssessment"
    >
      重新进行健康测评
    </el-button>
  </section>
</template>

<style scoped>
.assessment-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.assessment-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.assessment-card__icon {
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

.assessment-card__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-text);
}

.assessment-card__date {
  margin-left: auto;
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.assessment-card__conclusion {
  margin: 0;
  padding: var(--space-md) var(--space-lg);
  font-size: 1.05rem;
  line-height: var(--line-height-base);
  color: var(--color-text);
  background-color: var(--color-bg-warm);
  border-left: 4px solid var(--color-primary);
  border-radius: var(--radius-sm);
}

.assessment-card[data-tone='danger'] .assessment-card__conclusion {
  border-left-color: var(--color-danger);
}

.assessment-card[data-tone='warning'] .assessment-card__conclusion {
  border-left-color: var(--color-warning);
}

.assessment-card[data-tone='success'] .assessment-card__conclusion {
  border-left-color: var(--color-success);
}

.assessment-card__redflag {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  margin: 0;
  padding: var(--space-sm) var(--space-md);
  font-size: 0.95rem;
  line-height: var(--line-height-base);
  color: var(--color-danger);
  background-color: color-mix(in srgb, var(--color-danger) 8%, var(--color-bg-card));
  border-radius: var(--radius-sm);
}

.assessment-card__redflag .el-icon {
  flex-shrink: 0;
  margin-top: 4px;
  font-size: 1.1rem;
}

.assessment-card__files {
  margin: 0;
  padding: 0;
  list-style: none;
}

.assessment-card__file {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-sm) 0;
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  border-top: 1px dashed var(--color-border);
}

.assessment-card__file .el-icon {
  flex-shrink: 0;
  margin-top: 3px;
  color: var(--color-primary);
}

.assessment-card__action {
  width: 100%;
  min-height: 52px;
  margin-top: var(--space-xs);
  font-size: 1.05rem;
  font-weight: 600;
  border-width: 2px;
  border-radius: var(--radius-md);
}

@media (max-width: 768px) {
  .assessment-card__header {
    flex-wrap: wrap;
  }

  .assessment-card__date {
    /* 与标题左对齐：图标 40 + 间距 8 = 48；宽度须同步扣掉这 48，否则 100% + 48 会顶出容器 */
    flex-basis: calc(100% - 48px);
    margin-left: 48px;
    /* 基础样式是 nowrap，320px 下整串日期比剩余 215px 宽，允许自然换行而不是撑破容器 */
    white-space: normal;
  }
}
</style>
