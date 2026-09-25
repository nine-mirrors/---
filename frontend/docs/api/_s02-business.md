# 接口契约分册 S02：业务数据（营养与血压）

> 适用：营养膳食助手前端 ↔ FastAPI 后端（R2.3）
> 本文件与 `src/api/index.ts`、`src/api/http.ts`、`src/types/index.ts`、`src/stores/*` 逐字段对齐。
> **字段以 `src/types/index.ts` 为唯一事实来源**；本文档如与代码不一致，以代码为准并回改文档。

## 1. 通用约定

### 1.1 鉴权

- **所有** `/api/*` 端点（含 `/api/recognize`）均需 `Authorization: Bearer <token>`；
  `/api/auth/*` 的 401 表示账密/验证码错误（业务错误），其他端点的 401 表示会话过期（前端清会话跳登录）。
- token 取自会话键 `ndh_auth_v1`，由 `api/http.ts` 请求拦截器自动注入。

### 1.2 数据包装与错误体

- **无统一 envelope**：HTTP 200 时响应体就是业务 JSON 本身（数组/对象/布尔），前端拦截器直接返回裸数据。
- 非 2xx 返回错误体：

  ```json
  { "code": "VALIDATION_FAILED", "message": "中文错误提示" }
  ```

  - `code`：业务码字符串；缺失时前端回落为 HTTP 状态数字码（如 422），网络错误为 `NETWORK_ERROR`。
  - `message`：可直接展示给用户的中文文案。

- 前端统一由 `ApiError(code, message)` 承载（`src/api/http.ts`）。

### 1.3 区间查询参数

血压、服药、设备数据、餐次列表支持 `{from, to}` 闭区间（ISO 日期 `YYYY-MM-DD`）：

```
GET /api/bp-logs?from=2026-09-01&to=2026-09-07
```

- 缺省 `from` 不设下限；缺省 `to` 不设上限。
- mock 模式按 `date` 字段字符串比较过滤。

### 1.4 血压口径

- **家庭自测**阈值（用于 classifyBp）：正常 <135/85，偏高 ≥135/85，急症 ≥160/100，急诊 ≥180/120，偏低 <90/60。
- 门诊阈值：正常 <140/90（仅作文案解释）。
- 单次录入支持 1~3 次读数，落库 `sys`/`dia` 取各读数均值（周报统计口径）。
- **急症分诊看原始读数，不被均值稀释**：任一原始读数 sys≥180 或 dia≥120 即 emergency；任一原始读数 ≥160/100 即 urgent；最终分级 = 均值分级与全部原始读数分级取高者（前端 `triageBpLevel`）。
- 时段 `period`：`morning`（晨起后）/ `evening`（睡前）。

### 1.5 控钾安全三态

`Profile.renalKRestriction`：

| 值      | 含义              | 营养策略                                                |
| ------- | ----------------- | ------------------------------------------------------- |
| `true`  | 肾功能不全/需控钾 | 不补钾、不推高钾食谱、富钾维度标记 `restricted`（中性） |
| `false` | 肾功能正常        | 鼓励富钾饮食（DASH）                                    |
| `null`  | 未填写（默认）    | 按正常处理，但不主动提醒补钾                            |

---

## 2. 食物与食谱

### 2.1 食物搜索

`GET /api/foods/search?q=关键词`

**响应 200**：`Food[]`，最多 20 条。隐藏项（调味品）不参与搜索。

`Food` 字段（以 `src/types/index.ts` 为准）：

| 字段                                      | 类型                               | 说明                                                                       |
| ----------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| id                                        | string                             | 食物编码（字符串，前导零需保留）                                           |
| name                                      | string                             | 名称                                                                       |
| category                                  | string                             | 分类                                                                       |
| gi                                        | number \| null                     | 升糖指数：**仅数据集原貌保留，UI 与营养计算不使用**                        |
| energyKCal / protein / fat / CHO / Na / K | number                             | 每 100g 营养值                                                             |
| dietaryFiber                              | number \| null                     | 每 100g 膳食纤维                                                           |
| hidden                                    | boolean?                           | `true` 为调味品等，不参与搜索结果                                          |
| fatFlag                                   | `'high-sat' \| 'chol-occasional'`? | 高饱和脂肪（触发"偶尔解馋"卡）/ 高胆固醇偶尔少量（动物内脏）；鸡蛋黄不贴标 |
| remark                                    | string?                            | 人工估算值备注（待后端核对）                                               |
| servingPresets                            | `FoodServing[]`?                   | 份量快捷档 `{label: string, weightG: number}`，如"1小撮（约1克）"          |

