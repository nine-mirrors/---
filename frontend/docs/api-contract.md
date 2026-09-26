# 营养膳食助手 · 前后端接口契约总装

> 版本：R2.3（高血压 DASH 营养版）
> 维护：Task 12a（鉴权）+ Task 12b（业务数据）
> 前端基线：`src/api/`、`src/mock/`、`src/stores/`

本文件为接口契约总装，分册见：

- [分册 S01：账号与鉴权](./api/_s01-auth.md)
- [分册 S02：业务数据（营养与血压）](./api/_s02-business.md)

---

## 0. 全局约定

### 0.1 BaseURL

- 前端 `axios` 实例 `baseURL` 取环境变量 `VITE_API_BASE_URL`，缺省 `http://127.0.0.1:8000`。
- 鉴权端点前缀 `/api/auth/`；业务端点前缀 `/api/`。

### 0.2 鉴权

- 注册/登录/验证码登录成功后，后端返回 JWT（见 §0.6 决议 4），前端存入全局键 `ndh_auth_v1`。
- 除 `register`、`login`、`sms/send`、`login/sms` 外，其余端点需 `Authorization: Bearer <token>`。
- 401 响应：前端清会话、跳 `/login`、提示"登录已过期，请重新登录"。

### 0.3 数据包装与统一错误结构

- **成功响应无统一 envelope**：HTTP 200 的响应体就是业务 JSON 本身（数组/对象/布尔），前端响应拦截器直接返回裸数据。
- 非 2xx 返回错误体：

```json
{ "code": "PHONE_ALREADY_REGISTERED", "message": "该手机号已注册，请直接登录" }
```

- `code`：业务错误码字符串；后端不返回时前端回落为 HTTP 状态数字码，网络错误为 `NETWORK_ERROR`。
- `message`：中文人话提示，直接展示。
- 前端 `ApiError`（`src/api/http.ts`）封装此结构，`isApiError()` 做类型守卫。

### 0.4 按用户隔离

- 后端按 token 对应用户隔离数据。
- mock 模式业务键命名空间化为 `<base>:<uid>`，由 `src/utils/storage.ts` 的 `nsRead/nsWrite/nsRemove` 统一拼键，业务代码不直接接触命名空间。
- 一键体验 uid=`demo`（从 `account.ts` import `DEMO_UID`），与注册账号物理隔离。

### 0.5 R2.3 变更摘要

- **移除全部血糖/GL/糖尿病逻辑**：无 `gl`、`glucose`、`t2dStatus`、`sweetFreq` 字段。
- **新增高血压 DASH 营养数据层**：血压记录、控钾安全、家庭血压口径。
- `Profile.renalKRestriction` 三态（true/false/null）控制补钾策略。

### 0.6 架构决议（2026-09-26 后端答疑，效力高于根目录 `docs/` 里的 R1 规划资料）

> 根目录 `docs/`（项目资料清单、队员任务要求、Agent 提示词等）是 R1"低钠稳糖"阶段的历史资料，其中"糖尿病规则、GL 阈值、稳糖推荐"等描述**已废弃**。后端实现一律以本契约 + `src/types/index.ts` 为准。

| #   | 问题                         | 决议                                                                                          | 理由/执行要点                                                                                                                                                                                              |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 响应包一层 `{code,data}`？   | **不包。成功裸数据，错误只包 `{code,message}`**                                               | 前端拦截器、全部 mock 与 241 个测试都按裸数据写死；后端尚为空仓，现在改零迁移成本。FastAPI 直接 `return` Pydantic 模型即可，另注册一个全局 exception handler 统一吐 §0.3 错误体，不要加包装中间件          |
| 2   | 保留 t2d 糖尿病字段？        | **不保留、不入库、不入 DTO**                                                                  | R2.3 产品范围只有高血压。前端读取画像时会主动剥离 `t2dStatus/sweetFreq`（`storage.ts` 迁移名单），后端返回了也会被静默丢弃；规则引擎中 3 条依赖 t2d 的规则直接删除，不要"先留着"                              |
| 3   | GL（血糖负荷）还算吗？       | **不算。删除 `T2D_GL_THRESHOLD_EXCEEDED` 等全部 GL 规则；任何接口不返回 `gl/glucose` 字段**  | 前端有测试断言响应里不存在 `gl`/`glucose`（`nutrition.spec.ts`）。`data/` 的 GI 数据集与食材表 `gi` 列可作为静态资料保留，但不产生任何规则、评分和话术；DASH 五维为 钠/钾/蛋白/蔬菜/综合                     |
| 4   | token 方案                   | **JWT（HS256），有效期 30 天，无 refresh token**                                              | 无需会话表/存储，FastAPI 标准做法；前端把 token 当不透明串，两种方案对前端无感，但 JWT 少一张表、少一处清理。细节见 S01 §1.2；登出前端自行丢弃 token，`/api/auth/logout` 返回 `{ok:true}` 即可，无需黑名单 |
| 5   | 多用户隔离                   | **SQLite 关系表 + `uid` 外键，所有查询强制 `WHERE uid = 当前用户`**                            | JSON 按 uid 命名空间是前端 mock 在 localStorage 里的模拟手段，不要照搬到服务端：无法查询、无法保证完整性。建议用 SQLAlchemy，外键 `uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`，打开 FK 约束   |
| 6   | 血压/服药/餐次存哪           | **全部 SQLite 表**（`bp_logs`、`medication_records`、`meals`、`profiles`、`device_*`）        | JSON 文件只用于**只读静态种子**（食材库、食谱库）。用户产生的数据一律入库，支持 `?from=&to=` 范围查询、倒序、按 id 删除                                                                                    |

