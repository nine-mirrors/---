<script setup lang="ts">
import { computed } from 'vue'
import { Food, InfoFilled } from '@element-plus/icons-vue'
import {
  buildDashProgress,
  buildWeeklySaltSummary,
  computeTotals,
  RENAL_UNKNOWN_K_TEXT,
  type WeeklyDay,
  type WeeklyDimStatus,
} from '@/utils/nutrition'
import { buildLifestyleTips } from '@/utils/lifestyle'
import type { BpRecord, Profile } from '@/types'

type WeekDays = (WeeklyDay | null)[]

const props = withDefaults(
  defineProps<{
    days?: WeekDays
    profile?: Partial<Profile>
    /** 近 7 天血压记录：出现 ≥160/100 时限酒条加强 */
    bpRecords?: BpRecord[]
  }>(),
  { days: () => [], profile: () => ({}), bpRecords: () => [] },
)

interface DimStat {
  key: string
  label: string
  avgValue: number
  target: number
  status: WeeklyDimStatus
  text: string
}

// 把每天的 items 还原成一餐（buildDashProgress 按 items 算全天营养）
const dayProgressList = computed(() =>
  props.days
    .filter((d): d is WeeklyDay => d !== null)
    .map((day) => {
      const items = day.items || []
      const meal = {
        id: `wk_${day.date}`,
        dateTime: day.date,
        date: day.date,
        items,
      }
      return { date: day.date, items, progress: buildDashProgress([meal], props.profile) }
    }),
)

// 盐维度周聚合（纯函数）：没记调味品的日子占多数时给 neutral，不夸"5g 以内"
const saltSummary = computed(() =>
  buildWeeklySaltSummary(dayProgressList.value.map((d) => d.items)),
)

const RATED: WeeklyDimStatus[] = ['green', 'yellow', 'red']

const DIM_LABELS: Record<string, string> = {
  salt: '低盐',
  energy: '热量',
  veg: '蔬菜',
  fiber: '纤维',
  protein: '蛋白',
  k: '富钾',
}

// 六维周均
const dimStats = computed<DimStat[]>(() => {
  const keys = ['salt', 'energy', 'veg', 'fiber', 'protein', 'k'] as const
  return keys.map((key) => {
    const dims = dayProgressList.value
      .map((d) => d.progress.dimensions.find((dim) => dim.key === key))
      .filter((d): d is NonNullable<typeof d> => d !== undefined)

    if (!dims.length) {
      return {
        key,
        label: DIM_LABELS[key],
        avgValue: 0,
        target: 0,
        status: 'green',
        text: '本周还没有记录',
      }
    }

    const label = dims[0].label

    // 盐维度：交给 buildWeeklySaltSummary 统一口径（含"没记调料不夸绿"）
    if (key === 'salt') {
      const s = saltSummary.value
      return { key, label, avgValue: s.avgSaltG, target: 5, status: s.status, text: s.text }
    }

    const avgValue = Math.round((dims.reduce((s, d) => s + d.value, 0) / dims.length) * 10) / 10
    const target = dims[0].target

    // 控钾维度：任意一天 restricted 则整周 restricted（仅 renalKRestriction=true 会出现）
    const anyRestricted = dims.some((d) => d.status === 'restricted')
    if (anyRestricted) {
      return {
        key,
        label,
        avgValue,
        target,
        status: 'restricted',
        text: '按您的情况，富钾食物和低钠盐都要控制，具体请遵医嘱。',
      }
    }

    // 肾功能未知（null）：整周富钾维度中性，不评充足/不足
    const allNeutral = dims.every((d) => d.status === 'neutral')
    if (key === 'k' && allNeutral) {
      return { key, label, avgValue, target: 0, status: 'neutral', text: RENAL_UNKNOWN_K_TEXT }
    }

    // 常规聚合：只统计红黄绿日（neutral 不参与达标计数）
    const rated = dims.filter((d) => RATED.includes(d.status))
    const greens = rated.filter((d) => d.status === 'green').length
    const reds = rated.filter((d) => d.status === 'red').length
    const status: WeeklyDimStatus =
      rated.length === 0
        ? 'neutral'
        : reds > rated.length / 2
          ? 'red'
          : greens >= rated.length / 2
            ? 'green'
            : 'yellow'

    const textMap: Record<string, string> = {
      energy:
        status === 'green'
          ? '本周热量大多在预算内，继续七八分饱。'
          : '本周有几顿热量偏高，少口主食、少点油水，饭后散散步。',
      veg:
        status === 'green'
          ? '本周蔬菜大多吃够 500g，不错。'
          : '本周蔬菜还可以再多一些，每天一盘深色叶菜。',
      fiber:
        status === 'green'
          ? '本周膳食纤维基本够，杂粮蔬菜保持住。'
          : '本周纤维偏少，燕麦杂豆、豆类和带皮水果多吃点。',
      protein:
        status === 'green' ? '本周蛋白质基本达标。' : '本周蛋白质还差一点，每天加个蛋或一块豆腐。',
      k: status === 'green' ? '本周钾摄入基本充足。' : '本周富钾食物偏少，多吃菠菜、土豆、香蕉。',
    }

    return { key, label, avgValue, target, status, text: textMap[key] ?? '' }
  })
})