> 无 `tags` 字段。R2.3 不计算 GL/glucose。

### 2.2 食谱列表

`GET /api/recipes?tag=低钠`（`tag` 缺省或 `全部` 返回全部）

**响应 200**：`Recipe[]`：

```json
{
  "id": "steamed_fish",
  "name": "清蒸鲈鱼",
  "image": "/recipes/steamed_fish.jpg",
  "tags": ["高蛋白", "低钠"],
  "yieldG": 400,
  "ingredients": [{ "id": "fish", "name": "鲈鱼", "grams": 300 }],
  "steps": ["..."],
  "nutrients": {
    "energyKCal": 0,
    "protein": 0,
    "fat": 0,
    "CHO": 0,
    "dietaryFiber": 0,
    "K": 0,
    "Na": 0,
    "vegWeight": 0,
    "highSatItems": [],
    "highSatWeightG": 0,
    "cholItems": []
  }
}
```

标签集合（`RECIPE_TAGS`，含筛选项）：`全部 / 低钠 / 高钾 / 高蛋白 / 易咀嚼 / 健康推荐`。
每道菜 `tags` 不超过 3 个。`image` 加载失败时前端自动隐藏只留文字。

---

## 3. 营养评估

### 3.1 拍照识别

`POST /api/recognize`

**请求**：`multipart/form-data`，字段 `image`（单张，JPEG；前端已压缩至最长边 1024px、质量 0.8）。

- 前端**不手动设置** `Content-Type`，由浏览器自动生成带 boundary 的头；后端按标准 `UploadFile` 解析即可。
- 前端超时 30s（其余业务端点默认 10s）。

**响应 200**：`RecognizeScenario`

```json
{
  "id": "scenario_1",
  "label": "白米饭 + 番茄炒蛋 + 腌芥菜",
  "detected": [
    { "kind": "food", "id": "012401x", "name": "白米饭", "confidence": 0.92, "weightG": 200 },
    { "kind": "dish", "id": "tomato_egg", "name": "番茄炒蛋", "confidence": 0.9, "weightG": 150 }
  ]
}
```

**状态码约定（前端三级降级依赖）**：

| 状态码        | 含义                        | 前端行为                           |
| ------------- | --------------------------- | ---------------------------------- |
| 422           | 图片无法识别（模糊/无食物） | 保留图片进入手动确认区，可手动加菜 |
| 404           | 识别服务未就绪              | 无缝回落 mock 场景继续演示         |
| 超时/网络错误 | —                           | 保留图片，提示重试                 |

### 3.2 一餐评估

`POST /api/evaluate`

**请求**：`{ items: MealItem[], profile?: Partial<Profile> }`

```json
{
  "items": [{ "id": "012401x", "weightG": 200 }],
  "profile": { "renalKRestriction": false, "heightCm": 165, "weightKg": 60 }
}
```

**响应 200**：`EvaluateResult`

```json
{
  "score": 52,
  "level": "red",
  "reasons": [{ "metric": "Na", "status": "red", "text": "钠 2055mg，约 5.1g 盐，严重超标" }],
  "totals": {
    "energyKCal": 520,
    "protein": 18,
    "fat": 22,
    "CHO": 65,
    "dietaryFiber": 3,
    "K": 420,
    "Na": 2055,
    "vegWeight": 0,
    "highSatItems": [],
    "highSatWeightG": 0,
    "cholItems": []
  },
  "suggestedItems": [],
  "suggestedTotals": {
    "energyKCal": 480,
    "protein": 24,
    "fat": 16,
    "CHO": 58,
    "dietaryFiber": 6,
    "K": 980,
    "Na": 620,
    "vegWeight": 300,
    "highSatItems": [],
    "highSatWeightG": 0,
    "cholItems": []
  },
  "rules": [],
  "substitutions": [],
  "recipes": []
}
```

- `level` 与 `reasons[].status`：`red` / `yellow` / `green`。
- `suggestedItems` / `suggestedTotals`：推荐搭配及其营养合计（结构同 `NutrientTotals`）。
- `NutrientTotals` 完整字段：`energyKCal, protein, fat, CHO, dietaryFiber, K, Na, vegWeight, highSatItems: string[], highSatWeightG: number, cholItems: string[]`。
- 无 `gl` / `glucose` 字段。钠文案含盐当量（Na ÷ 400 = g 盐）。

