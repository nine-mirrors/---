# 接口契约分册 S01：账号与鉴权

> 适用：营养膳食助手前端 ↔ FastAPI 后端（R2.2/R2.3）
> 本文件由 Task 12a 维护，与 `src/api/auth.ts`、`src/mock/auth.ts` 逐字段对齐。

## 1. 通用约定

### 1.1 BaseURL

- 前端 `axios` 实例 `baseURL` 取环境变量 `VITE_API_BASE_URL`，缺省 `http://127.0.0.1:8000`。
- 所有端点前缀 `/api/auth/`。

### 1.2 鉴权（JWT，2026-09-26 决议）

- 注册/登录/验证码登录成功后，后端返回 **JWT**，前端存入 `localStorage` 全局键 `ndh_auth_v1`（结构 `{uid, phone, name, token, loginAt}`）。前端把 token 当不透明串，不解析其内容。
- 除 `register`、`login`、`sms/send`、`login/sms` 外，其余端点需在请求头携带：
  ```
  Authorization: Bearer <token>
  ```
- `token` 仅存会话键，不写日志、不拼进 URL。

JWT 规范（后端实现约束）：

| 项          | 约定                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------- |
| 算法        | HS256；密钥从环境变量读取（如 `JWT_SECRET`），严禁硬编码/进前端产物                                 |
| claims      | `sub` = uid（字符串）、`iat` 签发时间、`exp` 过期时间；不要放手机号等隐私                           |
| 有效期      | 30 天；**不做 refresh token**（前端无刷新流程，过期后 401 → 重新登录即可）                          |
| 校验失败    | 缺失/非法/过期一律 401 + `{"code":"UNAUTHORIZED","message":"登录已过期，请重新登录"}`               |
| 登出        | JWT 无状态、不做黑名单：`/api/auth/logout` 校验 token 后直接返回 `{ok:true}`，前端负责丢弃本地 token |
| 推荐依赖    | `pyjwt` 或 `python-jose[cryptography]`；Pydantic 模型直接返回 `{token, user}`，**不要包 envelope**  |
| 密码存储    | PBKDF2/bcrypt 加盐哈希（mock 端用的是 SHA-256+salt，正式后端建议 bcrypt），绝不存明文               |

### 1.3 统一错误结构

非 2xx 响应体统一为：

```json
{
  "code": "PHONE_ALREADY_REGISTERED",
  "message": "该手机号已注册，请直接登录"
}
```

- `code`：业务错误码（字符串），前端 `ApiError.code` 取此值；若后端未返回 `code`，回落 HTTP 状态码。
- `message`：中文人话提示，直接展示给用户。

### 1.4 HTTP 状态码约定

| 状态码 | 含义                                                 | 前端处理                                                                                                                       |
| ------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 200    | 成功                                                 | 返回响应体                                                                                                                     |
| 400    | 请求参数错误（手机号格式等）                         | 展示 `message`                                                                                                                 |
| 401    | 未登录 / token 过期                                  | 清会话、跳 `/login`、提示"登录已过期，请重新登录"（**注意**：`/api/auth/*` 自身返回的 401 按普通业务错误处理，不触发登出跳转） |
| 404    | 资源不存在（如账号不存在）                           | 展示 `message`                                                                                                                 |
| 422    | 业务校验失败（密码错误、验证码错误、手机号已注册等） | 展示 `message`                                                                                                                 |

### 1.5 按用户隔离总则

- 所有业务数据由后端按 `token` 对应用户隔离，前端不接受越权数据假设。
- mock 模式下，业务 `localStorage` 键一律命名空间化为 `<base>:<uid>`（如 `ndh_profile_v1:<uid>`），`storage` 封装统一拼键，业务代码不直接接触命名空间。
- 一键体验使用固定演示 uid `demo`，与注册账号物理隔离。

---

## 2. 端点

### 2.1 注册

`POST /api/auth/register`

**请求**

```json
{
  "phone": "13800000000",
  "password": "123456",
  "name": "王阿姨"
}
```

| 字段     | 类型   | 必填 | 说明                        |
| -------- | ------ | ---- | --------------------------- |
| phone    | string | 是   | 11 位手机号                 |
| password | string | 是   | ≥6 位                       |
| name     | string | 否   | 昵称，缺省"用户+手机后四位" |

