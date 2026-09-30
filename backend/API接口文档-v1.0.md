# 营养膳食助手 · 前后端接口文档 v1.0（联调版）

> 用途：前后端联调的唯一接口清单。本文档由前端实际请求代码（`frontend/src/api/*.ts`）逐条核对生成，共 **21 个 HTTP 端点**（19 个需实现 + 1 个待建 + 1 个 AI 代理建议）。
> 字段事实来源：`frontend/src/types/index.ts`、`frontend/src/types/auth.ts`（如本文档与类型不一致，以类型 + 前端代码为准并立即通知前端）。
> 更新日期：2026-09-29。配套文件：《邮件验证码登录-后端实现清单.md》《待裁点回复-前端确认.md》、`foods-ids.json`、`recipes-seed-and-images.zip`。

---

## 1. 全局约定

### 1.1 基本信息

| 项 | 值 |
|----|----|
| 协议 | HTTP（开发）/ HTTPS（生产必须） |
| BaseURL | 环境变量 `VITE_API_BASE_URL`，缺省 `http://127.0.0.1:8000` |
| 路径前缀 | 所有接口以 `/api` 开头 |
| 请求编码 | `application/json`（拍照识别除外，为 `multipart/form-data`） |
| 时间格式 | ISO 8601 字符串（如 `2026-09-23T07:30:00.000Z`）；日期字段为 `YYYY-MM-DD` |
| 区间查询 | 通用 `?from=YYYY-MM-DD&to=YYYY-MM-DD`（均含端点，可只传一个） |
| 超时 | 普通接口前端 10s；拍照识别 30s；AI 20s |

### 1.2 鉴权

- 登录/注册/发验证码/验证码登录 4 个端点**不需要** token；其余全部需要请求头：

```
Authorization: Bearer <JWT>
```

- JWT：HS256，有效期 30 天，无 refresh token；claims 的 `sub` 放字符串 uid；密钥读环境变量 `JWT_SECRET`。
- token 缺失/非法/过期 → **401**：`{"code":"UNAUTHORIZED","message":"登录已过期，请重新登录"}`。
  前端收到 401（`/api/auth/*` 自身除外）会自动清会话并跳转登录页。

### 1.3 响应格式（强约束）

- **成功：直接返回裸数据**，禁止包 `{code:0, data:{...}}` 之类信封。
  - 列表直接返回数组 `[...]`；对象直接返回 `{...}`；纯成功返回 `true` 或 `{"ok":true}`。
- **失败：HTTP 非 2xx，响应体统一为**：

```json
{ "code": "业务错误码字符串", "message": "直接展示给用户的中文提示" }
```

- 前端取 `data.code`（取不到则回落 HTTP 状态码）、`data.message` 直接弹窗，message 必须是人话中文。

### 1.4 HTTP 状态码

| 码 | 用途 |
|----|------|
| 200 | 成功 |
| 400 | 参数格式错误（邮箱格式等） |
| 401 | 未登录 / token 过期 |
| 404 | 资源不存在；识别服务未就绪（仅 `/api/recognize`，见 4.1） |
| 422 | 业务校验失败（密码错、验证码错、图片无法识别、邮箱已注册等） |
| 429 | 触发频控 |
| 500 | 服务端错误 |

### 1.5 多用户隔离与 CORS

- 所有业务表数据按 token 对应用户隔离，服务端强制 `WHERE uid = 当前用户`，越权访问返回 404（不泄露资源存在性）。
- 业务表外键使用**字符串 uid**：`uid TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE`，SQLite 需 `PRAGMA foreign_keys=ON`。
- 后端必须开启 CORS 允许前端站点域名（含开发端口），放行 `Authorization`、`Content-Type` 头。

---

## 2. 端点总表

### 鉴权（6 个，无需 token）

| # | 方法 | 路径 | 说明 |
|---|------|------|------|
| 1 | POST | `/api/auth/register` | 邮箱+密码注册 |
| 2 | POST | `/api/auth/login` | 邮箱+密码登录 |
| 3 | POST | `/api/auth/email/send` | 发送邮件验证码 |
| 4 | POST | `/api/auth/login/email` | 验证码登录（未注册自动建号） |
| 5 | POST | `/api/auth/logout` | 登出（JWT 无状态，返回 ok） |
| 6 | GET | `/api/auth/me` | 当前用户信息 |