---

## 4. 用户画像

### 4.1 获取画像

`GET /api/profile`

**响应 200**：`Profile | null`（首次使用为 null，前端引导 onboarding）。前端每次登录后拉取一次并按 uid 缓存；返回数据会过一遍字段清洗（补默认值、剥离 R1 遗留字段）。

### 4.2 保存画像

`PUT /api/profile`

**请求**：完整 `Profile` 对象（整体覆盖保存）。**响应 200**：保存后的 `Profile`（以前端收到的响应为准）。

### 4.3 Profile 完整字段（建表依据）

| 字段                  | 类型              | 取值 / 说明                                              |
| --------------------- | ----------------- | -------------------------------------------------------- |
| name                  | string            | 姓名/称呼，可空串                                        |
| phone                 | string            | 1 开头 11 位手机号                                       |
| age                   | number \| null    | 岁；≥80 岁血压目标可更宽（脚注）                         |
| gender                | string            | `男` / `女`                                              |
| heightCm              | number \| null    | cm，用于 BMI                                             |
| weightKg              | number \| null    | kg，用于 BMI 与蛋白目标（1.2 g/kg/天）                   |
| occupation            | string            | `retired` / `sedentary` / `standing` / `labor` / `other` |
| activity              | string            | `low` / `mid` / `high`（职业会自动映射，用户可改）       |
| dental                | string            | `好` / `一般` / `不好`                                   |
| taste                 | string            | `清淡` / `一般` / `重口`                                 |
| staplePref            | string            | `白米白面为主` / `粗细搭配` / `杂粮为主`                 |
| eatOutFreq            | string            | `很少` / `每周几次` / `几乎天天`                         |
| smoke                 | string            | `是` / `否`                                              |
| drink                 | string            | `是` / `否`                                              |
| allergies             | string[]          | 忌口/过敏标签，如 `['海鲜','辣']`                        |
| htnStatus             | HtnStatus \| null | 见 4.4                                                   |
| htnDetail             | HtnDetail \| null | 见 4.5                                                   |
| onboarded             | boolean           | 是否完成引导                                             |
| onboardedAt           | string \| null    | 完成日期 `YYYY-MM-DD`                                    |
| renalKRestriction     | boolean \| null   | 控钾三态（见 1.5）                                       |
| emergencyContactName  | string            | 紧急联系人姓名，空串=未设置                              |
| emergencyContactPhone | string            | 紧急联系人手机号（1 开头 11 位），空串=未设置            |

> 已移除（后端不要建）：`t2dStatus`、`sweetFreq` 等血糖/糖尿病字段。

### 4.4 HtnStatus 枚举（注意：不是 controlled/uncontrolled）

```
confirmed   已确诊高血压
none        没有高血压
mild_risk   血压偏高/高危倾向
high_risk   高危（伴危险因素）
unsure      不确定
null        未评估
```

### 4.5 HtnDetail 结构

```json
{
  "duration": "五年以上",
  "medicated": true,
  "assessedAt": "2026-09-23",
  "symptoms": ["剧烈头痛"],
  "factors": ["家族史"],
  "redFlags": ["持续胸痛"],
  "records": [{ "name": "体检报告.pdf", "type": "application/pdf" }]
}
```

- `records` **只存文件元信息**（`name`/`fileName`/`type`），前端绝不上传文件内容，后端不需要病历文件存储。
- `assessedAt`：未走症状问卷时为 `null`。

---

## 5. 餐次与周报

### 5.1 保存一餐

`POST /api/meals`

**请求**：`Meal`（**注意：当前前端会带客户端生成的 `id`**，形如 `m_<时间戳>`）

```json
{
  "id": "m_1727078400000",
  "dateTime": "2026-09-23T12:00:00.000Z",
  "date": "2026-09-23",
  "adoptedHealthy": true,
  "score": 78,
  "level": "yellow",
  "totals": {
    "energyKCal": 520,
    "protein": 18,
    "fat": 22,
    "CHO": 65,
    "dietaryFiber": 3,
    "K": 420,
    "Na": 780,
    "vegWeight": 200,
    "highSatItems": [],
    "highSatWeightG": 0,
    "cholItems": []
  },
  "items": [
    { "id": "012401x", "name": "白米饭", "kind": "food", "confidence": 0.92, "weightG": 200 }
  ],
  "premeal": {}
}
```

**响应 200**：`{ "ok": true, "meal": Meal }`

