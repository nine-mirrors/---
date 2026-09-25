# 营养膳食助手（纯前端 Vue3 原型）- 实施计划

> 委派波次（防止并发写同一文件）：
>
> * **Wave A（1 agent）**：Task 1 脚手架与布局壳
>
> * **Wave B（2 agents 并行，文件边界互斥）**：Task 2 数据核心（mock+营养计算+健康评估+api+stores+常量）；Task 3 表现核心（composables+通用组件）
>
> * **Wave C（5 agents 并行，各拥有独立 views 文件）**：Task 4 首页；Task 5 结果页；Task 6 健康+设备页；Task 7 周报+食谱页；Task 8 登录+引导+我的页
>
> * **Wave D（1 agent）**：Task 9 集成收口（R2 前已完成 build/lint 门禁与 README 首版；R2.1 后由 Task 17 重新收口）
>
> * **Wave E-0（1 agent 先行）**：Task 11 工程基线——全量 TS 迁移 + Vitest/husky/Actions 骨架 + 图片工具/分包/错误处理
>
> * **Wave E-1（2 agents 并行，文件域互斥，接口预先钉死）**：Task 12a 账号/网络/存储层（auth/account/storage/http/router/契约鉴权分册）；Task 12b 营养与血压数据层（dict/纯函数/业务 api+mock/六业务 store/契约业务分册与总装）。**Wave F 启动闸门：12a+12b 都完成后合并跑 vue-tsc+vitest 全绿才放行**
>
> * **Wave F（6 agents 并行，文件域严格互斥）**：Task 13a 登录+引导；Task 13b 我的页；Task 14 结果页；Task 15a 首页（含拍照识别流/手动记一餐）；Task 15b 健康+设备页；Task 16 周报+食谱（含给医生看打印）
>
> * **Wave G（1 主编排 + 3 浏览器 agent）**：Task 17 R2.3 集成收口（`npm run ci` 全绿/账号线/临床适老线/响应式与无障碍线/ README/契约复核）
>
> * Task 10 为独立 Review（Spec 流程 Review 阶段，R2.3 后按新 **47 条** AC 复核，不在实现波次内）
>
> 全局硬约束（R1 基线）：只在 `d:\code\---\frontend` 内写文件；沙箱内 npm 命令一律加 `--cache C:\Users\21820\AppData\Local\Temp\npm-cache`；不得执行 git 提交。**R2.1 起覆盖**：全量 TypeScript、允许新增 spec FR-47 列明的 devDependencies；其余不变。
>
> localStorage 键约定：\*\*R1 旧形态（Task 11 前的历史代码）\*\*为全局裸键 `ndh_auth_v1`/`ndh_profile_v1`/`ndh_meals_v1`/`ndh_devices_v1`/`ndh_premeal_v1`/`ndh_device_data_v1`/`ndh_settings_v1`；**R2.2 起（Task 12 落地）**：全局键仅 `ndh_accounts_v1`、`ndh_auth_v1`（会话含 `{uid,phone,name,token,loginAt}`），业务键全部命名空间化为 `<base>:<uid>`（demo 账号 uid 固定为 `demo`），并新增 `ndh_bp_log_v1:<uid>`、`ndh_meds_v1:<uid>`；旧裸键由 storage 迁移兜底。

## Task 1: 工程脚手架、设计 Token、布局壳与路由守卫

* **Status**: `pending`

* **Priority**: high

* **Depends On**: None

* **Description**:

  * 在 `frontend/` 用 Vite 初始化 Vue3 工程（手工建 package.json 或 `npm create vite@latest . -- --template vue`），安装：vue、vue-router、pinia、element-plus、@element-plus/icons-vue、echarts、axios；开发依赖：vite、@vitejs/plugin-vue、eslint、eslint-plugin-vue、prettier、eslint-config-prettier、eslint-plugin-prettier（版本取兼容的最新稳定版，peer 冲突时允许 vite 降至 ^7）。

  * 配置：`vite.config.js`（`@`→`src` 别名、host 127.0.0.1、端口 5173）；`.env.development`/`.env.production` 写 `VITE_USE_MOCK=true` 并注释切换说明；`.eslintrc.cjs`（vue3-recommended + prettier 兼容、浏览器环境）；`.prettierrc`（printWidth 100、singleQuote、semi false、trailingComma all）。

  * `src/styles/tokens.css`：CSS 变量——主色 #0e7a5f、状态 #d93025/#f59e0b/#1e8e3e、纸感米白 #faf7f0/暖灰底、≥4.5:1 文字色、`:root{font-size:125%}`（基准 20px）配 clamp 字号、行高 1.6、间距/圆角/柔阴影/按钮高 ≥56px token；`src/styles/base.css`：reset、无衬线中文栈（"PingFang SC","Microsoft YaHei",system-ui,sans-serif）、全局排版。

  * `main.js`（Pinia、Router、ElementPlus 中文 locale）；`App.vue` 仅 `<router-view>` + 全局开关挂载。

  * 布局：`src/components/layout/AppLayout.vue`、`SideNav.vue`（≥1200px 固定左栏，图标+中文五入口+当前高亮）、`BottomTab.vue`（<768px）；内容区 max-width 1280 居中。登录页与引导页**不套** AppLayout（用全屏 AuthLayout 或页面自带居中卡）。

  * 通用组件：`common/DemoBadge.vue`（灰标签，默认"演示数据"）、`common/GlobalSpeechToggle.vue`（固定位置开关，直接读写 localStorage `ndh_settings_v1.speechEnabled`，不依赖 Wave B 的 store）。

  * 路由 `src/router/index.js`：9 条——`/login`、`/onboarding`、`/`、`/result`、`/health`、`/weekly`、`/recipes`、`/profile`、`/devices`；全部建占位 view（供 Wave C 整体覆写，占位仅标题）。全局 beforeEach 守卫（直接读 localStorage，不 import store）：无 `ndh_auth_v1` → `/login`；有登录态但 `ndh_profile_v1.onboarded!==true` → `/onboarding`；已登录访问 `/login` → `/`；已完成引导访问 `/onboarding` → `/`。

  * 验证 dev/build 通过。

* **Acceptance Criteria Addressed**: AC-1、AC-3、AC-28（守卫）、AC-29（守卫）、AC-20（token）、AC-22

* **Test Requirements**:

  * `rule` TR-1.1：`npm run dev` 输出 127.0.0.1:5173 且浏览器打开被守卫跳到 `/login`；证据=日志+截图

  * `rule` TR-1.2：`npm run build` exit 0 并产出 dist/

  * `rule` TR-1.3：手动写两个 localStorage 键模拟三种状态（未登录/待引导/已就绪），深链访问 `/health` 的重定向分别为 /login、/onboarding、正常；证据=控制台操作录屏

  * `rule` TR-1.4：1440px 左栏导航、390px 底部 Tab（业务页内），登录/引导页无主导航；`:root` font-size=20px，tokens 含全部指定色值；证据=截图+DevTools

  * `rule` TR-1.5：`@` 别名至少一处生效且 build 通过

* **Notes**: 占位 view 文件允许被 Wave C agent 直接覆盖；不要在本任务实现业务逻辑。

## Task 2: 数据核心——mock、营养/评估计算、API、Pinia stores

* **Status**: `pending`

* **Priority**: high

* **Depends On**: Task 1