### 业务（需 Bearer token）

| # | 方法 | 路径 | 说明 |
|---|------|------|------|
| 7 | POST | `/api/recognize` | 拍照识别菜品（multipart，30s） |
| 8 | GET | `/api/foods/search?q=` | 食物搜索（≤20 条） |
| 9 | POST | `/api/evaluate` | 一餐营养评估 |
| 10 | GET | `/api/profile` | 获取画像（首次为 null） |
| 11 | PUT | `/api/profile` | 整体覆盖保存画像 |
| 12 | GET | `/api/recipes?tag=` | 食谱列表 |
| 13 | POST | `/api/meals` | 保存一餐 |
| 14 | GET | `/api/meals?from=&to=` | 餐次列表（dateTime 倒序） |
| 15 | DELETE | `/api/meals/{id}` | 删除一餐 |
| 16 | GET | `/api/weekly` | 近 7 天饮食周报 |
| 17 | GET | `/api/bp-logs?from=&to=` | 血压记录列表（measuredAt 倒序） |
| 18 | POST | `/api/bp-logs` | 新增血压记录（id/createdAt 服务端生成） |
| 19 | DELETE | `/api/bp-logs/{id}` | 删除血压记录 |
| 20 | GET | `/api/medications?from=&to=` | 服药记录列表（takenAt 倒序） |
| 21 | POST | `/api/medications` | 服药打卡（id 服务端生成） |
| 22 | DELETE | `/api/medications/{id}` | 撤销服药打卡 |
| 23 | GET | `/api/device-data?from=&to=` | 设备/体征数据（按天 map） |
| 24 | POST | `/api/device-data/manual` | **待后端提供**：手动体征录入 |

### AI（建议后端提供）

| # | 方法 | 路径 | 说明 |
|---|------|------|------|
| 25 | POST | `/api/ai/chat/completions` | **建议**：模型代理（密钥必须在后端，禁止进前端） |
| — | POST | `/api/ai/feedback` | 可选：赞踩反馈，前端失败静默 |

---

## 3. 鉴权接口

### 3.1 注册 `POST /api/auth/register`

请求：

```json
{ "email": "wangayi@163.com", "password": "123456", "name": "王阿姨" }
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | 是 | 入库前 `strip().toLowerCase()`，唯一索引，≤128 字符 |
| password | string | 是 | ≥6 位；bcrypt/PBKDF2 加盐哈希存储，禁止明文 |
| name | string | 否 | 昵称；缺省取 @ 前本地名，截断 20 字 |

响应 200（注册/登录/验证码登录三者完全同体）：

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs....(JWT)",
  "user": { "uid": "u_xxx", "email": "wangayi@163.com", "name": "王阿姨" }
}
```

错误码：`EMAIL_FORMAT_INVALID`(400) / `PASSWORD_TOO_SHORT`(422) / `EMAIL_ALREADY_REGISTERED`(422，"该邮箱已注册，请直接登录")。

### 3.2 密码登录 `POST /api/auth/login`

请求 `{email, password}`；响应同 3.1。
错误码：`EMAIL_FORMAT_INVALID`(400) / `PASSWORD_TOO_SHORT`(422) / `ACCOUNT_NOT_FOUND`(404，"账号不存在，请先注册") / `PASSWORD_INCORRECT`(422，"密码错误，请重试")。

### 3.3 发送邮箱验证码 `POST /api/auth/email/send`

请求：`{ "email": "wangayi@163.com", "scene": "login" }`（scene 可不传，目前仅 login）。

响应 200：**固定** `{ "ok": true }`——邮箱无论是否注册都返回相同结果（未注册可静默不发信），防止枚举用户。

规则（详见《邮件验证码登录-后端实现清单.md》）：6 位数字码存服务端、10 分钟有效、验证成功或重发后旧码作废；同邮箱发送间隔 ≥60 秒、同邮箱/同 IP 各 ≤10 次/天；SMTP 配置走环境变量；演示环境可用 `SMTP_ENABLED=false` 降级为**日志打印**（验证码绝不允许出现在响应体中）。

错误码：`EMAIL_FORMAT_INVALID`(400) / `RATE_LIMITED`(429，"发送太频繁，请稍后再试")。