**id 约定**：客户端 id 仅作幂等参考，服务端可以沿用或重新生成；前端一律以**响应中的 `meal` 为准**回写内存（与血压/服药由服务端生成 id 的模式效果等价）。建议服务端按 id 做去重。

### 5.2 餐次列表

`GET /api/meals?from=YYYY-MM-DD&to=YYYY-MM-DD`

**响应 200**：`Meal[]`，按 `dateTime` 倒序。首页近 7 天 DASH 与"最近常吃"聚合都依赖本接口（前端不再提供"最近常吃"独立端点，由近 7 天餐次在端上聚合）。

### 5.3 删除一餐

`DELETE /api/meals/{id}` → **响应 200**：`true`

### 5.4 周报（饮食）

`GET /api/weekly`

**响应 200**：`WeeklyResult`（对齐 `src/utils/nutrition.ts`）

```json
{
  "days": [
    null,
    {
      "date": "2026-09-18",
      "count": 2,
      "score": 75,
      "na": 2100,
      "protein": 58,
      "vegWeight": 320,
      "categories": ["谷薯", "蔬菜"],
      "items": []
    }
  ],
  "avgScore": 72,
  "dietScores": { "insufficient": 68, "excess": 74, "diversity": 80 },
  "advice": "这周口味偏重……"
}
```

- `days`：固定 7 个元素（最近 7 天，旧→新），**无餐日为 `null`**。
- `WeeklyDay`：`{date, count（餐次数）, score, na, protein, vegWeight, categories: string[], items: MealItem[]}`。
- `advice`：纯字符串文案（**不是** `{level, text}` 对象）。
- 三维度：摄入不足 / 摄入过量 / 多样性。无 GL 维度。
- mock 实现：`buildWeekly(nsRead(meals))`；无体重画像时演示口径按 60kg 算蛋白目标。

---

## 6. 血压记录（FR-40）

### 6.1 BpRecord 结构

```json
{
  "id": "bp_xxx",
  "measuredAt": "2026-09-23T07:30:00Z",
  "date": "2026-09-23",
  "period": "morning",
  "sys": 128,
  "dia": 82,
  "hr": 72,
  "source": "manual",
  "readings": [
    { "sys": 130, "dia": 84 },
    { "sys": 126, "dia": 80 }
  ],
  "arm": "left",
  "pulseRegular": true,
  "symptoms": "胸痛、胸闷、压得慌",
  "createdAt": "2026-09-23T07:30:05Z"
}
```

- `sys`/`dia`：`readings` 均值；`readings`：1~3 次原始读数。
- `source`：`manual`（手动录入）/ `device`（设备同步）。
- `hr`：可为 `null`。
- `arm`：选填 `'left'` / `'right'`；`pulseRegular`：选填布尔；`symptoms`：选填字符串。
- 三个选填字段向后兼容：不上送/不存在时按缺省处理，列表与周报不依赖其存在。

### 6.2 列出血压记录

`GET /api/bp-logs?from=...&to=...` → **响应 200**：`BpRecord[]`，按 `measuredAt` 倒序。
（服务端返回的旧格式数据前端同样会过 `normalizeBpRecords` 归一化。）

### 6.3 新增血压记录

`POST /api/bp-logs`

**请求**：`Omit<BpRecord, 'id' | 'createdAt'>`。客户端**不得**上送自生成的 `id`/`createdAt`。
**响应 200**：完整 `BpRecord`（含服务端生成的 `id`/`createdAt`），前端以响应为准。mock 分支自行补 `id`/`createdAt`。

### 6.4 删除血压记录

`DELETE /api/bp-logs/{id}` → **响应 200**：`true`

### 6.5 家庭血压周报建议（前端 `buildWeeklyBp(records)` 计算）

`WeeklyBpResult`（以 `src/types/index.ts` 为准）：

| 字段                    | 类型/取值                       | 说明                                                 |
| ----------------------- | ------------------------------- | ---------------------------------------------------- |
| avgMorning / avgEvening | `{sys, dia} \| null`            | 早晚均值，缺测为 null                                |
| morningAvgFlag          | `red` / `yellow` / `green`      | 晨起均值旗标（**状态色三值**，非 normal/high/low）   |
| maxSys / maxDia         | number                          | 近 7 天最高值                                        |
| homeHighDays            | number                          | 家庭口径 ≥135/85 的天数                              |
| manualCount             | number                          | 手动录入次数                                         |
| emergencyHit            | boolean                         | 近 7 天是否出现 ≥180/120                             |
| adviceLevel             | `stable` / `high` / `emergency` | 结论等级                                             |
| adviceText              | string                          | 中文结论文案                                         |
| measureFreqAdvice       | string                          | 测量频率建议（未稳→连续 7 天早晚；平稳→每周 1-2 天） |

