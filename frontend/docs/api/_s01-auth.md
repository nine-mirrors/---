# 接口契约分册 S01：账号与鉴权

> 适用：营养膳食助手前端 ↔ FastAPI 后端（R2.2/R2.3）
> 本文件由 Task 12a 维护，与 `src/api/auth.ts`、`src/mock/auth.ts` 逐字段对齐。
> 2026-09-27 变更：**账号标识由手机号改为邮箱，验证码改由邮件发送**（短信有成本、长辈邮箱免费可达）。

## 1. 通用约定

### 1.1 BaseURL

- 前端 `axios` 实例 `baseURL` 取环境变量 `VITE_API_BASE_URL`，缺省 `http://127.0.0.1:8000`。
- 所有端点前缀 `/api/auth/`。

### 1.2 鉴权（JWT，2026-09-26 决议）

- 注册/登录/验证码登录成功后，后端返回 **JWT**，前端存入 `localStorage` 全局键 `ndh_auth_v1`（结构 `{uid, email, name, token, loginAt}`）。前端把 token 当不透明串，不解析其内容。
- 除 `register`、`login`、`email/send`、`login/email` 外，其余端点需在请求头携带：
  ```
  Authorization: Bearer <token>
  ```
- `token` 仅存会话键，不写日志、不拼进 URL。

JWT 规范（后端实现约束）：

| 项          | 约定                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------- |
| 算法        | HS256；密钥从环境变量读取（如 `JWT_SECRET`），严禁硬编码/进前端产物                                 |
| claims      | `sub` = uid（字符串）、`iat` 签发时间、`exp` 过期时间；不要放邮箱等隐私                             |
| 有效期      | 30 天；**不做 refresh token**（前端无刷新流程，过期后 401 → 重新登录即可）                          |
| 校验失败    | 缺失/非法/过期一律 401 + `{"code":"UNAUTHORIZED","message":"登录已过期，请重新登录"}`               |
| 登出        | JWT 无状态、不做黑名单：`/api/auth/logout` 校验 token 后直接返回 `{ok:true}`，前端负责丢弃本地 token |
| 推荐依赖    | `pyjwt` 或 `python-jose[cryptography]`；Pydantic 模型直接返回 `{token, user}`，**不要包 envelope**  |
| 密码存储    | PBKDF2/bcrypt 加盐哈希（mock 端用的是 SHA-256+salt，正式后端建议 bcrypt），绝不存明文               |

### 1.3 统一错误结构

非 2xx 响应体统一为：

```json
{
  "code": "EMAIL_ALREADY_REGISTERED",
  "message": "该邮箱已注册，请直接登录"
}
```

- `code`：业务错误码（字符串），前端 `ApiError.code` 取此值；若后端未返回 `code`，回落 HTTP 状态码。
- `message`：中文人话提示，直接展示给用户。

### 1.4 HTTP 状态码约定

| 状态码 | 含义                                                 | 前端处理                                                                                                                       |
| ------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 200    | 成功                                                 | 返回响应体                                                                                                                     |
| 400    | 请求参数错误（邮箱格式等）                           | 展示 `message`                                                                                                                 |
| 401    | 未登录 / token 过期                                  | 清会话、跳 `/login`、提示"登录已过期，请重新登录"（**注意**：`/api/auth/*` 自身返回的 401 按普通业务错误处理，不触发登出跳转） |
| 404    | 资源不存在（如账号不存在）                           | 展示 `message`                                                                                                                 |
| 422    | 业务校验失败（密码错误、验证码错误、邮箱已注册等）   | 展示 `message`                                                                                                                 |

### 1.5 按用户隔离总则

- 所有业务数据由后端按 `token` 对应用户隔离，前端不接受越权数据假设。
- mock 模式下，业务 `localStorage` 键一律命名空间化为 `<base>:<uid>`（如 `ndh_profile_v1:<uid>`），`storage` 封装统一拼键，业务代码不直接接触命名空间。
- 一键体验使用固定演示 uid `demo`，与注册账号物理隔离。

### 1.6 邮箱大小写与规范化

- 后端入库与查找前统一对邮箱做 `strip().lowercase()`；同一邮箱的不同大小写写法视为同一账号（前端 mock 已如此实现）。
- 前端校验为宽松正则 `^[^\s@]+@[^\s@]+\.[^\s@]{2,}$`、长度 ≤128；后端可更严，但返回的中文 `message` 需可直接展示。

---

## 2. 端点

### 2.1 注册

`POST /api/auth/register`

**请求**

```json
{
  "email": "wangayi@163.com",
  "password": "123456",
  "name": "王阿姨"
}
```

| 字段     | 类型   | 必填 | 说明                             |
| -------- | ------ | ---- | -------------------------------- |
| email    | string | 是   | 邮箱，规范化后唯一               |
| password | string | 是   | ≥6 位                            |
| name     | string | 否   | 昵称，缺省取邮箱“@”前的本地名    |