// 达标天数：低盐+热量+蔬菜+纤维+蛋白 五维都绿（富钾三态不计入；neutral/控钾均不算）
const qualifiedDays = computed(() => {
  let days = 0
  for (const day of dayProgressList.value) {
    const wanted = day.progress.dimensions.filter((d) =>
      ['salt', 'energy', 'veg', 'fiber', 'protein'].includes(d.key),
    )
    if (wanted.length === 5 && wanted.every((d) => d.status === 'green')) {
      days += 1
    }
  }
  return days
})

const totalDays = computed(() => dayProgressList.value.length || 7)

// 周脂肪命中（环外，不进六维评分）：统计命中天数与食材名
const fatWeekText = computed<string | null>(() => {
  let satDays = 0
  let cholDays = 0
  const satNames = new Set<string>()
  const cholNames = new Set<string>()
  for (const day of dayProgressList.value) {
    const t = computeTotals(day.items)
    if (t.highSatItems.length > 0) {
      satDays += 1
      t.highSatItems.forEach((n) => satNames.add(n))
    }
    if (t.cholItems.length > 0) {
      cholDays += 1
      t.cholItems.forEach((n) => cholNames.add(n))
    }
  }
  if (satDays === 0 && cholDays === 0) return null
  const parts: string[] = []
  if (satDays > 0) {
    parts.push(
      `本周有 ${satDays} 天吃了${[...satNames].join('、')}这类高脂食材，偶尔解馋、平时换鱼虾鸡胸豆腐`,
    )
  }
  if (cholDays > 0) {
    parts.push(`${[...cholNames].join('、')}偶尔少量吃就好，鸡蛋黄不用丢`)
  }
  return parts.join('；') + '。'
})

// 戒烟限酒周提醒（仅画像勾选项出现；近 7 天 ≥160/100 加强）
const lifestyleTips = computed(() => buildLifestyleTips(props.profile, props.bpRecords))
</script>