---

## 7. 服药记录

### 7.1 MedicationRecord 结构

```json
{
  "id": "med_xxx",
  "date": "2026-09-23",
  "takenAt": "2026-09-23T08:00:00Z",
  "name": "氨氯地平"
}
```

### 7.2 列出服药记录

`GET /api/medications?from=...&to=...` → `MedicationRecord[]`，按 `takenAt` 倒序。

### 7.3 打卡服药

`POST /api/medications`，请求 `Omit<MedicationRecord, 'id'>` → 响应完整 `MedicationRecord`（服务端补 id）。

### 7.4 撤销打卡

`DELETE /api/medications/{id}` → `true`

---

## 8. 设备数据

### 8.1 获取设备数据

`GET /api/device-data?from=...&to=...` → **响应 200**：`DeviceData`

```json
{
  "initializedAt": "2026-09-23T08:00:00Z",
  "days": {
    "2026-09-23": {
      "bpMorning": [124, 80],
      "bpEvening": [128, 82],
      "hr": 72,
      "mood": "平静",
      "steps": 6500,
      "sleep": { "total": 7.5, "deepRatio": 0.22 },
      "weight": 60.5,
      "manual": { "hr": false, "steps": false, "sleep": false, "weight": true }
    }
  }
}
```

`DeviceDay` 字段（全部可选，键为 `YYYY-MM-DD`）：

| 字段                  | 类型                                      | 说明                                       |
| --------------------- | ----------------------------------------- | ------------------------------------------ |
| bpMorning / bpEvening | `[number, number]`                        | 晨起/睡前血压 `[收缩压, 舒张压]` 元组      |
| hr                    | number                                    | 静息心率                                   |
| mood                  | string                                    | 心情（平静/焦虑/疲惫/烦躁）                |
| steps                 | number                                    | 步数                                       |
| sleep                 | `{total: number, deepRatio: number}`      | 睡眠时长（小时）/ 深睡比例 0–1             |
| weight                | number                                    | 体重 kg                                    |
| manual                | `{hr?, steps?, sleep?, weight?: boolean}` | 对应指标是否为用户手动录入（无设备也能记） |

> 无 `glucose` 字段。mock 基线：家庭口径 120–132/76–84；高钠饮食→后续血压缓升；健康餐→次日改善（地板 110/70）。
> 设备连接状态（蓝牙血压计/手环/体脂秤/餐盘）纯本机维护，不经过后端。

### 8.2 手动体征录入（端点待后端提供）

前端健康页可手动记录 心率/步数/睡眠/体重。mock 落本地；真实模式目前前端会收到 `NOT_IMPLEMENTED` 并提示用户。
**建议后端提供**：`POST /api/device-data/manual`，请求 `{date?: 'YYYY-MM-DD', metric: 'hr'|'steps'|'sleep'|'weight', value: number}`，响应更新后的 `DeviceData`（或当日 `DeviceDay`）。

---

## 9. DASH 营养目标（常量）

阈值集中在 `src/constants/dict.ts`，服务端复算建议保持一致：

| 常量                       | 值             | 含义                                   |
| -------------------------- | -------------- | -------------------------------------- |
| NA_MEAL                    | 800 mg         | 单餐钠上限（红）；600 mg 为黄档        |
| NA_DAY                     | 2000 mg        | 每日钠上限（≈5g 盐）；1500 mg 为理想档 |
| K_PI / K_AI                | 3600 / 2000 mg | 钾每日充分摄入 / 适宜摄入              |
| K_MEAL_GOOD                | 1000 mg        | 单餐钾良好阈值                         |
| PROTEIN_PER_KG             | 1.2 g          | 每日蛋白（g/kg 体重，肾病者遵医嘱）    |
| VEG_MEAL / VEG_DAY         | 150 / 500 g    | 单餐 / 每日蔬菜目标                    |
| FIBER_DAY                  | 25 g           | 每日膳食纤维目标（17 g 为黄档）        |
| SODIUM_PER_SALT_G          | 400 mg         | 1g 盐 ≈ 400mg 钠                       |
| SCORE_GREEN / SCORE_YELLOW | 80 / 60        | 评分绿/黄档线                          |