* **Description**:

  * `src/constants/dict.js`：活动量/牙口/口味/情绪选项；食谱标签（低钠/低GL/高蛋白/富钾/易咀嚼）；设备 5 项；营养阈值（GL 单餐 ≤20、低≤10；钠单餐 800/全天 2000mg；钾 PI 3600/AI 2000；蛋白 1.2g/kg；蔬菜单餐折算自 DASH 500g/天；评分 60/80 段；血糖带 3.9–7.8；血压 140/90；步数 6000）。

  * `src/constants/onboarding.js`：职业 5 项（value/label/活动量映射 retired,sedentary→少；standing→中；labor→多；other 需手选）、高血压三选项、确诊时间选项、糖尿病三选项、一般症状 8 项、风险因素 7 项、红旗 5 项、主食偏好/外食/甜食/烟酒枚举；所有文案中文口语。

  * `src/mock/foods.js`：≥20 种食材 + 菜品项，字段 `{id,name,category,gi,energyKCal,protein,fat,CHO,dietaryFiber,Na,K}`，id 沿用真实 foodCode（菜品 slug）。数值取自仓库 `data/` 两文件（米饭 GI83；燕麦用通用燕麦片值并注释"源表 019012 疑似错配，待后端核对"；虾仁取 122204 口径），文件头注释来源与待核对项；无 GI 者 gi=null。

  * `src/mock/recipes.js`：12 道指定食谱（FR-26），自编配料克数/3–6 步做法/tags/yieldG，营养由营养纯函数统一算出，禁止另造数值。

  * `src/mock/scenarios.js`：FR-5 五个场景（含 confidence）。

  * `src/mock/deviceData.js`：确定性生成器（日期/餐次种子、禁真随机）。7 天基线+30 天体重；`getDeviceData()`、`applyMeal(meal, adoptedHealthy)`：高 GL→当日餐后尖峰（可越 7.8）、近 3 天高钠→血压缓升、采纳健康餐→次日改善；步/睡/心率确定性小波动；键 `ndh_device_data_v1`。

  * `src/utils/nutrition.js`（纯函数）：`computeTotals`（0.7/1/1.3 档位）、`computeGL`（gi=null 跳过）、`scoreMeal`（100 起按 GL/钠/蛋白/蔬菜/钾加减，分档 <60/60–79/≥80，返回分项理由）、`buildRules(totals, profile)`（规则 id/severity/title/metric/value/threshold/evidence/text/recipeTags；证据严格按 spec 背景；**htnStatus 为 mild\_risk/high\_risk/confirmed 时追加或强化"连续监测血压、再淡一点"类规则，none 用保持口径；t2dStatus=none 时 GL 建议用"控制精米白面"教育口径**）、`buildSubstitutions`、`pickRecipes`（牙口不好加权"易咀嚼"）、`evaluate(items, profile)`、`buildWeekly(meals)`（三维饮食分+周建议）。

  * `src/utils/healthAssess.js`（纯函数+注释标明非诊断）：`assessHypertension({symptoms:[],factors:[],redFlags:[]})` → `{status:'none'|'mild_risk'|'high_risk', advice, seekCare:boolean}`，阈值：红旗任一→seekCare 且不打分；症状≥2 或因素≥3→mild\_risk；症状+因素叠加明显（症状≥3 或症状≥2 且因素≥2 或因素≥4）→high\_risk；其余 none。`buildOnboardingSummary(profile)` → BMI 判定+蛋白目标+血压结论+3 条个性化建议（htn 状态、口味、牙口、活动量驱动）。`occupationToActivity(code)`。

  * `src/api/http.js`（axios baseURL `http://127.0.0.1:8000`、中文错误提示）；`src/api/` 7 个接口函数按 `VITE_USE_MOCK` 分支（mock 延迟 400–800ms）；recognize 场景首次随机其后循环；profile 接口透传扩展画像。

  * Stores（每个 ≤200 行）：`auth.js`（登录/登出，写 `ndh_auth_v1`，mock 校验只做手机号 11 位/密码≥6 位）、`profile.js`（默认画像 onboarded=false；completeOnboarding/resetAssessment/updateProfile；`ndh_profile_v1`）、`meals.js`（pendingEvaluation 内存草稿 + 餐次持久化，saveMeal 触发 applyMeal）、`devices.js`、`premeal.js`、`settings.js`（与 GlobalSpeechToggle 的键值保持一致）。

* **Acceptance Criteria Addressed**: AC-2、AC-5、AC-8、AC-14、AC-15、AC-21、AC-26、AC-30、AC-31、AC-32

* **Test Requirements**:

  * `rule` TR-2.1：食物 ≥20、食谱=12（营养非空）、场景=5 且克数与 FR-5 一致；证据=计数输出+源码

  * `rule` TR-2.2：场景 1 的 totals/GL 与手算表一致；评分/规则正确；证据=手算对照表

  * `rule` TR-2.3：7 个 api 函数双模式签名一致，false 时 baseURL 正确；证据=源码+请求配置

  * `rule` TR-2.4：deviceData 三方向联动（尖峰/升压/改善）确定性可复现；证据=console 断言

  * `rule` TR-2.5：healthAssess 五种输入（空/症状2/因素4/叠加/红旗）输出符合阈值；buildOnboardingSummary 在 confirmed/mild\_risk/none + 牙口不好四组合下建议不同；证据=断言输出

  * `rule` TR-2.6：6 个 store 持久化键正确、各 ≤200 行；auth 格式校验生效

  * `rubric` TR-2.7：规则与引导建议文案口语化质量；scale 1-5；anchors 1=术语说教/3=正确但生硬/5=中老年人能听懂且可执行；threshold >=4；证据=文案清单

* **Notes**: 菜品综合营养按配料构成折算每 100g 并注释假设。

## Task 3: 表现核心——composables 与通用组件

* **Status**: `pending`

* **Priority**: high

* **Depends On**: Task 1（不依赖 Task 2，按约定 props/接口实现，不 import 其内部文件）

* **Description**:

  * `useEcharts.js`（option getter、ResizeObserver+resize、卸载 dispose）、`useSpeech.js`（speak/stop，zh-CN rate 0.9，读 settings 键，关闭不播；isSupported）、`useSpeechRecognition.js`（特性检测、start/stop/onResult、关键词回调）、`useCamera.js`（getUserMedia environment 优先、抓帧、canvas 最长边 1024/JPEG0.8、释放流、权限错误结构化）。

  * 组件（props/emits，不碰业务 store，全局设置除外）：`ScoreRing.vue`（SVG 三色+评级+图标）、`MetricCard.vue`（色+图标+中文结论三要素）、`RuleCard.vue`（标题/口语/编号/证据/严重色条）、`DemoCard.vue`（自动 DemoBadge、disconnected 占位）、`SubstitutionChip.vue`、`RecipeCard.vue`、`EmptyState.vue`。

  * 另建引导复用组件 `common/BigOptionButton.vue`（≥56px 高、选中态、icon 可选，供引导页与画像页用）。

  * scoped 样式、tokens 变量、单文件 ≤600 行。

* **Acceptance Criteria Addressed**: AC-6、AC-7、AC-9、AC-18、AC-23、AC-33（组件基础）

* **Test Requirements**:

  * `rule` TR-3.1：useEcharts 容器 resize 重绘、卸载无实例泄漏告警

  * `rule` TR-3.2：speak lang/rate 可断言、开关关闭静音；不支持浏览器 supported=false

  * `rule` TR-3.3：useCamera 输出 jpeg 且最长边 ≤1024；拒绝授权返回错误对象

  * `rule` TR-3.4：MetricCard 三态三要素齐全；BigOptionButton 选中/禁用/点击区 ≥44px

  * `rubric` TR-3.5：组件纸感视觉品质；scale 1-5；threshold >=4；证据=组合截图

## Task 4: 首页——拍照/相册/餐前状态/语音/识别确认

* **Status**: `pending`

* **Priority**: high

* **Depends On**: Task 2、Task 3

