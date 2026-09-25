# 营养膳食助手（前端演示原型 · R2.3：聚焦高血压）

面向 **50 岁以上关注血压健康人群**的纯前端演示原型，演示 **登录（密码 / 验证码 / 一键体验）→ 首次高血压健康引导 → 拍照或手动记一餐 → 低钠高钾（DASH）营养评估 → 保存后血压趋势联动 → 手动血压记录 / 规律服药打卡 / DASH 每日达标 / 血压周报总结** 的完整闭环。

技术栈：Vue 3.5 + Vite 7 + TypeScript + Pinia 2 + Vue Router 4 + Element Plus 2 + ECharts 5 + axios。

## 1. 项目边界

- 默认 **Mock 模式**：食材、识别结果、体征曲线均为演示数据，模拟数据 UI 挂“演示数据”角标（`DemoBadge`），手动录入的血压与服药记录标注为“本机记录”。
- 所有营养/血压结论均为**膳食与健康风险提示，不是医学诊断**，不构成用药或治疗依据。
- 急症红旗症状（剧烈头痛、持续胸痛、一侧肢体麻木、说话不清、突发视力下降）界面提示拨打 120；出现急症请直接线下就医。
- 全应用**不包含任何血糖 / 糖尿病 / CGM 相关功能**（R2 起产品收窄为只聚焦高血压）。

### 核心临床口径（《中国高血压防治指南 2024 修订版》）

| 项目         | 口径                                                                             |
| ------------ | -------------------------------------------------------------------------------- |
| 家庭自测阈值 | **135 / 85 mmHg**（诊室 140 / 90 仅作解释文案）                                  |
| 三级提示     | 135–159 / 85–99 复测提醒；≥160 / 100 尽快就医；≥180 / 120 伴红旗立即急诊         |
| 偏低提示     | <90 / 60 可保存，提示休息 + 服药者勿自行停药                                     |
| 控盐         | 钠 mg ÷ 400 ≈ 盐 g，一天食盐不超过 5 g；减盐可降收缩压 5–8 mmHg                  |
| 钾           | 努力目标 PI 3600 mg/天；肾功能不全或服普利/沙坦类药须控钾，不自行吃补钾片/低钠盐 |
| 蛋白质       | 1.0–1.2 g/kg/天（演示目标取 1.2 g/kg），肾病者遵医嘱                             |

阈值集中在 `src/constants/dict.ts`（`BP_THRESHOLDS`、`SODIUM_PER_SALT_G=400` 等）。

## 2. 运行方式

### 2.1 环境

Node.js 20.19+ 或 22.12+（本项目验证版本 Node v24.11.1 / npm 11.6.2）。

### 2.2 命令（在 `frontend/` 下执行）

```bash
npm install                       # 安装依赖

npm run dev                       # 开发服务器 http://127.0.0.1:5173
npm run build                     # 生产构建 → dist/
npm run preview                   # 预览构建产物
```

### 2.3 工程门禁

```bash
npm run typecheck                 # vue-tsc --noEmit（零错误）
npm run lint                      # ESLint（src 下 .ts/.vue/.js/.cjs/.mjs）
npm run test                      # Vitest（watch 模式）
npm run test:run                  # Vitest 单次运行
npm run ci                        # 一条命令：typecheck → lint → test → build
```

`npm run ci` 为本地与 GitHub Actions 统一门禁。husky `pre-commit` 钩子对暂存文件跑 `prettier --check` + `eslint`（不自动改写）。工作流见 `.github/workflows/ci.yml`。

### 2.4 目录结构

```text
frontend/
├── .env.development / .env.production   # VITE_USE_MOCK、VITE_API_BASE_URL
├── vite.config.ts                       # @ 别名、127.0.0.1:5173、manualChunks 分包
├── src/
│   ├── main.ts                          # 入口；全局 errorHandler + unhandledrejection
│   ├── api/                             # http.ts（axios+Bearer+401）、auth.ts、index.ts（业务）
│   ├── constants/                       # dict.ts、onboarding.ts
│   ├── mock/                            # foods / recipes / scenarios / deviceData / auth
│   ├── stores/                          # auth / profile / meals / devices / premeal / bpLog / medication
│   ├── utils/                           # nutrition / healthAssess / date(formatRelTime) / storage(命名空间) / account / image / totals
│   ├── composables/                     # useCamera / useSpeech / useSpeechRecognition / useEcharts(按需注册)
│   ├── components/                      # common / layout
│   ├── styles/                          # tokens.css / base.css / components.css
│   ├── router/index.ts                  # 路由表 + 异步守卫
│   └── views/                           # Login / Onboarding / Home / Result / Health / Weekly / Recipes / Profile / Devices
└── docs/
    ├── api-contract.md                  # 前后端接口契约（总装）
    └── api/                             # _s01-auth.md / _s02-business.md 分册
```

## 3. Mock 与真实后端切换

### 3.1 开关

`VITE_USE_MOCK`：写成字符串 `false` 走真实后端，其余（`true`/留空）走 Mock。改 `.env` 后需重启 dev / 重新 build。