### 3.4 验证码登录 `POST /api/auth/login/email`

请求：`{ "email": "wangayi@163.com", "code": "123456" }`。
响应 200：同 3.1。**邮箱未注册时自动建号**并直接签发 token（昵称取本地名）。
错误码：`EMAIL_FORMAT_INVALID`(400) / `EMAIL_CODE_INVALID`(400，"请输入 6 位验证码") / `EMAIL_CODE_INCORRECT`(422，"验证码错误或已过期")。

### 3.5 登出 `POST /api/auth/logout`

请求体 `{}`（需 token，但服务端不做黑名单）。响应 `{ "ok": true }`。即使 token 失效也返回 200，前端自行丢弃本地会话。

### 3.6 当前用户 `GET /api/auth/me`

响应 200：`{ "uid": "u_xxx", "email": "wangayi@163.com", "name": "王阿姨" }`。token 无效返回 401 `UNAUTHORIZED`。

---

## 4. 业务接口（均需 Bearer token）

### 4.1 拍照识别 `POST /api/recognize`

- 请求：`multipart/form-data`，字段名 **`image`**，单张 JPEG（前端已压缩至最长边 1024px、质量 0.8）。**前端不手动设 Content-Type**，后端按标准文件上传解析 boundary。
- 超时放宽到 30s。

响应 200：`RecognizeScenario`

```json
{
  "id": "scenario_1",
  "label": "白米饭 + 番茄炒蛋 + 腌芥菜",
  "detected": [
    { "id": "012401x", "name": "白米饭", "kind": "food", "confidence": 0.92, "weightG": 200 },
    { "id": "tomato_egg", "name": "番茄炒蛋", "kind": "dish", "confidence": 0.9, "weightG": 150 }
  ]
}
```

特殊状态码（前端有三级降级，务必遵守）：

| 码 | 含义 | 前端行为 |
|----|------|----------|
| 422 | 图片无法识别（模糊/无食物） | 保留图片，进入手动加菜确认区 |
| 404 | 识别服务未就绪/未配置 | 无缝回落到内置 mock 场景继续演示 |
| 超时/网络错误 | — | 保留图片，提示重试 |

> `detected[].kind`：`food` 普通食材 / `dish` 混合菜品；`id` 必须与食材库同源（见 5.1 与 `foods-ids.json`，含 15 个人工语义 id）。

### 4.2 食物搜索 `GET /api/foods/search?q=关键词`

响应 200：`Food[]`，**最多 20 条**；调味品等隐藏项（`hidden=true`）不参与搜索。空关键词时可返回常用列表（前端 mock 返回全部可见项）。

`Food` 字段（每 100g 可食部）：

```json
{
  "id": "012401x",
  "name": "米饭(蒸)",
  "category": "谷类及其制品-稻米",
  "gi": 83,
  "energyKCal": 116, "protein": 2.6, "fat": 0.3, "CHO": 25.9,
  "dietaryFiber": 0.3, "Na": 2.5, "K": 30,
  "hidden": false,
  "fatFlag": null,
  "servingPresets": [{ "label": "1小碗（约150克）", "weightG": 150 }]
}
```

- `id` 字符串，前导零与 `x` 后缀原样保留；`gi` 只做数据保留，**不参与任何评分/话术**；
- 可空字段：`gi`、`dietaryFiber`、`hidden`、`fatFlag`（`high-sat` / `chol-occasional`）、`remark`、`servingPresets`。
- 种子数据源：仓库 `data/中国食物成分表第6版_Sanotsu_全量.csv`；首批可直接用 `foods-ids.json` 对齐的 42 条。

### 4.3 一餐评估 `POST /api/evaluate`

请求：

```json
{
  "items": [{ "id": "012401x", "weightG": 200 }],
  "profile": { "renalKRestriction": false, "heightCm": 165, "weightKg": 60 }
}
```

- `items[]`：`{id, weightG, name?, kind?, confidence?}`，至少 1 条；
- `profile` 可选，传画像片段用于个体化阈值（蛋白按体重 1.2g/kg 等）。

响应 200：`EvaluateResult`