* **Description**:

  * 仅拥有 `src/views/Home.vue` 与 `src/views/home/`（需要时拆 MealCameraDialog.vue、RecognizedFoodList.vue、PremealCard.vue、VoiceAskButton.vue）；**不得改其他 view 与共享层文件**，缺能力先在本目录内实现并在完成报告中提出。

  * 大主按钮"拍一拍今天的饭菜"→ 摄像头弹层（预览 max 720px 居中+拍照+相册 input）；压缩→1.5s（±200ms）大字 loading→recognizeImage→确认区：名称/置信度、小/标准/大按钮（0.7/1/1.3 倍 weightG）、删除、"智能餐盘/称重勺（演示版请手动选择分量）"灰字、"手动加菜"远程搜索（searchFoods+300ms 防抖）。

  * 餐前状态卡：心率滑块 50–150 默认 78 + 数字输入；情绪四按钮；写 premeal store。

  * "按住说话"：pointerdown/up，识别中显示听到的文字，命中关键词 router.push('/recipes')；不支持隐藏。

  * "看看这餐营养怎么样"（唯一主按钮，空列表禁用）：写 meals.pendingEvaluation 后跳 `/result`。

  * 欢迎语按 profile 昵称/评估结果做一句温和个性化问候（如风险用户"今天也记得留意血压"）。

* **Acceptance Criteria Addressed**: AC-4、AC-5、AC-11、AC-18、AC-20、AC-25、AC-32（问候）

* **Test Requirements**:

  * `rule` TR-4.1：拍照/相册两链路产出 jpeg 压缩图并进入 1.5s 识别；计时证据

  * `rule` TR-4.2：连续 5 次识别场景 1→5 循环（首次随机）；分量/删除/加菜正确进入草稿

  * `rule` TR-4.3：餐前状态持久化，>100/焦虑随草稿传递

  * `rule` TR-4.4：语音按住识别"我今天能吃什么"跳 /recipes；不支持时按钮不存在

  * `rubric` TR-4.5：首页适老化完成度；scale 1-5；threshold >=4；证据=宽/窄截图

## Task 5: 结果页——评分/指标/血糖曲线/规则/播报/保存

* **Status**: `pending`

* **Priority**: high

* **Depends On**: Task 2、Task 3

* **Description**:

  * 仅拥有 `src/views/Result.vue` 与 `src/views/result/`（MealGlucoseChart.vue、ResultMetrics.vue、RulesPanel.vue、RecommendPanel.vue）。

  * 无草稿回首页提示；进入调 evaluate；宽屏左右分栏（左评分/五卡/规则，右曲线图/替换/推荐），<768 单列。

  * ScoreRing+总评；五张 MetricCard（热量/GL/钠/蛋白/钾，阈值取规则结果）。

  * 血糖图：0–120 分钟 5 分钟一点，空腹基线 5.0–6.3，峰值与 GL 正相关（GL≥20 可 9–12、GL≤10 不越 7.8），采纳替换虚线，markArea 3.9–7.8，角标"模拟数据"。

  * RuleCard 列表；听一听/停下（zh-CN 0.9，总结拼评分+最高严重规则+替换建议，受全局开关控制）；替换 chips；3 张 RecipeCard 跳 `/recipes?id=xxx`；心率>100/焦虑温和提示横幅；免责声明。

  * 保存：两个明确大选项——"就按这餐保存"/"换成推荐搭配保存"（后者 adoptedHealthy=true），ElMessage 后回首页；"再拍一餐"丢弃草稿。

  * 规则文案随 profile.htnStatus/t2dStatus 呈现 buildRules 的个性化结果。

* **Acceptance Criteria Addressed**: AC-6、AC-7、AC-8、AC-9、AC-10、AC-11、AC-19、AC-23、AC-26、AC-32

* **Test Requirements**:

  * `rule` TR-5.1：场景1红黄、场景5绿；五卡三要素齐全

  * `rule` TR-5.2：曲线图四要素+高低 GL 形态差异；数据点证据

  * `rule` TR-5.3：规则四要素、TTS 参数/开关、chips/食谱跳转/餐前提示/免责逐项验证

  * `rule` TR-5.4：两种保存写 localStorage 且触发对应设备联动；再拍不写入

  * `rubric` TR-5.5：结果页信息架构适老化；scale 1-5；threshold >=4

## Task 6: 健康页与我的设备页

* **Status**: `pending`

* **Priority**: high

* **Depends On**: Task 2、Task 3

* **Description**:

  * 仅拥有 `src/views/Health.vue`、`src/views/health/`（GlucoseCard.vue、BpCard.vue、MoodHrCard.vue、StepsCard.vue、SleepCard.vue、WeightCard.vue）、`src/views/Devices.vue`。

  * 6 张 DemoCard（"演示数据"角标、大数字加粗）：血糖（副标题"模拟 CGM 设备"、当日曲线+3.9–7.8 绿带+空腹/餐后2h）、血压（7 天早晚双线+今晨大字+140/90 变色；**副标题/一句提示随 htnStatus 差异化**：confirmed 规律服药提醒、mild\_risk/high\_risk 连续监测建议、none 保持/预防口径）、心率情绪（读 premeal 联动）、步数（圆环+6000 达标等级）、睡眠（时长+深浅睡条）、体重（30 天线+BMI，无画像引导去完善）。

  * 设备断连：读 devices store，断连卡显示"设备未连接，点击查看"并跳 `/devices`。

  * Devices：5 设备开关+用途说明+返回。

  * 网格宽 2–3 列/窄 1 列。

* **Acceptance Criteria Addressed**: AC-12、AC-13、AC-14、AC-19、AC-32（血压卡）

* **Test Requirements**:

  * `rule` TR-6.1：6 卡要素+CGM 副标题+6 个演示标签齐全

  * `rule` TR-6.2：断连占位/点击跳转/重连恢复

  * `rule` TR-6.3：高 GL/高钠/健康餐保存后三方向联动在本页可见

  * `rule` TR-6.4：confirmed/mild\_risk/none 三状态血压卡文案不同

  * `rubric` TR-6.5：看板适老可读性；scale 1-5；threshold >=4

## Task 7: 周报页与食谱库页

* **Status**: `pending`

* **Priority**: high

* **Depends On**: Task 2、Task 3

* **Description**:

  * 仅拥有 `src/views/Weekly.vue`（+`src/views/weekly/` 子图表组件）、`src/views/Recipes.vue`（+`src/views/recipes/RecipeDrawer.vue`）。

  * Weekly：getWeekly；GL 柱状/钠柱状/评分折线三图（resize 自适应）；饮食分三维（摄入不足/过量/多样性）大字+解释；本周一句建议；零餐次 EmptyState。

  * Recipes：6 标签大按钮筛选；卡片网格；el-drawer 详情（配料克数/步骤/每份营养）；支持 `route.query.id` 自动打开抽屉；标签中文映射。

* **Acceptance Criteria Addressed**: AC-15、AC-16、AC-19

* **Test Requirements**:

  * `rule` TR-7.1：有数据三图+三维分数、零数据空状态

  * `rule` TR-7.2：6 标签筛选正确；12 道抽屉完整；query id 自动打开

  * `rubric` TR-7.3：两页适老化与视觉一致性；scale 1-5；threshold >=4

## Task 8: 登录页、首次健康引导与我的页

* **Status**: `pending`

* **Priority**: high

* **Depends On**: Task 2、Task 3