**响应 200**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1X3h4eCIsImlhdCI6MTc4…（JWT）",
  "user": {
    "uid": "u_xxx",
    "email": "wangayi@163.com",
    "name": "王阿姨"
  }
}
```

**错误**

| code                       | message                    | 触发条件             |
| -------------------------- | -------------------------- | -------------------- |
| `EMAIL_FORMAT_INVALID`     | 请输入正确的邮箱地址       | 邮箱格式错           |
| `PASSWORD_TOO_SHORT`       | 密码至少 6 位              | 密码 <6 位           |
| `EMAIL_ALREADY_REGISTERED` | 该邮箱已注册，请直接登录   | 同邮箱重复注册 (422) |

---

### 2.2 密码登录

`POST /api/auth/login`

**请求**

```json
{
  "email": "wangayi@163.com",
  "password": "123456"
}
```

**响应 200**：同注册响应体。

**错误**

| code                     | message              | 触发条件         |
| ------------------------ | -------------------- | ---------------- |
| `EMAIL_FORMAT_INVALID`   | 请输入正确的邮箱地址 | 邮箱格式错       |
| `PASSWORD_TOO_SHORT`     | 密码至少 6 位        | 密码 <6 位       |
| `ACCOUNT_NOT_FOUND`      | 账号不存在，请先注册 | 邮箱未注册 (404) |
| `PASSWORD_INCORRECT`     | 密码错误，请重试     | 密码不匹配 (422) |

---

### 2.3 发送邮箱验证码

`POST /api/auth/email/send`

**请求**

```json
{
  "email": "wangayi@163.com",
  "scene": "login"
}
```

| 字段  | 类型   | 必填 | 说明                                |
| ----- | ------ | ---- | ----------------------------------- |
| email | string | 是   | 邮箱                                |
| scene | string | 否   | 场景，目前 `login`（登录/注册复用） |

**响应 200**

```json
{ "ok": true }
```

**邮件内容与发送要求（后端实现约束）**：

- 验证码为 **6 位数字**，正文大字展示，适老阅读；邮件标题示例「【营养膳食助手】您的登录验证码 123456」。
- 验证码有效期 **10 分钟**；验证成功或再次发送后旧码作废。
- 发信通道任选：SMTP（如 QQ/163 企业邮箱授权码，建议 `aiosmtplib`）或事务型邮件服务；账号/授权码走环境变量（如 `SMTP_USER`、`SMTP_PASSWORD`、`SMTP_HOST`、`SMTP_FROM`），严禁硬编码。
- **频控（必须实现）**：同一邮箱两次发送间隔 ≥60 秒（与前端 60 秒倒计时对齐），单邮箱/单 IP 每日发送量加上限（建议各 10 次/日），超限返回 429 + 中文提示。
- 响应不区分邮箱是否已注册（避免被用来枚举有效邮箱）；对不存在的邮箱也返回 `{ok:true}`，邮件可省略或静默。
- 前端按钮 60 秒倒计时仅为体验；mock 模式不真正发邮件，验证码固定为 `123456` 且自动填入。

**错误**

| code                   | message              | 触发条件              |
| ---------------------- | -------------------- | --------------------- |
| `EMAIL_FORMAT_INVALID` | 请输入正确的邮箱地址 | 邮箱格式错 (400)      |
| `RATE_LIMITED`         | 发送太频繁，请稍后再试 | 触发频控 (429)       |

---

### 2.4 邮箱验证码登录（未注册自动建号）

`POST /api/auth/login/email`

**请求**

```json
{
  "email": "wangayi@163.com",
  "code": "123456"
}
```

| 字段  | 类型   | 必填 | 说明           |
| ----- | ------ | ---- | -------------- |
| email | string | 是   | 邮箱           |
| code  | string | 是   | 6 位数字验证码 |

**响应 200**：同注册响应体（`{token, user}`）。

**自动建号语义**：若邮箱未注册，后端自动创建账号（name 默认为邮箱“@”前的本地名，截断 20 字）并登录，省去老人单独注册步骤。

**错误**

| code                   | message              | 触发条件                |
| ---------------------- | -------------------- | ----------------------- |
| `EMAIL_FORMAT_INVALID` | 请输入正确的邮箱地址 | 邮箱格式错              |
| `EMAIL_CODE_INVALID`   | 请输入 6 位验证码    | 验证码非 6 位数字       |
| `EMAIL_CODE_INCORRECT` | 验证码错误或已过期   | 验证码不匹配/过期 (422) |

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
  "email": "wangayi@163.com",
  "name": "王阿姨"
}
```

**错误**：未登录返回 401。

---

## 3. 账号与会话存储（mock 模式）

| 键                | 类型                    | 说明                                                                                                                                  |
| ----------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ndh_accounts_v1` | `Account[]`             | 账号表（全局），字段 `{uid, email, name, passwordHash, salt, createdAt}`；密码用 WebCrypto SHA-256 + 随机 salt，绝不存明文            |
| `ndh_auth_v1`     | `Session`               | 当前会话（全局），字段 `{uid, email, name, token, loginAt}`；早期手机号版本的旧会话无 `email`，前端恢复时按失效处理并要求重新登录     |
| 业务键            | 命名空间 `<base>:<uid>` | 如 `ndh_profile_v1:<uid>`、`ndh_meals_v1:<uid>` 等                                                                                    |

一键体验（demo 账号，邮箱 `wangayi@example.com`）只写 `ndh_auth_v1` 会话（uid=`demo`），不往 `ndh_accounts_v1` 建账号行。

---

## 4. 前端实现对应

| 端点              | 前端函数              | mock 实现            |
| ----------------- | --------------------- | -------------------- |
| POST /register    | `register(req)`       | `mockRegister`       |
| POST /login       | `login(req)`          | `mockLogin`          |
| POST /email/send  | `sendEmailCode(req)`  | `mockSendEmailCode`  |
| POST /login/email | `loginByEmail(req)`   | `mockLoginByEmail`   |
| POST /logout      | `logout()`            | `mockLogout`         |
| GET /me           | `getMe()`             | `mockGetMe`          |

切换：`VITE_USE_MOCK !== 'false'` 走 mock，否则走真实 axios 实例。