### 3.2 真实后端地址

`src/api/http.ts`：`baseURL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'`；请求拦截器注入 `Authorization: Bearer <token>`；401 统一清会话跳 `/login` 并提示“登录已过期”；网络错误给中文提示。

### 3.3 接口清单

接口双实现（mock / axios）签名一致，详见 [`docs/api-contract.md`](./docs/api-contract.md)。主要端点：

- 鉴权：`POST /api/auth/register|login|sms/send|login/sms|logout`、`GET /api/auth/me`
- 识别：`POST /api/recognize`（multipart/form-data，字段 `image`，JPEG）
- 业务：`GET /api/foods/search`、`POST /api/evaluate`、`GET/PUT /api/profile`、`GET /api/recipes`、`GET/POST /api/meals`、`DELETE /api/meals/{id}`、`GET /api/weekly`
- 血压：`GET/POST/DELETE /api/bp-logs`（支持 `from`/`to`）
- 服药：`GET/POST/DELETE /api/medications`（支持 `from`/`to`）
- 设备：`GET /api/device-data`（支持 `from`/`to`）

## 4. 账号与数据隔离（多账号）

- 登录方式：**验证码登录（默认 tab）** / 密码登录+注册 / 一键体验。
- Mock 模式账号表存 `ndh_accounts_v1`，密码用 **WebCrypto SHA-256 + 随机 salt 散列**（不存明文），登录常量时间比较；会话存 `ndh_auth_v1`。
- **验证码登录**：mock 固定演示码 **123456**（界面明示并自动填入）；未注册手机号自动建号进入引导；短信网关与频控由后端负责。
- 所有业务 localStorage 键按 uid 命名空间隔离（`<base>:<uid>`，如 `ndh_meals_v1:<uid>`、`ndh_bp_log_v1:<uid>`、`ndh_meds_v1:<uid>`），不同账号数据互不串读。
- 一键体验使用固定演示账号 **uid=`demo`**，与注册账号物理隔离。
- 退出登录只清会话，账号数据保留；“重置当前账号数据”只清当前 uid 命名空间（留画像）。

## 5. 模拟硬件（4 项，无 CGM）

`src/constants/dict.ts` 的 `DEVICES`：

| key     | 名称       | 对应卡片               |
| ------- | ---------- | ---------------------- |
| `bp`    | 蓝牙血压计 | 血压卡（置顶放大）     |
| `band`  | 健康手环   | 心率情绪 / 步数 / 睡眠 |
| `scale` | 智能体脂秤 | 体重                   |
| `plate` | 智能餐盘   | 识别分量（无独立卡）   |

血压模拟基线按家庭口径 120–132 / 76–84；近期连续高钠 → 后续天血压缓升；采纳低钠健康餐 → 次日改善（带地板值）。断开设备后对应卡片显示未连接占位；血压计断开仍可手动录入。

## 6. 拍照识别与手动记一餐

- 拍照/相册图片经 `src/utils/image.ts`（canvas 压缩至最长边 1024px、JPEG 0.8、EXIF 方向校正，**零运行时依赖**）后上传。
- Mock 模式 5 种识别场景按钠含量梯度循环；真实模式 `POST /api/recognize`（multipart）。
- **三级降级**：超时/网络 → 保留图片重试；422 识别失败 → 进入手动确认区；404 后端未就绪 → 无缝走 mock 场景。任何情况都可“手动加菜”完成记录。
- 首页提供“不拍照，手动记一餐”入口（空确认区 + 手动加菜 + 最近常吃一键带入）。

## 7. 血压四项专属能力

1. **手动录入血压**（健康页）：大字数字键盘 + 步进按钮（血压 ±2、心率 ±1）+ 带出上次读数；支持双读数取均值（差 >10 提示第三测）；测量规范提示 + 双臂首测 + 80 岁以上目标可更宽脚注；黄/橙/红（含 tel:120 急症条/别自己开车）/低四级提示；心率 <50 洛尔类提示不拦截。
2. **规律服药打卡**（首页，仅确诊+规律服药用户）：今日打卡/撤销/连续天数，“忘了吃别自己补双倍”，断签无惩罚。
3. **DASH 每日达标**（首页）：低盐（含盐当量）/ 蔬菜 / 优质蛋白 / 富钾（控钾画像转“遵医嘱控钾”中性态）。
4. **血压周报总结**（周报页）：晨起/晚间 7 天均值、最高值、≥135/85 天数、手动次数、测量频率建议、**“打印 / 存成 PDF 给医生看”**（window.print 一页纸，含每日明细与非诊断声明）。

## 8. 隐私与病历

- 引导中可附病历图片/PDF：仅 `URL.createObjectURL` 当次预览，持久化只存 `{ name, type }`，**不上传、不存文件内容**。
- 所有业务数据仅存本机 localStorage（Mock 模式）；真实模式由后端按账号隔离。

## 9. 浏览器与权限