* **Description**:

  * 仅拥有 `src/views/Login.vue`、`src/views/Onboarding.vue`、`src/views/onboarding/`（建议拆：StepIndicator.vue、HtnBranchStep.vue、SymptomQuizStep.vue、DiabetesStep.vue、BasicInfoStep.vue、DietHabitStep.vue、SummaryStep.vue）、`src/views/Profile.vue`（+`src/views/profile/`）。**可覆写 Task 1 建的同名占位文件**。

  * Login：居中纸感大卡；手机号/密码（11 位、≥6 位校验，中文错误）；灰字"演示版本，输入符合格式即可登录"；主按钮"登录"；"一键体验登录"（演示账号直接进）；无主导航。

  * Onboarding：全屏居中卡（最大宽 720px）、顶部步骤指示（健康状况→基本信息→饮食与习惯→完成）、每步一问、BigOptionButton 大选项、上一步/下一步、右上角低调"先随便看看"跳过（默认画像 onboarded=true→首页）；首步隐私说明"信息只保存在这台电脑上"。

    * 高血压分支：有→确诊时间（可选）+规律服药开关+**可选病历**（input file 图片/PDF，objectURL 当次预览，只持久化 `{name,type}`，文案"演示版资料仅保存在本机，不会上传到服务器"）；没有→跳基本信息；不清楚→症状问卷（一般症状多选 8、风险因素多选 7、红旗 5 独立醒目卡片），调 assessHypertension，seekCare 时结果卡首屏展示"请尽快线下就医"红色行动卡，始终展示"小问卷不能代替血压测量和医生诊断"。

    * 糖尿病简问三按钮；"不清楚"展示空腹血糖+糖化科普提示。

    * 基本信息：昵称/年龄/性别/身高/体重（实时 BMI+中文判定）/职业 5 项（occupationToActivity 自动预选活动量可改）；饮食步：牙口/口味/主食/外食/甜食/烟酒/忌口标签。

    * Summary：buildOnboardingSummary 输出 BMI、蛋白目标、血压结论、3 条个性化建议（牙口不好含易咀嚼建议）；"开始用"写 profile（onboarded=true、assessedAt）进首页。

  * Profile：顶部高血压评估结论卡（结论+时间+症状明细折叠+"重新进行健康测评"→/onboarding 重测模式，重测前确认覆盖旧结果）；病历文件条目（仅文件名+仅本机标识）；完整可编辑画像表单（实时 BMI/蛋白目标）；入口卡：我的设备、重新测评；危险操作区：退出登录（auth.logout→/login）、重置演示数据（二次确认，清 meals/device/premeal，保留画像）。

  * 全程 20px 基准、单主按钮、急症提示克制。

* **Acceptance Criteria Addressed**: AC-17、AC-28、AC-29、AC-30、AC-31、AC-32、AC-33、AC-20、AC-23（病历/隐私）

* **Test Requirements**:

  * `rule` TR-8.1：登录三类输入+一键体验行为正确；登录态持久化

  * `rule` TR-8.2：守卫拦截/上一步/跳过/完成四路径符合 AC-29

  * `rule` TR-8.3：高血压 5 路径（有含病历、无、问卷 none/mild\_risk/high\_risk+红旗）与 assessHypertension 断言一致；localStorage 无文件内容、有免责声明

  * `rule` TR-8.4：糖尿病三选项、职业→活动量 5 映射、BMI 实时、饮食字段完整持久化

  * `rule` TR-8.5：Profile 评估卡/重测/退出/重置四操作符合 AC-17

  * `rubric` TR-8.6：引导适老化体验；scale 1-5；anchors 见 AC-33；threshold >=4；证据=全步骤截图

## Task 9: 集成收口——联调、README、lint/build 门禁

* **Status**: `pending`

* **Priority**: high

* **Depends On**: Task 4、Task 5、Task 6、Task 7、Task 8

* **Description**:

  * 全新用户视角端到端：登录（含一键体验）→ 引导三分支各走一遍（重点演示"不清楚→mild\_risk"路径）→ 拍照/相册→确认（分量/加菜/删除）→结果（图/卡/规则/播报/个性化文案）→两种保存→健康页联动→周报→食谱筛选抽屉→我的页（重测/设备/退出/重置）。

  * 1440/1024/390 三宽度逐页（含登录/引导）巡检，修横向滚动/重叠/点击区；ECharts resize 全验证；清 console error。

  * `frontend/README.md`：运行、目录、mock↔真实切换（VITE\_USE\_MOCK/baseURL）、7 接口契约位置、模拟硬件清单、登录 mock 与数据本机存储说明、病历不上传说明、问卷免责口径、摄像头/麦克风 localhost 要求、数据来源与待核对项（燕麦/虾仁）。

  * eslint（0 error，争取 0 warning）、prettier；扫描 .vue ≤600 行/store ≤200 行；删占位与死代码；build exit 0。

* **Acceptance Criteria Addressed**: AC-1、AC-19、AC-22、AC-23、AC-24、AC-25、AC-27

* **Test Requirements**:

  * `rule` TR-9.1：完整闭环（含登录引导）无 console error；证据=截图序列

  * `rule` TR-9.2：build exit 0、eslint 0 error、行数扫描通过

  * `rule` TR-9.3：README 章节齐全（运行/切换/模拟硬件/登录与隐私/权限/数据来源）

  * `rule` TR-9.4：3 宽度 × 全部 9 路由巡检无布局破损

  * `rubric` TR-9.5：整体可直接答辩演示的完成度；scale 1-5；threshold >=4

## Task 10: 独立 Review（Spec 流程）

* **Status**: `pending`

* **Priority**: high

* **Depends On**: Task 9、Task 17

* **Description**: 实现队列清空后进入 Review：全新上下文独立 agent 按 review\.md 逐条复核**R2.2 后全部 43 条 AC**（rule 取证据、rubric 打分），输出 pass/fail/blocked；fail 物化为 Issue 回 Implement 修复后重新 Review。重点复核临床口径（NFR-10：家庭 135/85、三级急症、补钾禁忌）、账号隔离（NFR-11/AC-43：命名空间、无明文密码、401）与工程化新增（AC-39～42）。

* **Acceptance Criteria Addressed**: 全部 AC

* **Test Requirements**:

  * `rule` TR-10.1：每条 rule 型 AC 有独立证据；每个 rubric ≥4 分且有评语；证据=review\.md

***

# R2.1/R2.2 重构波次（2026-09-23，spec R2+R2.1+R2.2：聚焦高血压 / 移除全部血糖 / 新增四项血压能力 / 全量 TS+测试+CI / 对接 FastAPI / 多账号隔离与临床二轮加固）

> 公共约束：
>
> * 全部新代码 TypeScript（`.ts` 与 `<script setup lang="ts">`）；旧文件在对应任务中迁移；新 store ≤200 行、.vue ≤600 行；禁止删除食材 gi 原始数据字段；旧 localStorage（残留 t2dStatus/gl/sweetFreq、R2.2 前无命名空间全局业务键）必须容错忽略/迁移。
>
> * **账号边界（R2.2）**：业务 localStorage 一律经命名空间 storage（`:<uid>` 后缀），任何页面/store 禁止拼裸业务键；`src/router/index.ts` 守卫异步化只允许 Task 12 修改，其他任务只读消费 auth store。
>
> * 完成自己任务后不得运行 build/dev（统一在 Task 17 收口），但 Task 11/12 必须保证 `vue-tsc --noEmit` 与 vitest 在各自节点为绿；不执行 prettier --write、不执行 git 操作。
>
> * 临床文案以 spec FR-40/43、NFR-10/11 为准（家庭 135/85；三级急症；补钾/蛋白安全提示；"约"字与盐当量；renalKRestriction=true 不出补钾引导）；任何医学数字改动需回 spec 核对出处，禁止自创阈值。
>
> * npm 命令带 `--cache C:\Users\21820\AppData\Local\Temp\npm-cache`；依赖只装 spec FR-47 清单内的 devDependencies。

## Task 11: 工程基线——全量 TS 迁移 + 测试/CI 骨架（Wave E-0，先行单点）

* **Status**: `pending`

* **Priority**: high

* **Depends On**: Task 9

