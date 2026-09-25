<script setup lang="ts">
import { computed } from 'vue'

type ScoreKey = 'insufficient' | 'excess' | 'diversity'
type ToneKey = 'green' | 'yellow' | 'red'
type DietScores = Record<ScoreKey, number>

const props = withDefaults(
  defineProps<{
    /** buildWeekly 的 dietScores：{ insufficient, excess, diversity } */
    scores?: DietScores
  }>(),
  { scores: () => ({ insufficient: 0, excess: 0, diversity: 0 }) },
)

// buildWeekly 未提供逐维解释文案，这里按分档口语化生成
const EXPLAINERS: Record<ScoreKey, Record<ToneKey, string>> = {
  insufficient: {
    green: '蛋白质和蔬菜都跟得上，达标餐也多，继续每餐配一手掌鱼虾蛋肉。',
    yellow: '蛋白质或蔬菜还差一点，加个蛋、喝杯奶，多半盘青菜就能追上来。',
    red: '这周蛋白和蔬菜明显没吃够，每天奶蛋豆制品别少，午晚餐各来一盘菜。',
  },
  excess: {
    green: '咸淡合适、主食也没过量，继续少油少盐，少碰腌菜和浓酱汁。',
    yellow: '偶尔有几顿偏咸或主食偏多，炒菜再少放一勺盐会更稳。',
    red: '这周重口饭、精米白面偏多，下周减盐减酱，白米饭换成杂粮饭。',
  },
  diversity: {
    green: '食材种类挺丰富，鸡鸭鱼豆和各色蔬菜都换着吃到了。',
    yellow: '花样还能再多些，每周争取吃够 6 大类食材。',
    red: '吃来吃去就那几样，多换鱼虾、豆制品、菌菇和不同颜色的菜。',
  },
}

function levelOf(score: number): ToneKey {
  if (score >= 80) return 'green'
  if (score >= 60) return 'yellow'
  return 'red'
}

function toScore(value: unknown): number {
  return Math.min(100, Math.max(0, Math.round(Number(value) || 0)))
}

const cards = computed(() => {
  const defs: { key: ScoreKey; title: string; tag: string }[] = [
    { key: 'insufficient', title: '吃得够不够', tag: '摄入不足' },
    { key: 'excess', title: '有没有过量', tag: '过量' },
    { key: 'diversity', title: '花样多不多', tag: '多样性' },
  ]
  return defs.map((def) => {
    const score = toScore(props.scores[def.key])
    const level = levelOf(score)
    return {
      ...def,
      score,
      level,
      text: EXPLAINERS[def.key][level],
    }
  })
})
</script>

<template>
  <section class="diet-panel">
    <h2 class="diet-panel__title">三个维度看一看</h2>
    <div class="diet-panel__grid">
      <article v-for="card in cards" :key="card.key" class="diet-card nd-card">
        <h3 class="diet-card__title">
          {{ card.title }}
          <span class="diet-card__tag">（{{ card.tag }}）</span>
        </h3>
        <p class="diet-card__score" :class="`is-${card.level}`">
          {{ card.score }}<span class="diet-card__unit">%</span>
        </p>
        <p class="diet-card__text">{{ card.text }}</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.diet-panel__title {
  margin: 0 0 var(--space-lg);
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text);
}

.diet-panel__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-lg);
}

.diet-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.diet-card__title {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text);
}

.diet-card__tag {
  font-size: var(--font-size-sm);
  font-weight: 400;
  color: var(--color-text-secondary);
}

.diet-card__score {
  margin: 0;
  font-size: 2.75rem;
  font-weight: 700;
  line-height: 1.1;
}

.diet-card__unit {
  margin-left: 2px;
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.diet-card__text {
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-base);
  color: var(--color-text-secondary);
}

.is-green {
  color: var(--color-success);
}

.is-yellow {
  color: var(--color-warning-text);
}

.is-red {
  color: var(--color-danger);
}
</style>