- 摄像头与语音识别需 `localhost` / `127.0.0.1` 或 HTTPS；开发服务器固定 `127.0.0.1:5173`。
- 推荐新版 Chrome / Edge；语音识别不支持时“按住说话”按钮自动隐藏。
- 语音播报用 `speechSynthesis`（zh-CN），受全局语音开关约束。

## 10. 数据来源

食材数据见 `src/mock/foods.ts`，提取自仓库 `data/` 的《中国食物成分表第6版》与《食物升糖指数 GI》转录集（**仅用于学习演示**）。`gi` 字段仅作数据集原貌保留，UI 与营养计算不使用。燕麦（019012）与虾仁口径在文件内标注“待后端核对”。

## 11. 已知限制

1. 前端不内置图像识别模型，真实识别由后端 `/api/recognize` 提供。
2. 短信验证码的网关/发码/频控由后端负责，前端只交付 UI 与 mock 演示码。
3. 真实模式下网络失败只给中文提示并保留本地草稿，不做冲突合并。
4. 数据按浏览器隔离，换浏览器/清站点数据即丢失。

## 12. AI 营养师配置

右下角悬浮球（除 `/ai` 完整对话页外的所有页面可见，含登录/引导页）由 `src/components/ai/AiAssistant.vue` 提供，接口在 `src/api/ai.ts`，系统提示词在 `src/utils/aiPrompt.ts`，本地关键词回复在 `src/mock/ai.ts`。

### 12.0 完整对话页 `/ai`

登录后访问 `/ai`（全屏独立页，不套底部 tabbar）打开完整对话页 `src/views/ai/AiChatPage.vue`；悬浮球面板 header 的"完整页面 ⇒"也会跳到这里，进入该页后悬浮球自动隐藏。

- **多会话本地保存**：左侧栏可新建 / 切换 / 删除会话（`src/stores/aiChat.ts`），会话与消息按账号写入 `localStorage`（键 `ai_chats_v1:<uid>`），刷新不丢；附件图片的 dataUrl 仅保留在内存，不写入本地。空会话有欢迎卡片与 4 个建议问题，支持多轮上下文、失败重发、最后一条回答"重新生成"、请求中点"停止"中止。
- **语音输入与方言**：输入框麦克风支持普通话、粤语（广东话）、台湾国语三个语种（Web Speech API，见 `SPEECH_DIALECTS`），普通话带着家乡口音慢慢说也能识别；需使用新版 Chrome / Edge 并在浏览器设置里允许麦克风权限、保持联网。浏览器不支持时方言菜单项自动禁用。
- **附件**：每条消息最多 3 张图片、单张 ≤5MB（jpg/png/webp/gif），图片以 dataUrl 随消息走视觉多模态模型；另支持 ≤512KB 的 `.txt` / `.md` 文字文件，内容在发送前以"【文件：文件名 内容】"拼进消息文本。PDF、Word 等类型会提示"目前支持图片和 txt/md 文字文件"。
- **赞踩反馈**：每条 AI 回答下方可点赞 / 点踩（再点一次取消），结果写入本地 `ai_feedback_v1:<uid>`（当前只存本地；后端代理 AI 后建议提供 `POST /api/ai/feedback` 接收，见 `docs/api/_s02-business.md` §11），不影响正常使用。

### 12.1 配置接口密钥

在 `frontend/.env.local` 中写入（该文件匹配 `.gitignore` 的 `*.local`，不会提交）：

```bash
VITE_USE_MOCK=false
VITE_AI_API_KEY=sk-你的密钥
# 以下两项已有默认值，一般不用改
VITE_AI_BASE_URL=https://api.deepseek.com
VITE_AI_MODEL=deepseek-flash
```

改完 `.env.local` 需要重启 `npm run dev`。未配置密钥又关掉 mock 时，聊天面板会提示"AI 还没配置接口密钥，请在 .env.local 设置 VITE_AI_API_KEY"。

### 12.2 Mock 模式（默认，不耗 token）

`VITE_USE_MOCK=true`（或留空）时，AI 走本地 `mockChat` 关键词回复，覆盖：菜太咸/减盐、血压偏高、钾与肾病控钾、按时吃药、推荐菜谱（燕麦杂粮饭、清蒸鲈鱼、西兰花炒虾仁）、App 用法（五标签、拍照认菜、手动记一餐、健康页记血压）、急症拨 120、打招呼等，完全离线、不产生任何费用。开发联调建议保持 mock。

### 12.3 模型说明

默认模型 `deepseek-flash`，走 OpenAI 兼容的 `POST {VITE_AI_BASE_URL}/chat/completions`（非流式、temperature 0.7、20 秒超时）；换成任何兼容端点只需改基地址与模型名。该模型支持图片理解，后续可扩展"拍照问菜"。

### 12.4 安全提示

浏览器直连意味着密钥会打包进前端产物，**仅适合本机演示**；正式环境必须由后端代理 AI 请求并保管密钥，前端只调自己的后端。AI 接口刻意不复用业务 axios 实例，避免 401 拦截串到登录页，失败只在聊天面板内给出中文错误与"再试一次"。AI 的所有营养/用药回复均为健康提示，不做诊断、不开药，急症一律建议拨打 120。