**建议首批建表**：`users`（id/phone/name/password_hash/salt/created_at）、`profiles`（uid 一对一，23 字段见 S02 §4）、`meals` + `meal_items`、`bp_logs`、`medication_records`、`device_days`（或 `device_metrics` 长表）。`id` 由服务端生成（如 `bp_`/`med_` 前缀 + uuidhex），餐次表对客户端上送的 `id` 建唯一索引做幂等。

---

## 1. 鉴权端点（S01 摘要）

| 方法 | 路径                  | 说明                         |
| ---- | --------------------- | ---------------------------- |
| POST | `/api/auth/register`  | 注册                         |
| POST | `/api/auth/login`     | 密码登录                     |
| POST | `/api/auth/sms/send`  | 发送验证码                   |
| POST | `/api/auth/login/sms` | 验证码登录（未注册自动建号） |
| POST | `/api/auth/logout`    | 退出登录                     |
| GET  | `/api/auth/me`        | 当前用户                     |

详见 [S01](./api/_s01-auth.md)。

---

## 2. 业务端点（S02 摘要）

| 方法   | 路径                      | 说明                                          |
| ------ | ------------------------- | --------------------------------------------- |
| POST   | `/api/recognize`          | 拍照识别（multipart/form-data, 字段 `image`） |
| GET    | `/api/foods/search`       | 食物搜索                                      |
| POST   | `/api/evaluate`           | 一餐营养评估                                  |
| GET    | `/api/profile`            | 获取画像                                      |
| PUT    | `/api/profile`            | 保存画像                                      |
| GET    | `/api/recipes`            | 食谱列表                                      |
| POST   | `/api/meals`              | 保存一餐（带客户端 id，服务端响应为准）       |
| GET    | `/api/meals`              | 餐次列表（支持 `{from,to}`，倒序）            |
| DELETE | `/api/meals/{id}`         | 删除一餐                                      |
| GET    | `/api/weekly`             | 营养周报                                      |
| GET    | `/api/bp-logs`            | 血压记录列表（支持 `{from,to}`）              |
| POST   | `/api/bp-logs`            | 新增血压记录                                  |
| DELETE | `/api/bp-logs/{id}`       | 删除血压记录                                  |
| GET    | `/api/medications`        | 服药记录列表（支持 `{from,to}`）              |
| POST   | `/api/medications`        | 服药打卡                                      |
| DELETE | `/api/medications/{id}`   | 撤销服药打卡                                  |
| GET    | `/api/device-data`        | 设备数据（支持 `{from,to}`）                  |
| POST   | `/api/device-data/manual` | 手动体征录入（**待后端提供**，见 S02 §8.2）   |

详见 [S02](./api/_s02-business.md)。AI 代理、赞踩反馈、批量重置等交接事项见 S02 §11。

---

## 3. 核心数据结构

### 3.1 BpRecord

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
  "createdAt": "2026-09-23T07:30:05Z"
}
```

### 3.2 NutrientTotals

```json
{
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
}
```

> 无 `gl` 字段。

### 3.3 Profile（完整字段以 S02 §4.3 为准）

```json
{
  "name": "王阿姨",
  "phone": "13800000001",
  "age": 68,
  "gender": "女",
  "heightCm": 160,
  "weightKg": 60,
  "occupation": "retired",
  "activity": "low",
  "dental": "好",
  "taste": "清淡",
  "staplePref": "粗细搭配",
  "eatOutFreq": "很少",
  "smoke": "否",
  "drink": "否",
  "allergies": ["海鲜"],
  "htnStatus": "confirmed",
  "htnDetail": { "medicated": true, "symptoms": [], "factors": [], "redFlags": [], "records": [] },
  "onboarded": true,
  "onboardedAt": "2026-09-23",
  "renalKRestriction": false,
  "emergencyContactName": "",
  "emergencyContactPhone": ""
}
```

> `htnStatus` 枚举：`confirmed / none / mild_risk / high_risk / unsure / null`（无 controlled/uncontrolled）。
> 无 `t2dStatus`、`sweetFreq` 等血糖字段。

---

## 4. 血压分级（家庭自测口径）

| 等级      | sys  | dia  |
| --------- | ---- | ---- |
| normal    | <135 | <85  |
| high      | ≥135 | ≥85  |
| urgent    | ≥160 | ≥100 |
| emergency | ≥180 | ≥120 |
| low       | <90  | <60  |

任一维度达标即取更高等级（如 sys=185, dia=80 → emergency）。

---

## 5. DASH 营养目标

| 指标    | 单餐             | 每日               |
| ------- | ---------------- | ------------------ |
| 钠 (Na) | <800 mg          | <2000 mg（≈5g 盐） |
| 钾 (K)  | ≥1000 mg（良好） | 3600 mg（充分）    |
| 蛋白    | —                | 1.2 g/kg 体重      |
| 蔬菜    | ≥150 g           | ≥500 g             |

> 控钾用户（`renalKRestriction=true`）：不补钾、富钾维度标记 `restricted`。
