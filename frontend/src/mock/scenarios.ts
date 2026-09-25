// 拍照识别 Mock 场景：5 个预置识别结果
// R2.3：五场景钠梯度（场景1 最咸 → 场景5 最清淡），用于评分与规则演示
// gi 一律从 FOOD_MAP 同步取，避免两处维护；游标首次随机、之后顺序循环

import type { RecognizeScenario, RecognizedItem } from '@/types'
import { FOOD_MAP } from '@/mock/foods'

const RAW_SCENARIOS: RecognizeScenario[] = [
  {
    // 场景1：最咸——白米饭 + 番茄炒蛋 + 腌芥菜（高钠警示）
    id: 'scenario_1',
    label: '白米饭 + 番茄炒蛋 + 腌芥菜',
    detected: [
      { kind: 'food', id: '012401x', name: '白米饭', confidence: 0.96, weightG: 200 },
      { kind: 'dish', id: 'tomato_egg', name: '番茄炒蛋', confidence: 0.88, weightG: 150 },
      { kind: 'food', id: 'pickled_mustard', name: '腌芥菜(咸菜)', confidence: 0.82, weightG: 50 },
    ],
  },
  {
    // 场景2：偏咸——米饭 + 土豆炖牛肉
    id: 'scenario_2',
    label: '米饭 + 土豆炖牛肉',
    detected: [
      { kind: 'food', id: '012401x', name: '米饭', confidence: 0.92, weightG: 200 },
      { kind: 'dish', id: 'potato_beef', name: '土豆炖牛肉', confidence: 0.86, weightG: 200 },
    ],
  },
  {
    // 场景3：中等——白粥 + 馒头 + 煮鸡蛋
    id: 'scenario_3',
    label: '白粥 + 馒头 + 煮鸡蛋',
    detected: [
      { kind: 'food', id: '012404', name: '白粥', confidence: 0.9, weightG: 250 },
      { kind: 'food', id: '011404x', name: '馒头', confidence: 0.93, weightG: 100 },
      { kind: 'food', id: '111204', name: '煮鸡蛋', confidence: 0.95, weightG: 50 },
    ],
  },
  {
    // 场景4：较清淡——米饭 + 清蒸鲈鱼 + 白灼油菜
    id: 'scenario_4',
    label: '米饭 + 清蒸鲈鱼 + 白灼油菜',
    detected: [
      { kind: 'food', id: '012401x', name: '米饭', confidence: 0.9, weightG: 150 },
      { kind: 'dish', id: 'steamed_bass', name: '清蒸鲈鱼', confidence: 0.9, weightG: 120 },
      { kind: 'dish', id: 'boiled_greens', name: '白灼油菜', confidence: 0.87, weightG: 150 },
    ],
  },
  {
    // 场景5：最清淡 DASH——燕麦饭 + 西兰花炒虾仁 + 清炒菠菜
    id: 'scenario_5',
    label: '燕麦饭 + 西兰花炒虾仁 + 清炒菠菜',
    detected: [
      { kind: 'food', id: '019012', name: '燕麦饭', confidence: 0.91, weightG: 150 },
      { kind: 'dish', id: 'broccoli_shrimp', name: '西兰花炒虾仁', confidence: 0.9, weightG: 150 },
      { kind: 'dish', id: 'spinach_stir', name: '清炒菠菜', confidence: 0.88, weightG: 150 },
    ],
  },
]

// 识别条目补齐 gi 字段后的类型（gi 由 null | number 变为必有）
type ScenarioItemWithGi = RecognizedItem & { gi: number | null }

// 补齐 gi 字段
export const SCENARIOS = RAW_SCENARIOS.map((scenario) => ({
  ...scenario,
  detected: scenario.detected.map((item): ScenarioItemWithGi => ({
    ...item,
    gi: FOOD_MAP[item.id] ? FOOD_MAP[item.id].gi : null,
  })),
}))

let scenarioCursor: number | null = null

function cloneDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

// 首次随机取 0..4，之后 (cursor + 1) % 5；返回深拷贝避免调用方污染原始数据
export function nextScenario(): RecognizeScenario {
  if (scenarioCursor === null) {
    scenarioCursor = Math.floor(Math.random() * SCENARIOS.length)
  } else {
    scenarioCursor = (scenarioCursor + 1) % SCENARIOS.length
  }
  return cloneDeep(SCENARIOS[scenarioCursor])
}

// 测试/重置用
export function resetScenarioCursor(): void {
  scenarioCursor = null
}