* **拥有文件**：package.json、tsconfig\*.json、vite.config.ts（由 .js 迁移）、.eslintrc.cjs、.prettierrc、src/\*\*/\*.js→.ts 的机械迁移、所有 .vue 的 `<script setup lang="ts">`、env.d.ts、.husky/、.github/workflows/ci.yml、src/types/（骨架）

* **Description**:

  * 安装（带 cache）：typescript、vue-tsc、@typescript-eslint/parser、@typescript-eslint/eslint-plugin、vitest（jsdom 如需）、husky、lint-staged；创建 `tsconfig.json`/`tsconfig.app.json`/`tsconfig.node.json`（strict、`@/*` paths、vite/client types）；`env.d.ts` 声明 `import.meta.env`（VITE\_USE\_MOCK/VITE\_API\_BASE\_URL）与 .vue 模块。

  * 全量机械迁移：所有 `src/**/*.js` 重命名为 `.ts` 并补最小类型（迁移期允许宽松，如少量 any/unknown 边界，但**不允许 @ts-nocheck 超过 3 处且需注释原因**）；所有 .vue 加 `lang="ts"`；router/storage/date 等先行补准类型；`vite.config.js→ts`；ESLint 增 @typescript-eslint 与 `.ts/.vue` 扩展。

  * scripts：`typecheck: vue-tsc --noEmit`、`test: vitest`、`test:run: vitest run`、`ci: vue-tsc --noEmit && eslint ... && vitest run && vite build`；lint 脚本扩展名更新；http.ts baseURL 改读 `import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'`，请求拦截器实现"从 `ndh_auth_v1` 读 token 并注入 `Authorization: Bearer`"（读取逻辑先内联，Task 12 换 auth store 单一来源），响应拦截器为 401 留统一处理接线（清会话+跳登录的完整实现归 Task 12）；.env.\* 增加 VITE\_API\_BASE\_URL（mock 默认值不变）。

  * `src/types/index.ts` 建领域类型骨架（Profile（含 `renalKRestriction: boolean | null` 占位字段）/BpRecord/MealItem/Meal/EvaluateResult/DeviceData/Rule/ApiResult/**Account/Session/AuthRequest/AuthResponse**，可先放接口定义供 Task 12 填充）。

  * Vitest：一个 smoke spec 验证管线；husky `init` 后写 `.husky/pre-commit`（npx lint-staged）+ package.json lint-staged 配置（暂存 \*.{ts,vue,js} 跑 prettier --check 与 eslint，**不自动改写**）；`.github/workflows/ci.yml`（push/PR、Node 24、npm ci 缓存、`npm run ci`）；不执行 git commit。

  * **R2.3 新增（仍零运行时依赖）**：① `src/utils/image.ts`——图片压缩（最长边 1024、JPEG 0.8）+ EXIF orientation 读取/校正（手写解析 JPEG APP1，纯函数 `readExifOrientation(buf):number` 配 Vitest 用例：1/3/6/8 典型值），导出 `prepareMealImage(file): Promise<Blob>`；② `vite.config.ts` 配 `build.rollupOptions.output.manualChunks`（echarts、element-plus、vendor 三包）消除 >500KB 警告并加快首屏；③ `main.ts` 注册 `app.config.errorHandler`（中文兜底提示，console 留证据）与 `window unhandledrejection` 中文提示，防白屏。

  * 迁移后必须保持：dev 可启动、R1 全部页面行为不变（HMR 验证关键路由）、eslint 0 error、vue-tsc 0 error、build exit 0（chunk 分包后不再有 >500KB 警告）。

* **Acceptance Criteria Addressed**: AC-39（迁移部分）、AC-41

* **Test Requirements**:

  * `rule` TR-11.1：`npm run ci`（除业务测试外）exit 0；`src/` 无业务 .js 残留（配置除外）

  * `rule` TR-11.2：抽查 5 个路由（登录/首页/结果/健康/周报）dev 下渲染无 console error

  * `rule` TR-11.3：pre-commit 拦截可复演（构造一个 lint 错误的暂存文件被拦），ci.yml YAML 语法有效

* **Notes**: 输出《TS 迁移与类型约定说明》（类型放 src/types、组件 props 泛型写法、store 类型范式）供后续 agent 遵循。

## Task 12a: 账号/网络/存储基础层（Wave E-1，与 12b 并行）

* **Status**: `pending`

* **Priority**: high

* **Depends On**: Task 11

* **拥有文件**：src/types/auth.ts（新）、src/utils/account.ts（新）、src/utils/storage.ts（重写）、src/api/http.ts（改造）、src/api/auth.ts（新）、src/mock/auth.ts（新）、src/stores/auth.ts（新）、src/router/index.ts（本任务独占：守卫异步化）、src/\*\*/\*.spec.ts 中仅限 auth/account/storage 同名 spec、frontend/docs/api/\_s01-auth.md（契约分册，新）

* **钉死给 12b 的接口（禁止单方更改，变更需双方一致）**：

  * storage 导出：`nsRead<T>(base:string):T|null`、`nsWrite<T>(base:string,v:T):void`、`nsRemove(base:string):void`（内部从会话取当前 uid；无会话时 nsRead→null、写→抛错式 no-op 并 console.warn）；`readGlobal<T>/writeGlobal<T>/removeGlobal`（仅 accounts/auth 用）；自动迁移：剥离 t2dStatus/sweetFreq/gl、旧裸键首次兜底读入。

  * http 导出：axios 实例（baseURL env、Bearer 注入、401 统一 logout+跳登录）、`ApiError={code,message}`、`isApiError`。

  * auth store 导出：`session:Session|null`、`user`、`ready:boolean`、`login/register/loginBySms/sendSmsCode/demoLogin/logout/restore()`。

  * profile store 必须实现 `ensureLoaded():Promise<Profile>`（守卫调用，12b 落地；12a 只按此签名调用）。

* **Description**:

  * `types/auth.ts`：Account `{uid,phone,name,passwordHash,salt,createdAt}`、Session `{uid,phone,name,token,loginAt}`、AuthRequest/AuthResponse/SmsSendRequest/SmsLoginRequest。

  * `utils/account.ts`：`hashPassword(password,salt)`（WebCrypto SHA-256+随机 salt）、`verifyPassword`（常量时间）、`namespacedKey(base,uid)`、`genMockToken()`、`isPhone/isPassword/isSmsCode`；mock 常量 `DEMO_UID='demo'`、`MOCK_SMS_CODE='123456'`。

  * `utils/storage.ts`：按钉死接口重写为命名空间版（迁移逻辑见上；旧裸键归入 `legacy` uid 兜底，不报错不丢数据）。

  * `api/auth.ts` + `mock/auth.ts`：register/login/sendSmsCode/loginBySms/logout/getMe 双实现；mock 账号表 `ndh_accounts_v1`（同手机号拒绝注册、密码核验、验证码固定 123456、**验证码登录未注册手机号自动建号**、一键体验只写 demo 会话不建账号行）；真实：`/api/auth/register|login|sms/send|login/sms|logout|me`。

  * auth Pinia store（按钉死导出）；http 拦截器改由 store 取 token、401 统一处理；router `beforeEach` 异步化（无会话→/login；有会话→`profile.ensureLoaded()`，期间 App 壳"正在进入…"；onboarded 判断；401 跳由拦截器负责）。

  * Vitest：hashPassword 加盐不一致、正确/错误密码、同手机号拒绝、namespacedKey 两 uid 不交叉、SMS 校验。

  * 契约分册 `docs/api/_s01-auth.md`：通用约定（baseURL、Bearer、统一错误 `{code,message}`、400/401/404/422）、4+2 个 auth 端点（含 sms/send、login/sms 自动建号语义）、按用户隔离总则。

* **Acceptance Criteria Addressed**: AC-28（账号/会话/守卫/验证码数据层）、AC-43（数据隔离层）、AC-45（验证码链路）