```json
{
  "score": 52,
  "level": "red",
  "reasons": [{ "metric": "Na", "status": "red", "text": "钠 2055mg，约 5.1g 盐，严重超标" }],
  "totals": { "energyKCal": 520, "protein": 18, "fat": 22, "CHO": 65, "dietaryFiber": 3,
              "K": 420, "Na": 2055, "vegWeight": 0, "highSatItems": [], "highSatWeightG": 0, "cholItems": [] },
  "suggestedItems": [],
  "suggestedTotals": { "energyKCal": 480, "protein": 24, "fat": 16, "CHO": 58, "dietaryFiber": 6,
              "K": 980, "Na": 620, "vegWeight": 300, "highSatItems": [], "highSatWeightG": 0, "cholItems": [] },
  "rules": [],
  "substitutions": [{ "from": "白米饭 200g", "to": "燕麦杂粮饭 150g", "tip": "杂粮钾和纤维更丰富" }],
  "recipes": []
}
```

结构约束：
- `level` 与 `reasons[].status`：`red` / `yellow` / `green`；
- `rules[]` 元素：`{id, severity: red|yellow|green|neutral, title, metric: string|null, value: number|null, threshold: number|null, evidence, text, recipeTags: string[]}`；
- **禁止返回 `gl` / `glucose` / `t2d` 字段**（前端有测试断言其不存在）；钠文案含盐当量（Na ÷ 400 = 克盐）；
- 评分/规则口径必须与前端 `src/utils/nutrition.ts`、常量 `src/constants/dict.ts` 一致（DASH 五维：钠/钾/蛋白/蔬菜/综合），阈值见附录 C。

### 4.4 获取画像 `GET /api/profile`

响应 200：`Profile` 对象；**用户从未保存过时返回 `null`**（前端据此进入引导）。23 个字段见附录 A。

### 4.5 保存画像 `PUT /api/profile`

请求：**完整的 `Profile` 对象**（整体覆盖语义，不做字段级 patch）。响应 200：保存后的 `Profile`（前端以响应为准）。
注意：`htnDetail.records[]` 只含文件元信息 `{name?, fileName?, type?}`，**不会上传病历文件内容**，后端无需文件存储。

### 4.6 食谱列表 `GET /api/recipes?tag=低钠`

- `tag` 缺省或为 `全部` 时返回全部；合法标签集合：`全部 / 低钠 / 高钾 / 高蛋白 / 易咀嚼 / 健康推荐`。

响应 200：`Recipe[]`

```json
{
  "id": "steamed_bass_dish",
  "name": "清蒸鲈鱼",
  "image": "/recipes/steamed_bass_dish.jpg",
  "tags": ["高蛋白", "低钠"],
  "yieldG": 200,
  "ingredients": [{ "id": "121226", "name": "鲈鱼", "grams": 190 }],
  "steps": ["鲈鱼处理干净……", "水开后上锅蒸 8 分钟", "淋热油加低盐酱油即可"],
  "nutrients": { "energyKCal": 0, "protein": 0, "fat": 0, "CHO": 0, "dietaryFiber": 0,
                 "K": 0, "Na": 0, "vegWeight": 0, "highSatItems": [], "highSatWeightG": 0, "cholItems": [] }
}
```

- 首批 12 道种子数据 + 12 张图见 `recipes-seed-and-images.zip`（直接导入）；
- `nutrients` 由配料克数 × 食材表营养值服务端复算（与前端 `computeTotals` 同口径），不要手抄；
- `image` 为字符串路径：可由前端静态托管存 `/recipes/xxx.jpg`，也可由后端/CDN 托管存完整 URL，前端两种都能渲染，加载失败自动隐藏。

### 4.7 保存一餐 `POST /api/meals`

请求：`Meal`（**当前前端会带客户端生成的 id**，形如 `m_<时间戳>`）：

```json
{
  "id": "m_1727078400000",
  "dateTime": "2026-09-23T12:00:00.000Z",
  "date": "2026-09-23",
  "adoptedHealthy": true,
  "score": 78,
  "level": "yellow",
  "totals": { "energyKCal": 520, "protein": 18, "fat": 22, "CHO": 65, "dietaryFiber": 3,
              "K": 420, "Na": 780, "vegWeight": 200, "highSatItems": [], "highSatWeightG": 0, "cholItems": [] },
  "items": [{ "id": "012401x", "name": "白米饭", "kind": "food", "confidence": 0.92, "weightG": 200 }],
  "premeal": {}
}
```

