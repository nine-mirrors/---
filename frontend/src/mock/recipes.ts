// 12 道适老家常食谱：仅清蒸/清炒/凉拌/白灼/炖/煮，每餐盐 ≤2g
// R2.3：标签从 RECIPE_TAGS 六标签（低钠/高钾/高蛋白/易咀嚼/健康推荐）中选取，每道不超过 3 个
// 营养数值来源《中国食物成分表（标准版）》：食材 foodCode 对齐该表，
// 由 utils/totals.computeTotals 按配料克数运行时核算，不手工编造
// image 为本地成品示意图（public/recipes，已去除生成水印），加载失败时 UI 兜底隐藏

import type { Recipe } from '@/types'
import { computeTotals } from '@/utils/totals'

type RawRecipe = Omit<Recipe, 'nutrients'>

const RAW_RECIPES: RawRecipe[] = [
  {
    id: 'oat_rice',
    name: '燕麦杂粮饭',
    image: '/recipes/oat_rice.jpg',
    tags: ['健康推荐', '易咀嚼'],
    yieldG: 250,
    ingredients: [
      { id: '019012', name: '燕麦（整粒煮）', grams: 180 },
      { id: '021205', name: '红薯', grams: 70 },
    ],
    steps: [
      '整粒燕麦提前用清水浸泡 2 小时，红薯去皮切小块',
      '燕麦和红薯一起放入电饭煲，加水没过约一指节',
      '按煮饭键煮好后再焖 10 分钟，拌匀即可',
    ],
  },
  {
    id: 'steamed_bass_dish',
    name: '清蒸鲈鱼',
    image: '/recipes/steamed_bass_dish.jpg',
    tags: ['高蛋白', '低钠'],
    yieldG: 200,
    ingredients: [
      { id: '121226', name: '鲈鱼', grams: 190 },
      { id: 'oil', name: '烹调油', grams: 6 },
      { id: 'salt', name: '食盐', grams: 1 },
    ],
    steps: [
      '鲈鱼处理干净，两面划刀，用不到 1g 盐轻抹腌 5 分钟',
      '盘底垫葱段，鱼身放几片姜，水开后上锅蒸 8 分钟',
      '倒掉盘中腥水，淋少许热油，加一勺低盐酱油调味即可',
    ],
  },
  {
    id: 'broccoli_shrimp_dish',
    name: '西兰花炒虾仁',
    image: '/recipes/broccoli_shrimp_dish.jpg',
    tags: ['高蛋白', '高钾'],
    yieldG: 220,
    ingredients: [
      { id: '045217', name: '西兰花', grams: 140 },
      { id: '122204', name: '虾仁', grams: 70 },
      { id: 'oil', name: '烹调油', grams: 8 },
      { id: 'salt', name: '食盐', grams: 1 },
    ],
    steps: [
      '西兰花掰小朵，开水焯 1 分钟捞出；虾仁用料酒去腥',
      '锅中少油，先下虾仁炒至变色',
      '倒入西兰花大火快炒 2 分钟，加盐调味出锅',
    ],
  },
  {
    id: 'mushroom_chicken',
    name: '香菇滑鸡',
    image: '/recipes/mushroom_chicken.jpg',
    tags: ['高蛋白', '易咀嚼'],
    yieldG: 220,
    ingredients: [
      { id: '091101x', name: '鸡肉', grams: 140 },
      { id: '051019', name: '香菇(鲜)', grams: 70 },
      { id: 'oil', name: '烹调油', grams: 6 },
      { id: 'salt', name: '食盐', grams: 1.5 },
    ],
    steps: [
      '鸡腿肉去骨切薄片，鲜香菇切片',
      '鸡肉加少许淀粉抓匀，静置 10 分钟更嫩滑',
      '与香菇一起平铺盘中，水开后蒸 15 分钟',
      '出锅淋少量热油和低盐酱油，肉质软烂好嚼',
    ],
  },
  {
    id: 'tomato_egg_dish',
    name: '番茄炒蛋',
    image: '/recipes/tomato_egg_dish.jpg',
    tags: ['高蛋白', '易咀嚼'],
    yieldG: 200,
    ingredients: [
      { id: '043119', name: '番茄', grams: 120 },
      { id: '111204', name: '鸡蛋(煮)', grams: 70 },
      { id: 'oil', name: '烹调油', grams: 8 },
      { id: 'salt', name: '食盐', grams: 1.5 },
    ],
    steps: [
      '番茄切块，鸡蛋打散',
      '锅中少油先炒鸡蛋，凝固后盛出',
      '另起锅炒番茄出汁，倒回鸡蛋翻匀，加盐即可',
    ],
  },
  {
    id: 'spinach_tofu_soup',
    name: '菠菜豆腐汤',
    image: '/recipes/spinach_tofu_soup.jpg',
    tags: ['低钠', '高钾', '易咀嚼'],
    yieldG: 300,
    ingredients: [
      { id: '045301', name: '菠菜', grams: 80 },
      { id: '031301x', name: '豆腐', grams: 120 },
      { id: 'oil', name: '烹调油', grams: 3 },
      { id: 'salt', name: '食盐', grams: 1.5 },
    ],
    steps: [
      '菠菜焯水去草酸后切段，嫩豆腐切小块',
      '锅中加水烧开，放豆腐煮 3 分钟',
      '下菠菜煮 1 分钟，淋少许油，加盐调味',
    ],
  },
  {
    id: 'celery_agaric',
    name: '芹菜拌木耳',
    image: '/recipes/celery_agaric.jpg',
    tags: ['低钠', '高钾'],
    yieldG: 180,
    ingredients: [
      { id: '045331', name: '芹菜', grams: 120 },
      { id: '051014', name: '木耳(水发)', grams: 55 },
      { id: 'oil', name: '烹调油', grams: 4 },
      { id: 'salt', name: '食盐', grams: 1 },
    ],
    steps: [
      '木耳提前泡发，开水焯 2 分钟',
      '芹菜去叶切段，焯水 1 分钟捞出过凉',
      '加少许盐、醋和几滴香油拌匀即可',
    ],
  },
  {
    id: 'garlic_eggplant',
    name: '蒜蓉蒸茄子',
    image: '/recipes/garlic_eggplant.jpg',
    tags: ['低钠', '易咀嚼'],
    yieldG: 200,
    ingredients: [
      { id: '043101x', name: '茄子', grams: 190 },
      { id: 'oil', name: '烹调油', grams: 7 },
      { id: 'salt', name: '食盐', grams: 1.5 },
    ],
    steps: [
      '茄子切长条上锅蒸 15 分钟至软烂',
      '蒜末用少量温油激香，加一点低盐酱油调成汁',
      '把汁淋在茄子上，吃前拌匀，软嫩不费牙',
    ],
  },
  {
    id: 'waxgourd_shrimp_soup',
    name: '冬瓜虾仁汤',
    image: '/recipes/waxgourd_shrimp_soup.jpg',
    tags: ['低钠', '高蛋白'],
    yieldG: 300,
    ingredients: [
      { id: '043221', name: '冬瓜', grams: 200 },
      { id: '122204', name: '虾仁', grams: 70 },
      { id: 'oil', name: '烹调油', grams: 3 },
      { id: 'salt', name: '食盐', grams: 1.5 },
    ],
    steps: [
      '冬瓜去皮切薄片，虾仁洗净',
      '水烧开下冬瓜煮至透明，约 8 分钟',
      '放虾仁煮 2 分钟变红，淋少许油，加盐出锅',
    ],
  },
  {
    id: 'milk_oat_porridge',
    name: '牛奶燕麦粥',
    image: '/recipes/milk_oat_porridge.jpg',
    tags: ['健康推荐', '易咀嚼', '高蛋白'],
    yieldG: 300,
    ingredients: [
      { id: '019012', name: '燕麦（整粒煮）', grams: 60 },
      { id: '101101x', name: '牛奶', grams: 240 },
    ],
    steps: [
      '燕麦加少量水煮 10 分钟至软烂',
      '倒入牛奶搅匀，小火再煮 3 分钟',
      '不用加糖，牛奶本身有淡淡奶香',
    ],
  },
  {
    id: 'cold_chicken',
    name: '凉拌鸡丝',
    image: '/recipes/cold_chicken.jpg',
    tags: ['高蛋白', '低钠'],
    yieldG: 180,
    ingredients: [
      { id: '091101x', name: '鸡肉', grams: 110 },
      { id: '045331', name: '芹菜', grams: 50 },
      { id: '051014', name: '木耳(水发)', grams: 25 },
      { id: 'oil', name: '烹调油', grams: 4 },
      { id: 'salt', name: '食盐', grams: 1 },
    ],
    steps: [
      '鸡胸肉冷水下锅煮 15 分钟，捞出放凉撕成细丝',
      '芹菜段和木耳分别焯水，过凉沥干',
      '与鸡丝一起加少许盐、醋和香油拌匀',
    ],
  },
  {
    id: 'boiled_greens_dish',
    name: '白灼油菜',
    image: '/recipes/boiled_greens_dish.jpg',
    tags: ['低钠', '高钾'],
    yieldG: 200,
    ingredients: [
      { id: '045125', name: '油菜', grams: 190 },
      { id: 'oil', name: '烹调油', grams: 7 },
      { id: 'salt', name: '食盐', grams: 1.5 },
    ],
    steps: [
      '油菜洗净，开水里加几滴油和小半勺盐',
      '菜下锅焯 1 分钟捞出装盘',
      '淋一勺低盐酱油和少量热油，清淡爽口',
    ],
  },
]

// 运行时计算营养并导出，避免手工另造一份营养数据
export const RECIPES: Recipe[] = RAW_RECIPES.map((recipe) => ({
  ...recipe,
  nutrients: computeTotals(recipe.ingredients.map((ing) => ({ id: ing.id, weightG: ing.grams }))),
}))