* **Test Requirements**:

  * `rule` TR-12a.1：本域 spec 全绿、vue-tsc 对本域 0 error（12b 未就绪导致的跨域报错以 Wave F 闸门合并判定）

  * `rule` TR-12a.2：手测 mock 注册→业务键路径含 uid→退出清会话留数据→验证码登录老号/新号两条路径

  * `rule` TR-12a.3：契约分册与 api/auth.ts 逐字段一致

* **Notes**: 完成后输出《账号层交接说明》（钉死接口实际签名、401 流、demo 行为）交 12b 与 Wave F；不得改任何业务 store/api/mock/views 文件。

## Task 12b: 营养与血压数据层（Wave E-1，与 12a 并行）

* **Status**: `pending`

* **Priority**: high

* **Depends On**: Task 11（12a 并行进行；按钉死接口编码）

* **拥有文件**：src/constants/dict.ts、src/constants/onboarding.ts、src/types/index.ts（填充领域类型）、src/utils/nutrition.ts（可拆 utils/nutrition/*.ts）、src/utils/healthAssess.ts、src/utils/date.ts（formatRelTime 等）、src/mock/（除 mock/auth.ts 外全部）、src/api/（除 http.ts、auth.ts 外全部业务模块）、src/stores/（除 auth.ts 外：profile/meals/devices/premeal/bpLog/medication）、src/\*\*/*.spec.ts 中仅限上述域同名 spec、frontend/docs/api/\_s02-business.md（契约分册，新）、frontend/docs/api-contract.md（总装：合并 \_s01/\_s02，两册齐全后拼装）

* **Description**:

  * dict.ts：删 GL 阈值/glucoseBand/CGM；阈值集中化注释出处——钠 800/2000、钾 PI 3600 与 AI 2000、蛋白 1.2、蔬菜 500、步数 6000；**`BP_THRESHOLDS = {home:135/85, clinic:140/90, urgent:160/100, emergency:180/120, low:90/60}`、`HR_REST_LOW=50`、`ELDER_AGE=80`**；DEVICES 四项（删 cgm）；LS 业务基键常量（bpLog/meds 新增）；SODIUM\_PER\_SALT\_G=400；**步进常量 BP\_STEP=2、HR\_STEP=1**；**不得定义账号/DEMO\_UID 常量（归 12a account.ts），需要时 import**。

  * 领域纯函数（严格类型、无 I/O）：totals（energyKCal/protein/fat/CHO/dietaryFiber/Na/K/vegWeight，无 gl）；scoreMeal 钠/钾/蛋白/蔬菜/DASH；buildRules 按 htnStatus 且 **renalKRestriction=true 剔除一切补钾/高钾规则**；buildSubstitutions（控钾不推高钾）；pickRecipes；buildWeekly 三维；**buildDashProgress(dayMeals, profile)**（富钾维度 renal=true 输出 `restricted` 中性态）；**buildWeeklyBp** 输出 {avgMorning,avgEvening,morningAvgFlag,maxSys,maxDia,homeHighDays,manualCount,emergencyHit,adviceLevel,adviceText,**measureFreqAdvice**（R2.3：未稳→连续7天早晚 / 连续平稳→每周1–2天）}；`classifyBp` 五级；`formatRelTime(date,period)` 输出"今天早起后/昨天睡前/M月D日 早上"；evaluate 无 gl/glucose，含 suggestedItems。

  * Vitest（AC-40 全覆盖+R2.3 新增）：五场景钠梯度与评级；totals 手算；buildDashProgress 零/健康/重盐/restricted；buildWeeklyBp（含 measureFreqAdvice 两分支、急症）；classifyBp 边界；healthAssess 五路径；formatRelTime 四分支。

  * 业务 api+mock（经 12a 的 http/storage/account 接口，**禁止自建 fetch/裸键**）：recognize（真实 multipart 发送压缩后 Blob 并带 Bearer；mock 五场景；识别失败错误码 422 语义与超时/404 分支由 UI 层处理，api 层抛 ApiError）、searchFoods、evaluate、profile、recipes、meals、weekly；**listBpLogs/listCheckins/getDeviceData 支持** **`{from,to}`**、create/delete；profile 实现 `ensureLoaded()`（12a 守卫依赖）；所有 mock 读写走 ns\* 命名空间 API。

  * 六业务 store：profile（默认画像删 t2dStatus/sweetFreq、增 renalKRestriction:null 与清洗、ensureLoaded）、meals（addMeal 收口 saveMeal，修 R1 断轨；"最近常吃"选择器 getRecentFavorites）、devices、premeal、bpLog（双读数均值、recordsOfLast7、lastRecord 供录入带出上次）、medication；重置=nsRemove 当前 uid 业务键（留画像），demo uid 恢复确定性基线。

  * deviceData.ts：day 删 glucose；家庭口径基线 120–132/76–84；钠→血压缓升/采纳改善（地板值）；按 uid 存。

  * mock：foods 增 1–2 高钠项；scenarios 五场景；recipes 六标签自动判定；gi 字段保留。

  * 契约分册 `_s02-business.md` 并在 12a 的 `_s01-auth.md` 就位后**总装 api-contract.md**（目录+通用+鉴权+业务）；recognize 注明 multipart/image JPEG/422 语义；bp/medication/devices 注明 from/to；含 BpRecord 双读数、renalKRestriction 三态。

* **Acceptance Criteria Addressed**: AC-2、AC-21、AC-36、AC-37、AC-38（数据层）、AC-40、AC-42、AC-44（recognize api 层）、AC-46（数据来源）、AC-47（formatRelTime）

* **Test Requirements**:

  * `rule` TR-12b.1：本域 spec 全绿；vue-tsc 对本域 0 error

  * `rule` TR-12b.2：grep 无 gl（gi 字段除外）/无 t2dStatus/无裸 localStorage 业务键/无 DEMO\_UID 重复定义

  * `rule` TR-12b.3：api-contract.md 总装后端点（auth 6 + recognize multipart + 业务 10+）与代码逐一对照无矛盾

* **Notes**: 输出《R2.3 业务数据契约说明》（evaluate/totals/BpRecord/六 store/纯函数字段与分级、measureFreqAdvice、recentFavorites、recognize 错误码）；不得改 http.ts/auth.ts/router/storage.ts/account.ts 与任何 views。

## Task 13a: 登录注册（含验证码）+ 首次引导重构（Wave F，TS）

* **Status**: `pending`

* **Priority**: high

* **Depends On**: Task 12a、Task 12b（Wave F 闸门）

* **拥有文件**：src/views/Login.vue、src/views/Onboarding.vue、src/views/onboarding/（删 DiabetesStep.vue；本目录全部）

* **Description**:

  * **Login.vue（R2.3）**：顶部两个大 tab——**默认"验证码登录"**，次为"密码登录"（内含注册卡切换）；验证码 tab：大号手机号+6 位数字码（inputmode numeric、自动分段样式）、"获取验证码"60 秒中文倒计时（不可重复点）、mock 发码后明示"演示模式，验证码 123456"（自动填入）、错误码/过期中文提示、loading 防连点；密码 tab：手机号+密码登录、注册入口（手机号+密码+昵称）、错误分支（已注册/密码错/账号不存在/校验）；一键体验大按钮保留；全部只调 auth store（sendSmsCode/loginBySms/login/register/demoLogin），不碰 localStorage；小字按 mock/真实模式区分。

  * Onboarding：删糖尿病步骤；步骤 健康状况→基本信息→饮食与习惯→完成；高血压三分支/红旗/免责/病历仅本机保留；饮食步删甜食、**增"肾不好/需控钾（含低钠盐）"三选一大按钮（有/没有/不清楚，默认 null）**；隐私说明按 mock/真实换词；Summary 去血糖，保留"别自行停药"，新增家庭 135/85 科普、**renalKRestriction=有的控钾/低钠盐建议、年龄≥80 目标遵医嘱建议**。

  * SFC lang=ts、props/emits 类型化；焦点管理与数字键盘按 NFR-2；vue-tsc 本域 0 error。