<template>
  <section class="dash-week">
    <header class="dash-week__head">
      <h2 class="dash-week__title">本周健康饮食达标</h2>
      <p class="dash-week__days">
        达标 <strong>{{ qualifiedDays }}</strong> / {{ totalDays }} 天
      </p>
    </header>

    <div class="dash-week__grid">
      <div
        v-for="dim in dimStats"
        :key="dim.key"
        class="dash-dim"
        :class="`dash-dim--${dim.status}`"
      >
        <p class="dash-dim__label">{{ dim.label }}</p>
        <p class="dash-dim__value">
          {{ dim.avgValue }}
          <span v-if="dim.key === 'salt'" class="dash-dim__unit">g 盐</span>
          <span v-else-if="dim.key === 'energy'" class="dash-dim__unit">千卡</span>
          <span v-else-if="dim.key === 'k'" class="dash-dim__unit">mg 钾</span>
          <span v-else class="dash-dim__unit">g</span>
        </p>
        <p v-if="dim.status === 'restricted'" class="dash-dim__target">遵医嘱</p>
        <p v-else-if="dim.key === 'k' && dim.status === 'neutral'" class="dash-dim__target">
          适量就好
        </p>
        <p v-else-if="dim.key === 'energy' && dim.status === 'neutral'" class="dash-dim__target">
          记录偏少
        </p>
        <p v-else class="dash-dim__target">
          目标 {{ dim.target }}<span v-if="dim.key === 'k'">mg</span
          ><span v-else-if="dim.key === 'energy'">千卡</span><span v-else>g</span>
        </p>
        <p class="dash-dim__text">{{ dim.text }}</p>
      </div>
    </div>

    <!-- 环外：高脂食材 + 戒烟限酒生活方式条（不进达标评分） -->
    <div v-if="fatWeekText || lifestyleTips.length" class="dash-week__lifestyle">
      <p v-if="fatWeekText" class="dash-week__fat">
        <el-icon aria-hidden="true"><Food /></el-icon>
        <span>{{ fatWeekText }}</span>
      </p>
      <ul v-if="lifestyleTips.length" class="dash-week__tips list-unstyled">
        <li
          v-for="tip in lifestyleTips"
          :key="tip.key"
          class="lifestyle-tip"
          :class="{ 'lifestyle-tip--urgent': tip.urgent }"
        >
          <p class="lifestyle-tip__title">
            <el-icon aria-hidden="true"><InfoFilled /></el-icon>
            {{ tip.title
            }}<span v-if="tip.urgent" class="lifestyle-tip__badge">血压不稳加强提醒</span>
          </p>
          <p class="lifestyle-tip__text">{{ tip.text }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.dash-week__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
  margin-bottom: var(--space-lg);
}

.dash-week__title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--color-text);
}

.dash-week__days {
  margin: 0;
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}

.dash-week__days strong {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-success);
}

.dash-week__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-md);
}

.dash-dim {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-md);
  background-color: var(--color-bg-card);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
}

.dash-dim--green {
  border-color: color-mix(in srgb, var(--color-success) 40%, var(--color-border));
}

.dash-dim--yellow {
  border-color: color-mix(in srgb, var(--color-warning) 40%, var(--color-border));
}

.dash-dim--red {
  border-color: color-mix(in srgb, var(--color-danger) 40%, var(--color-border));
}

.dash-dim--restricted,
.dash-dim--neutral {
  border-color: color-mix(in srgb, var(--color-text-secondary) 40%, var(--color-border));
}

.dash-dim__label {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.dash-dim__value {
  margin: 0;
  font-size: var(--font-size-2xl);
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-text);
}

.dash-dim__unit {
  margin-left: 2px;
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.dash-dim__target {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.dash-dim__text {
  margin: var(--space-xs) 0 0;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-base);
  color: var(--color-text-secondary);
}

.dash-week__lifestyle {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}

.dash-week__fat {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  margin: 0;
  padding: var(--space-md);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-base);
  color: var(--color-text-secondary);
  background-color: var(--color-bg-card);
  border: 2px solid color-mix(in srgb, var(--color-warning) 40%, var(--color-border));
  border-radius: var(--radius-md);
}

.dash-week__fat .el-icon {
  margin-top: 2px;
  flex-shrink: 0;
}

.dash-week__tips {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.lifestyle-tip {
  margin: 0;
  padding: var(--space-md);
  background-color: var(--color-bg-card);
  border: 2px solid var(--color-border);
  border-left-width: 5px;
  border-radius: var(--radius-md);
}

.lifestyle-tip--urgent {
  border-color: color-mix(in srgb, var(--color-warning) 40%, var(--color-border));
  border-left-color: var(--color-warning);
}

.lifestyle-tip__title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-xs);
  margin: 0 0 var(--space-xs);
  font-size: var(--font-size-base);
  font-weight: 700;
  color: var(--color-text);
}

.lifestyle-tip__badge {
  padding: 2px 8px;
  font-size: 0.75rem;
  font-weight: 500;
  color: #92400e;
  background-color: color-mix(in srgb, var(--color-warning) 18%, transparent);
  border-radius: 999px;
}

.lifestyle-tip__text {
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-base);
  color: var(--color-text-secondary);
}
</style>