---

## 10. 前端实现对应

| 端点                         | 前端函数（`src/api/index.ts`） | mock 实现                     | 调用方                                                |
| ---------------------------- | ------------------------------ | ----------------------------- | ----------------------------------------------------- |
| POST /api/recognize          | `recognizeImage(file)`         | `nextScenario()`              | Home 拍照                                             |
| GET /api/foods/search        | `searchFoods(q)`               | 过滤 FOODS                    | 手动加菜搜索                                          |
| POST /api/evaluate           | `evaluateApi(payload)`         | `evaluate()`                  | Result 页                                             |
| GET /api/profile             | `getProfile()`                 | `nsRead(profile)`             | profile store `ensureLoaded`（路由守卫，按 uid 缓存） |
| PUT /api/profile             | `saveProfile(p)`               | `nsWrite(profile)`            | profile store 所有写操作（引导/我的页/重测）          |
| GET /api/recipes             | `getRecipes(tag)`              | 过滤 RECIPES                  | Recipes 页                                            |
| POST /api/meals              | `saveMeal(meal)`               | ns 落库 + 体征联动            | meals store `addMeal`                                 |
| GET /api/meals               | `listMeals(range)`             | ns 过滤倒序                   | meals store `load`（首页 DashTodayCard 近 7 天）      |
| DELETE /api/meals/{id}       | `deleteMeal(id)`               | ns 删除                       | meals store `removeMeal`                              |
| GET /api/weekly              | `getWeekly()`                  | `buildWeekly(nsRead(meals))`  | Weekly 页                                             |
| GET /api/bp-logs             | `listBpLogs(range)`            | `nsRead(bpLog)` 归一化过滤    | bpLog store                                           |
| POST /api/bp-logs            | `createBpLog(r)`               | 补 id 后落 ns                 | bpLog store                                           |
| DELETE /api/bp-logs/{id}     | `deleteBpLog(id)`              | ns 删除                       | bpLog store                                           |
| GET /api/medications         | `listMedications(range)`       | `nsRead(meds)` 过滤           | medication store                                      |
| POST /api/medications        | `createMedication(r)`          | 补 id 后落 ns                 | medication store                                      |
| DELETE /api/medications/{id} | `deleteMedication(id)`         | ns 删除                       | medication store                                      |
| GET /api/device-data         | `getDeviceData(range)`         | `mock/deviceData` 动态 import | Health / Weekly 页                                    |
| POST /api/device-data/manual | **待提供**                     | `saveManualMetric`（mock）    | 健康页手动体征弹窗                                    |

mock 专属写入侧（真实模式 no-op）：`ensureDeviceData(profile)`（播种）、`applyDeviceMeal(meal, {adoptedHealthy})`（餐后血压联动）、`resetDeviceData(profile)`（重置）。

切换：`VITE_USE_MOCK !== 'false'` 走 mock，否则走真实 axios 实例（baseURL 取 `VITE_API_BASE_URL`，默认 `http://127.0.0.1:8000`）。

---

## 11. 交接待办（后端需知）

1. **AI 必须后端代理**：浏览器直连会泄露模型密钥。正式环境请后端提供代理（建议 `/api/ai/chat/completions`），并可选提供 `POST /api/ai/feedback`（赞踩反馈，前端失败静默；当前仅写本地 `ai_feedback_v1:<uid>`）。
2. **手动体征端点**：见 8.2。
3. **批量重置端点（可选）**：前端"重置当前账号数据"在真实模式只清本机缓存；如需服务端联动，建议 `DELETE /api/users/me/data`（保留画像）。
4. **不要建血糖字段**：R2 起产品只聚焦高血压，无 glucose/GL/糖尿病相关数据。
5. **食材库 id 同源**：前端内置 `src/mock/foods.ts`（提取自《中国食物成分表第6版》转录集），真实模式下识别结果展示、份量快捷档、手动搜索兜底都按 id 查这份表。`/api/foods/search` 与 `/api/recognize` 返回的食物 `id` 需与前端食材库同源一致，否则会出现有 id 无名称/无份量档。
6. **部署开关**：联调/正式部署时将 `.env.production` 的 `VITE_USE_MOCK` 改为 `false` 并删除 `VITE_ALLOW_MOCK_BUILD=true` 放行行。
7. **设备连接状态**（蓝牙血压计/手环/体脂秤/餐盘的连接/断开）纯本机维护，无后端端点；`GET /api/device-data` 只回传体征数据。