响应 200：`{ "ok": true, "meal": <服务端落库后的 Meal> }`。
id 处理：服务端可沿用客户端 id（建议对其建唯一索引做幂等去重）或重新生成，**前端一律以响应里的 meal 回写**。

### 4.8 餐次列表 `GET /api/meals?from=&to=`

响应 200：`Meal[]`，按 `dateTime` **倒序**。区间参数按 `date` 字段过滤，可省略。首页近 7 天聚合（DASH、最近常吃）全部由前端基于此接口数据计算，**无需额外聚合端点**。

### 4.9 删除一餐 `DELETE /api/meals/{id}`

响应 200：`true`。资源不存在或不属于当前用户返回 404。

### 4.10 饮食周报 `GET /api/weekly`

响应 200：`WeeklyResult`

```json
{
  "days": [null, { "date": "2026-09-18", "count": 2, "score": 75, "na": 2100,
            "protein": 58, "vegWeight": 320, "categories": ["谷薯", "蔬菜"], "items": [] }],
  "avgScore": 72,
  "dietScores": { "insufficient": 68, "excess": 74, "diversity": 80 },
  "advice": "这周口味偏重，下周试试每天少吃一次咸菜"
}
```

- `days`：**固定 7 个元素**（最近 7 天，旧→新），无餐日位置放 `null`；
- `advice` 是纯字符串（不是 `{level,text}`）；三维度 `insufficient/excess/diversity`，无 GL 维度；
- 口径对齐前端 `src/utils/nutrition.ts` 的 `buildWeekly`；无体重画像时蛋白目标按 60kg 演示口径。

### 4.11 血压记录列表 `GET /api/bp-logs?from=&to=`

响应 200：`BpRecord[]`，按 `measuredAt` 倒序。旧格式数据前端会自行 `normalizeBpRecords` 容错。

`BpRecord`：

```json
{
  "id": "bp_xxx",
  "measuredAt": "2026-09-23T07:30:00.000Z",
  "date": "2026-09-23",
  "period": "morning",
  "sys": 128, "dia": 82, "hr": 72,
  "source": "manual",
  "readings": [{ "sys": 130, "dia": 84 }, { "sys": 126, "dia": 80 }],
  "arm": "left",
  "pulseRegular": true,
  "symptoms": "胸闷",
  "createdAt": "2026-09-23T07:30:05.000Z"
}
```

字段说明：`period` 为 `morning`/`evening`；`sys`/`dia` 为 readings 均值；readings 1~3 次；`hr` 可 null；`source` 为 `manual`/`device`；`arm`(`left`/`right`)、`pulseRegular`、`symptoms` 三个选填，缺省不影响列表。

### 4.12 新增血压记录 `POST /api/bp-logs`

请求：`Omit<BpRecord, 'id' | 'createdAt'>`——**客户端不发送 id/createdAt**。
响应 200：完整 `BpRecord`（含服务端生成的 `id`（建议 `bp_` 前缀）、`createdAt`）。
参数校验失败返回 422（如 sys/dia 超出合理范围），message 中文。

### 4.13 删除血压记录 `DELETE /api/bp-logs/{id}`

响应 200：`true`；不存在/越权 404。

### 4.14 服药记录列表 `GET /api/medications?from=&to=`

响应 200：`MedicationRecord[]`，按 `takenAt` 倒序。元素：

```json
{ "id": "med_xxx", "date": "2026-09-23", "takenAt": "2026-09-23T08:00:00.000Z", "name": "氨氯地平" }
```

### 4.15 服药打卡 `POST /api/medications`

请求：`Omit<MedicationRecord, 'id'>`（`{date, takenAt, name?}`）。
响应 200：完整记录（服务端补 `id`，建议 `med_` 前缀）。

### 4.16 撤销打卡 `DELETE /api/medications/{id}`

响应 200：`true`；不存在/越权 404。

### 4.17 设备/体征数据 `GET /api/device-data?from=&to=`

响应 200：`DeviceData`（键为 `YYYY-MM-DD` 的按天 map）：