* **Acceptance Criteria Addressed**: AC-28（登录 UI）、AC-29、AC-30、AC-31、AC-45

* **Test Requirements**:

  * `rule` TR-13a.1：验证码登录（老号/新号自动建号/错误码/倒计时/演示码明示）+密码登录注册四类失败+一键体验全部走通

  * `rule` TR-13a.2：引导五路径（有含病历/无/问卷三档/红旗/跳过）走通；画像无血糖字段、renalKRestriction 三态正确

  * `rubric` TR-13a.3：引导适老化品质 ≥4（AC-33）

## Task 13b: 我的（画像）页重构（Wave F，TS）

* **Status**: `pending`

* **Priority**: high

* **Depends On**: Task 12a、Task 12b（Wave F 闸门）

* **拥有文件**：src/views/Profile.vue、src/views/profile/ 全部

* **Description**:

  * ProfileFormCard 删糖尿病/甜食字段、**增控钾三选项（保存后结果页/DASH/食谱即时联动）**；AssessmentSummaryCard/assessmentText 仅按 htnStatus；新增"血压记录"卡（formatRelTime 相对时间、readings 均值与时段、单条删除走 bpLog api、空态引导）；服药开关与 medication store 单一对接；DangerZone 重置文案明确"只清当前账号"，调 ns 重置当前命名空间（含 bpLog/meds，留画像）；退出登录调 auth store logout。

  * SFC lang=ts、props/emits 类型化；vue-tsc 本域 0 error。

* **Acceptance Criteria Addressed**: AC-34（删除入口）、AC-35

* **Test Requirements**:

  * `rule` TR-13b.1：记录列表/删除/服药开关/重置（仅当前账号）/退出五行为与 store 契约一致

  * `rule` TR-13b.2：控钾选项保存后 buildRules/buildDashProgress 输出联动正确（读 store 验证，不进其他页面改文件）

  * `rubric` TR-13b.3：我的页适老一致性 ≥4

## Task 14: 结果页重构（Wave F，TS）

* **Status**: `pending`

* **Priority**: high

* **Depends On**: Task 12a、Task 12b（Wave F 闸门）

* **拥有文件**：src/views/Result.vue、src/views/result/（删 MealGlucoseChart.vue，新建 NaBudgetChart.vue）

* **Description**:

  * 四卡（热量/钠重点/蛋白/钾）；NaBudgetChart：约值文案、钠柱 800 分段、800"演示参考线"、占 2000 百分比大字、**食盐当量（÷400，一天不超 5g）**、钾条 3600 标"努力目标"+ CKD/普利沙坦安全灰字（**含"补钾片、低钠盐别自己买来吃"**）、演示角标；**renalKRestriction=true 时钾条不渲染"再补一点"引导，灰字升级为"按您的情况，富钾食物和低钠盐都要控制"醒目提醒**。

  * RulesPanel 走新 buildRules（无 GL、**控钾画像无补钾类规则**）；TTS 文案=评分+钠规则+减盐替换（控钾画像不播补钾）；心率/焦虑横幅、免责保留；chips 减盐 DASH（控钾画像不推高钾替换项）；3 食谱卡；SaveMealPopover 两分支（普通/采纳低钠搭配 suggestedItems，落库走 meals api，无 gl）。

  * 宽屏左右分栏、窄屏堆叠；草稿缺失跳首页；lang=ts。

* **Acceptance Criteria Addressed**: AC-6、AC-7、AC-8、AC-9、AC-10、AC-11、AC-18

* **Test Requirements**:

  * `rule` TR-14.1：场景1红/场景5绿；百分比、盐当量、钾条与 totals 一致；安全提示（含补钾片/低钠盐）可见；控钾画像下钾条/规则/chips 三处理正确；无血糖字样

  * `rule` TR-14.2：两分支保存经 api 落库（mock 存储可验证），采纳餐 na 显著更低

  * `rubric` TR-14.3：结果页适老信息架构 ≥4

## Task 15a: 首页重构（拍照识别流/手动记一餐/DASH/服药卡/测量提示）（Wave F，TS）

* **Status**: `pending`

* **Priority**: high

* **Depends On**: Task 12a、Task 12b（Wave F 闸门）

* **拥有文件**：src/views/Home.vue、src/views/home/ 全部（含新增 DashTodayCard.vue、MedicationCard.vue、BpMeasureNudgeCard.vue、ManualMealSheet.vue 及既有拍照/确认区组件）

* **Description**:

  * 拍照流（FR-3/4/49）：拍照/相册→`prepareMealImage`（utils/image.ts，Task 11 已建）→recognize api（mock 五场景/真实 multipart）；loading 可取消；**三级降级 UI**——超时"没连上，再试一次"保留图重试；422"这张没认出来，手动选一下也一样"进确认区；404/未部署无缝走 mock；确认区保留删除/三档分量/手动加菜，搜索走 searchFoods，修正后进结果页按修正内容评估。

  * **"不拍照，手动记一餐"等宽次级大按钮**：空确认区+手动加菜，getRecentFavorites 一键带入最近常吃，保存/评估流程与拍照一致。

  * DASH 卡（buildDashProgress 四维、盐当量、富钾/蛋白安全提示含补钾片/低钠盐、无餐引导；renalKRestriction=true 富钾维度渲染"遵医嘱控钾"中性态）；服药卡（显隐条件、打卡/已服时间/连续天数/撤销、"别补双倍"灰字、断签不惩罚、时间用 formatRelTime）；**测量轻提示卡**：当天缺 morning/evening 记录时"今天早起后/睡前的血压还没记"，记录后消失（数据读 bpLog store）；餐前状态/语音能力保留且无血糖词。

  * SFC lang=ts；数字输入 inputmode；SFC 行数 ≤600（超了按子组件拆）；vue-tsc 本域 0 error。

* **Acceptance Criteria Addressed**: AC-3/4/5（R2 改造部分）、AC-35、AC-36、AC-44、AC-47（测量提示/相对时间）

* **Test Requirements**:

  * `rule` TR-15a.1：识别成功/超时/422/404 四分支可复演（mock 开关或拦截），手动加菜修正后结果数值与纯函数一致；手动记一餐全流程走通

  * `rule` TR-15a.2：服药卡与 DASH 卡符合 AC-35/36（含 renal 中性态）；测量提示缺/有两态正确

  * `rubric` TR-15a.3：首页适老品质 ≥4

## Task 15b: 健康页 + 设备页重构（血压卡/录入弹层适老化）（Wave F，TS）

* **Status**: `pending`

* **Priority**: high

* **Depends On**: Task 12a、Task 12b（Wave F 闸门）

* **拥有文件**：src/views/Health.vue、src/views/health/ 全部（删 GlucoseCard.vue；BpCard 大改；新增 BpEntryDialog.vue、EmergencyPanel.vue）、src/views/Devices.vue