**响应 200**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1X3h4eCIsImlhdCI6MTc4…（JWT）",
  "user": {
    "uid": "u_xxx",
    "phone": "13800000000",
    "name": "王阿姨"
  }
}
```

**错误**

| code                       | message                    | 触发条件               |
| -------------------------- | -------------------------- | ---------------------- |
| `PHONE_FORMAT_INVALID`     | 请输入 11 位手机号         | 手机号格式错           |
| `PASSWORD_TOO_SHORT`       | 密码至少 6 位              | 密码 <6 位             |
| `PHONE_ALREADY_REGISTERED` | 该手机号已注册，请直接登录 | 同手机号重复注册 (422) |

---

### 2.2 密码登录

`POST /api/auth/login`

**请求**

```json
{
  "phone": "13800000000",
  "password": "123456"
}
```

**响应 200**：同注册响应体。

**错误**

| code                   | message              | 触发条件           |
| ---------------------- | -------------------- | ------------------ |
| `PHONE_FORMAT_INVALID` | 请输入 11 位手机号   | 手机号格式错       |
| `PASSWORD_TOO_SHORT`   | 密码至少 6 位        | 密码 <6 位         |
| `ACCOUNT_NOT_FOUND`    | 账号不存在，请先注册 | 手机号未注册 (404) |
| `PASSWORD_INCORRECT`   | 密码错误，请重试     | 密码不匹配 (422)   |

---

### 2.3 发送验证码

`POST /api/auth/sms/send`

**请求**

```json
{
  "phone": "13800000000",
  "scene": "login"
}
```

| 字段  | 类型   | 必填 | 说明                                |
| ----- | ------ | ---- | ----------------------------------- |
| phone | string | 是   | 11 位手机号                         |
| scene | string | 否   | 场景，目前 `login`（登录/注册复用） |

**响应 200**

```json
{ "ok": true }
```

**说明**：频控/防刷由后端负责；前端按钮 60 秒倒计时仅为体验。mock 模式不真正发短信，验证码固定为 `123456`。

**错误**：手机号格式错返回 400。

---

### 2.4 验证码登录（未注册自动建号）

`POST /api/auth/login/sms`

**请求**

```json
{
  "phone": "13800000000",
  "code": "123456"
}
```

| 字段  | 类型   | 必填 | 说明           |
| ----- | ------ | ---- | -------------- |
| phone | string | 是   | 11 位手机号    |
| code  | string | 是   | 6 位数字验证码 |

**响应 200**：同注册响应体（`{token, user}`）。

**自动建号语义**：若手机号未注册，后端自动创建账号（name 默认为"用户+手机后四位"）并登录，省去老人单独注册步骤。

**错误**

| code                   | message            | 触发条件                |
| ---------------------- | ------------------ | ----------------------- |
| `PHONE_FORMAT_INVALID` | 请输入 11 位手机号 | 手机号格式错            |
| `SMS_CODE_INVALID`     | 请输入 6 位验证码  | 验证码非 6 位数字       |
| `SMS_CODE_INCORRECT`   | 验证码错误或已过期 | 验证码不匹配/过期 (422) |

---

### 2.5 退出登录

`POST /api/auth/logout`

**请求**：无请求体（需 Bearer token）。

**响应 200**

```json
{ "ok": true }
```

**说明**：前端登出时清会话（`ndh_auth_v1`）并跳 `/login`，**不清业务数据**（再次登录可见）。

---

### 2.6 获取当前用户

`GET /api/auth/me`

**响应 200**

```json
{
  "uid": "u_xxx",
  "phone": "13800000000",
  "name": "王阿姨"
}
```

**错误**：未登录返回 401。

---

## 3. 账号与会话存储（mock 模式）

| 键                | 类型                    | 说明                                                                                                                       |
| ----------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `ndh_accounts_v1` | `Account[]`             | 账号表（全局），字段 `{uid, phone, name, passwordHash, salt, createdAt}`；密码用 WebCrypto SHA-256 + 随机 salt，绝不存明文 |
| `ndh_auth_v1`     | `Session`               | 当前会话（全局），字段 `{uid, phone, name, token, loginAt}`                                                                |
| 业务键            | 命名空间 `<base>:<uid>` | 如 `ndh_profile_v1:<uid>`、`ndh_meals_v1:<uid>` 等                                                                         |

一键体验（demo 账号）只写 `ndh_auth_v1` 会话（uid=`demo`），不往 `ndh_accounts_v1` 建账号行。

---

## 4. 前端实现对应

| 端点            | 前端函数           | mock 实现         |
| --------------- | ------------------ | ----------------- |
| POST /register  | `register(req)`    | `mockRegister`    |
| POST /login     | `login(req)`       | `mockLogin`       |
| POST /sms/send  | `sendSmsCode(req)` | `mockSendSmsCode` |
| POST /login/sms | `loginBySms(req)`  | `mockLoginBySms`  |
| POST /logout    | `logout()`         | `mockLogout`      |
| GET /me         | `getMe()`          | `mockGetMe`       |

切换：`VITE_USE_MOCK !== 'false'` 走 mock，否则走真实 axios 实例。