```json
{
  "initializedAt": "2026-09-23T08:00:00.000Z",
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

DeviceDay 各字段均可选；无 `glucose` 字段。区间过滤按 map 的键。设备蓝牙连接状态纯本机维护，**无后端端点**。

### 4.18 手动体征录入 `POST /api/device-data/manual`（待后端提供）

前端健康页支持手动记录 心率/步数/睡眠/体重，真实模式目前收到 `NOT_IMPLEMENTED` 会提示用户。建议契约：

- 请求：`{ "date": "2026-09-23", "hr": 72, "steps": 6000, "sleep": 7.5, "weight": 60.5 }`
  - `date` 可省略（默认今天）；四个指标字段只传用户本次填写的（≥1 个）；
- 响应：更新后的 `DeviceData`（或当日 `DeviceDay`，二选一请提前告知前端）；
- 写入时对应 `manual.<metric>` 标记置 true。

---

## 5. AI 代理（强烈建议后端提供）

浏览器直连模型会泄露 API Key，正式环境必须由后端代理。建议：

`POST /api/ai/chat/completions`（需用户 Bearer；模型厂商 Key 只存后端环境变量）

- 请求体兼容 OpenAI Chat Completions：`{ model?, messages: [{role, content}], stream: false, temperature?: 0.7 }`，content 可为字符串或多模态 parts（`[{type:'text',text}, {type:'image_url', image_url:{url}}]`）；
- 响应体兼容 OpenAI：`{ choices: [{ message: { content: "..." } }] }`；
- 急症/自行调药等安全拦截**前端已做**（不会发给模型），后端如再加一层更好；
- 可选 `POST /api/ai/feedback`，body `{messageId, rating: 'up'|'down', content?}`，前端失败静默。

---

## 附录 A：Profile 23 字段（建表依据）

| 字段 | 类型 | 取值/说明 |
|------|------|-----------|
| name | string | 姓名/称呼，可空串 |
| age | number\|null | 岁；≥80 岁血压目标更宽 |
| gender | string | `男` / `女` |
| heightCm | number\|null | cm |
| weightKg | number\|null | kg（BMI、蛋白 1.2g/kg） |
| occupation | string | `retired`/`sedentary`/`standing`/`labor`/`other` |
| activity | string | `low`/`mid`/`high` |
| dental | string | `好`/`一般`/`不好` |
| taste | string | `清淡`/`一般`/`重口` |
| staplePref | string | `白米白面为主`/`粗细搭配`/`杂粮为主` |
| eatOutFreq | string | `很少`/`每周几次`/`几乎天天` |
| smoke / drink | string | `是` / `否` |
| allergies | string[] | 忌口标签，如 `["海鲜","辣"]` |
| htnStatus | enum\|null | `confirmed`/`none`/`mild_risk`/`high_risk`/`unsure`/null |
| htnDetail | object\|null | 见下 |
| onboarded | boolean | 是否完成引导 |
| onboardedAt | string\|null | `YYYY-MM-DD` |
| renalKRestriction | boolean\|null | 控钾三态：true 需控钾 / false 正常 / null 不清楚（默认） |
| emergencyContactName | string | 紧急联系人姓名，空串=未设置（**勿与登录手机号混淆，不能删**） |
| emergencyContactPhone | string | 紧急联系人手机号，空串=未设置 |

`htnDetail`：`{duration?: string, medicated?: boolean, assessedAt?: string|null, symptoms?: string[], factors?: string[], redFlags?: string[], records?: {name?, fileName?, type?}[]}`

**禁止建字段**：`phone`（登录手机号已废弃）、`t2dStatus`、`sweetFreq`、任何血糖/GL/糖尿病字段。

## 附录 B：建议首批数据表

`users`（内部自增 id + 字符串 uid + email 唯一 + name + password_hash + created_at）、`profiles`（uid 一对一）、`meals` + `meal_items`、`bp_logs`、`medication_records`、`email_codes`（email/code/expires_at/used/created_at/ip）、`device_days`（uid+date 复合唯一）。食材库、食谱库为只读种子。

## 附录 C：DASH 阈值（服务端复算须一致，源自 `src/constants/dict.ts`）

| 常量 | 值 | 含义 |
|------|----|------|
| NA_MEAL | 800 mg（黄档 600） | 单餐钠上限 |
| NA_DAY | 2000 mg（理想 1500） | 每日钠上限（≈5g 盐） |
| K_PI / K_AI | 3600 / 2000 mg | 钾充分/适宜摄入 |
| K_MEAL_GOOD | 1000 mg | 单餐钾良好 |
| PROTEIN_PER_KG | 1.2 g | 每日蛋白 g/kg 体重 |
| VEG_MEAL / VEG_DAY | 150 / 500 g | 单餐/每日蔬菜 |
| FIBER_DAY | 25 g（黄档 17） | 膳食纤维 |
| SODIUM_PER_SALT_G | 400 mg | 1g 盐 ≈ 400mg 钠 |
| SCORE_GREEN / YELLOW | 80 / 60 | 评分绿/黄线 |

## 附录 D：错误码汇总

| code | 典型 HTTP | 含义 |
|------|-----------|------|
| UNAUTHORIZED | 401 | 未登录/会话过期 |
| EMAIL_FORMAT_INVALID | 400 | 邮箱格式错误 |
| PASSWORD_TOO_SHORT | 422 | 密码不足 6 位 |
| EMAIL_ALREADY_REGISTERED | 422 | 邮箱已注册 |
| ACCOUNT_NOT_FOUND | 404 | 账号不存在 |
| PASSWORD_INCORRECT | 422 | 密码错误 |
| RATE_LIMITED | 429 | 发送过频 |
| EMAIL_CODE_INVALID | 400 | 验证码不是 6 位数字 |
| EMAIL_CODE_INCORRECT | 422 | 验证码错误或过期 |
| NOT_FOUND | 404 | 业务资源不存在/越权 |
| VALIDATION_ERROR | 422 | 请求体校验失败（通用） |
| NOT_IMPLEMENTED | 501 | 端点未提供（当前手动体征） |

---

## 6. 联调步骤

1. 后端按本文件起服务（开发默认 `http://127.0.0.1:8000`），开 CORS；
2. 前端在 `frontend/.env.development.local`（或对应环境文件）配置：
   - `VITE_USE_MOCK=false`
   - `VITE_API_BASE_URL=http://127.0.0.1:8000`