* **Description**:

  * Health 5 卡；BpCard 置顶放大：135/85 markLine 与诊室口径解释、四级着色（classifyBp）、设备+手动合并序列（source/symbol/tooltip，时间 formatRelTime）、当周 ≥180/120 急诊条（EmergencyPanel：**红旗症状→tel:120"立即拨打 120"大按钮+"别自己开车去"；无不适复测仍高→深橙"尽快联系医生，别自己加药"**）。

  * BpEntryDialog：测量规范灰字（含**双臂首测句**、高龄脚注）；收缩/舒张/hr 为大字数字输入（inputmode numeric）+**大号步进按钮（BP ±2/hr ±1）**，默认带出 bpLog.lastRecord（无则 120/80）；第一次+第二次选填（均值、差>10 提示第三测）；范围 70–260/40–160（<90/60 偏低可保存，提示含"服降压药别自行停药"）；hr<50 洛尔类灰字不拦截；时段（服药前解释）；保存走 bpLog api；保存后黄/橙/红/低四级提示；弹层焦点陷阱+Esc；断连可录。

  * 其余 4 卡保留并入手动 hr；Devices 4 设备删 CGM，开关经 devices api 收口。

  * vue-tsc 本域 0 error。

* **Acceptance Criteria Addressed**: AC-12、AC-13、AC-14、AC-34、AC-47（步进/tel/焦点）

* **Test Requirements**:

  * `rule` TR-15b.1：AC-34 全分支（校验/步进±2±1/带出上次/双读数/四级提示含急症两分支/低心率/双臂句/高龄脚注/合并/删除/断连）逐一通过

  * `rule` TR-15b.2：设备仅 4 项、无血糖残留；tel:120 href 正确；键盘焦点不跑出弹层

  * `rubric` TR-15b.3：血压卡主角视觉与整页适老品质 ≥4

## Task 16: 周报与食谱页重构（含"给医生看"导出）（Wave F，TS）

* **Status**: `pending`

* **Priority**: high

* **Depends On**: Task 12a、Task 12b（Wave F 闸门）

* **拥有文件**：src/views/Weekly.vue、src/views/weekly/（删 GlBarChart.vue；新增 BpSummaryPanel.vue、DashWeekPanel.vue、**BpPrintView\.vue**）、src/views/Recipes.vue、src/views/recipes/RecipeDrawer.vue

* **Description**:

  * Weekly：NaBarChart（800/2000 参考线）+ ScoreLineChart 两图；BpSummaryPanel 按 buildWeeklyBp 渲染：晨起/晚间 7 天均值（家庭口径标识）、晨峰标注、最高值、≥135/85 天数（非诊断措辞）、手动次数；结论三分支（平稳/偏高带记录就医/急症 120）+ 钠联动 + **measureFreqAdvice 测量频率建议（未稳连续 7 天早晚/稳定后每周 1–2 天）**；面板放\*\*"打印 / 存成 PDF 给医生看"大按钮\*\*；DashWeekPanel 达标天数与四维周均；饮食分三维；零餐次空态（血压面板仍显示）。

  * **BpPrintView（FR-51，不新增路由、不改 router/index.ts）**：挂在 Weekly 内的全屏覆盖层组件（v-if 切换），一页：姓名/年龄/区间、早晚均值、最高值、≥135/85 天数、手动次数、每日明细表（日期/时段/均值/心率/来源，时间口语化）、服药打卡天数、"家庭自测记录，供医生参考，不代替诊室测量"声明；组件内含非 scoped 的 `@media print` 样式（打印时隐藏 app 壳、仅显示该视图，零依赖不新增全局样式文件）；进入即准备好、按钮调 `window.print()`，取消返回不丢 Weekly 状态；无血糖字段。

  * Recipes：6 标签（全部/低钠/高钾/高蛋白/易咀嚼/DASH 推荐）；?id= 抽屉保留；抽屉营养去 GL/GI，富钾食谱带补钾安全提示（含补钾片/低钠盐）；**renalKRestriction=true 时高钾食谱抽屉顶部显示控钾提醒，且"高钾"标签不作推荐高亮**。

* **Acceptance Criteria Addressed**: AC-15、AC-16、AC-36、AC-37、AC-46

* **Test Requirements**:

  * `rule` TR-16.1：面板五数字与手算一致；三结论分支+两钠分支+两测量频率建议可构造

  * `rule` TR-16.2：六标签均有命中；抽屉无 GL；resize 正常

  * `rule` TR-16.3：打印预览要素齐全、数字与 buildWeeklyBp 一致、390px 不溢出、无血糖字段（AC-46）

  * `rubric` TR-16.4：两页适老一致性 ≥4

## Task 17: R2.3 集成收口、门禁与多线回归（Wave G，1 主编排 + 3 浏览器子 agent）

* **Status**: `pending`

* **Priority**: high

* **Depends On**: Task 13a、13b、14、15a、15b、16

* **Description**:

  * 主编排：全量 prettier 一次 + `npm run ci` 全绿（vue-tsc/eslint/vitest/build；manualChunks 后无 >500KB 警告）；行数扫描；删除废弃文件（DiabetesStep/MealGlucoseChart/GlucoseCard/GlBarChart）并确认无残留 import；血糖残留白名单（仅 foods 的 gi、spec/历史注释）；allowJs 兜底确认移除；**Wave E-1 合并闸门复验**（12a/12b 合并后 vue-tsc+vitest 全绿）；六 agent 文件域冲突复查。

  * README 更新：TS/测试/CI、npm run ci、mock 切换与 VITE\_API\_BASE\_URL、设备 4 项、无血糖、血压家庭口径/四级提示/测量频率、mock 两新键与对应端点、**多账号（密码+验证码登录/uid 隔离/demo 独立/token 鉴权）、真实识别开关与降级行为、给医生看打印**、链接 api-contract.md；复核契约文档（auth 6 端点含 sms、recognize multipart）与代码一致性。

  * **浏览器子 agent 1·账号与识别线（AC-28/43/44/45）**：注册 A→引导（含控钾问题）→造数据（1 餐\[含一次手动记一餐]+1 血压+1 打卡）→退出→注册 B 造不同数据→分别重登 A/B 零串读→demo 三方隔离→A 重置 B 完好→ndh\_accounts 无明文密码、业务键带 uid；验证码登录（默认 tab/123456/倒计时/新号自动建号/错误码）；识别四分支（成功/超时/422/404，Network 验证 multipart 压缩图+Bearer）。

  * **浏览器子 agent 2·临床适老主线（AC-34/35/36/37/46/47）**：确诊主流程（首页两新卡→重盐场景→四卡+钠预算+chips+TTS→两分支保存→健康五卡+血压录入：146/93、166/102、182/112（急症两分支+tel:120）、88/56、双读数、心率 46、步进±2±1/带出上次/双臂句/高龄脚注/断连→周报三分支+频率建议+给医生看打印预览+DASH→食谱（控钾画像抽屉提醒）→我的删除/服药关闭/重置）；问卷三分支+红旗+跳过；相对时间/测量提示/a11y 焦点走查/reduced-motion。

  * **浏览器子 agent 3·视觉兼容与脏数据线（AC-19/24/25/26/27/38）**：1440/1024/390 三宽度全路由截图；适老 rubric 打分；旧脏数据（gl/t2dStatus/无命名空间裸键）容错无 console error；血糖零残留全仓检索。

  * 子 agent 只验证与截图，不改代码；问题按文件域回派 Wave F 对应任务修复后重验；补全部 R2.3 任务 evidence 并置 completed。

* **Acceptance Criteria Addressed**: AC-1、AC-19、AC-22、AC-23、AC-28、AC-38、AC-39、AC-40、AC-41、AC-42、AC-43、AC-44、AC-45、AC-46、AC-47、AC-24/25/26/27

* **Test Requirements**:

  * `rule` TR-17.1：`npm run ci` exit 0；行数/残留/契约/分包四项审查通过

  * `rule` TR-17.2：账号识别线、临床适老线、兼容脏数据线三线证据齐全且无 console error；双账号隔离、识别四分支、打印预览、a11y 走查逐项有证据

  * `rule` TR-17.3：README（多账号/真实识别/打印章节）与契约文档同步完整

  * `rubric` TR-17.4：R2.3 后答辩演示完成度 ≥4