3. 建议按以下顺序联通（依赖链）：
   **auth（发码→验证码登录拿 token）→ auth/me → profile PUT/GET → foods/search → recognize → evaluate → meals 增查删 → weekly → bp-logs 增查删 → medications 增查删 → device-data → recipes**；
4. 生产部署：改 `frontend/.env.production`（`VITE_USE_MOCK=false`、删除 `VITE_ALLOW_MOCK_BUILD=true`、`VITE_API_BASE_URL` 为正式 HTTPS 地址）后重新构建。
   ⚠️ 切成 false 是**全量真实模式**，上述业务接口会同时被调用，请在测试环境全部联通后再上生产。

## 7. 联调验收清单

- [ ] 无 token 访问 `/api/profile` → 401 标准错误体；
- [ ] 验证码完整闭环：发码（真实收信或日志看码）→ 60 秒内重发 429 → 验证码登录拿 token → 未注册邮箱自动建号 → 错误码 422；
- [ ] 带 token GET `/api/profile` 首次为 null；PUT 完整画像后 GET 一致；
- [ ] `/api/foods/search?q=米饭` 返回数组、≤20 条，id 与 `foods-ids.json` 同源；
- [ ] `/api/recognize` 上传 JPEG：200 场景 / 422 无法识别 / 404 服务未就绪 三种路径符合约定；
- [ ] `/api/evaluate` 响应无 gl/glucose 字段，level/reasons 合法；
- [ ] meals：POST（客户端 id 幂等）→ GET 倒序且区间过滤生效 → DELETE 返回 true 后 GET 不含该条；
- [ ] bp-logs：POST 不传 id、响应含服务端 id/createdAt；GET 倒序；DELETE 生效；
- [ ] medications 同上；
- [ ] `/api/device-data?from=&to=` 按天过滤；
- [ ] `/api/weekly` days 固定 7 元素、无餐日为 null；
- [ ] 越权：A 用户 token 访问 B 用户资源 id → 404；
- [ ] 所有成功响应均为裸数据、所有错误体均为 `{code,message}` 且 message 为中文。
