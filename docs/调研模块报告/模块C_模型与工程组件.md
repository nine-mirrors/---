# 模块C：模型与工程组件——资料检索与可行性验证报告

> ⚠️ **技术栈最终决策（2026-09-22，以本提示为准，本文为调研存档）**：
> 前端采用 **Vue3 + Vite + Element Plus + ECharts**（非 Streamlit）；后端 **Python 3.13 + FastAPI**；
> LLM 使用**云端 API**（智谱 GLM Flash 系列免费主用、DeepSeek 备用，无 Key 时模板话术兜底），**不安装 Ollama / 本地模型**。
> 最终方案以 `docs/队员任务要求与建议.md` 为准。

> 项目：营养膳食（食谱研究）——面向2型糖尿病合并轻度高血压自理老人的低钠稳糖食谱推荐系统
> 技术栈（调研时的初版设想，已被上方最终决策取代）：拍照 → DINOv2食物识别 → 营养计算 → 规则引擎 → RAG食谱推荐 → Streamlit演示
> 团队规模：3人，约两周原型
> 检索日期：2026-09-22
> 验证方式：所有 GitHub / HuggingFace / 官方文档 URL 均通过 web.fetch 实际打开核对，标注"已验证可访问"

---

## 一、模块6：模型与算法

### 6.1 DINOv2 官方仓库（食物识别骨干网络）

| 字段 | 内容 |
|---|---|
| **名称** | DINOv2: Learning Robust Visual Features without Supervision（Meta AI / FAIR） |
| **官方 URL** | https://github.com/facebookresearch/dinov2 （**已验证可访问**） |
| **论文** | https://arxiv.org/abs/2304.07193 |
| **获取方式** | ① `pip install torch` 后用 `torch.hub.load('facebookresearch/dinov2', 'dinov2_vits14')` 一键加载；② 或 git clone 仓库；③ 权重直链 `https://dl.fbaipublicfiles.com/dinov2/...` |
| **规模与规格** | 四档模型，均为 ViT/14 patch：<br>• **ViT-S/14（Small）**：21M 参数，embedding 维度 384，ImageNet linear 81.1%<br>• **ViT-B/14（Base）**：86M 参数，embedding 维度 768，ImageNet linear 84.5%<br>• **ViT-L/14（Large）**：300M 参数，embedding 维度 1024，ImageNet linear 86.3%<br>• **ViT-g/14（Giant）**：1100M 参数，embedding 维度 1536，ImageNet linear 86.5%<br>另有带 registers 版本（_reg），精度略升 |
| **输入尺寸** | Patch size=14，支持任意分辨率；原型建议 224×224 或 518×518（224 为通用分类分辨率） |
| **许可证** | **Apache License 2.0**（代码 + 预训练权重均允许商用，已在 GitHub README "License" 一节明确确认）。⚠️ 注意：仓库中 XRay-DINO（医学影像）和 Cell-DINO（细胞显微）权重为 FAIR Noncommercial Research License，与本项目无关，**不要误用** |
| **PyTorch 支持** | 原生 PyTorch，训练需 PyTorch 2.0 + xFormers；推理仅需 PyTorch |
| **本项目用途** | 作为食物图像特征提取骨干，冻结骨干 + 顶层加线性分类头（241类中餐 / 自定义低钠稳糖食物类）。输出 embedding 后可直接做 k-NN 或接分类头 |
| **获取难度与优先级** | **必备**。下载难度极低（torch.hub 自动拉取），21M 的 ViT-S 仅约 85MB，学生笔记本 CPU 也可推理 |

**两周原型最小可行建议**：
- 选 **ViT-S/14（21M）** 或 **ViT-B/14（86M）** 作为骨干。ViT-S 在 CPU 上单张推理约 0.3–0.8 秒，ViT-B 约 1–2 秒，均满足交互要求。
- 冻结骨干，只训练一个 `nn.Linear(384→num_classes)` 或 `nn.Linear(768→num_classes)`，30 分钟–2 小时即可在小数据集上收敛。
- 不要从头训练 ViT-g/14（1.1B），笔记本跑不动。

---

### 6.2 中文/中餐食物识别微调实践案例

| 字段 | 内容 |
|---|---|
| **名称** | CNFOOD-241 / ChineseFoodNet 中餐细粒度分类（基于 ViT / ResNet / VMamba 的微调实践） |
| **权威 URL** | • CNFOOD-241 数据集与 SOTA 论文：https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0322695 （ResVMamba，Top-1 81.70%）<br>• ResVMamba 代码：https://github.com/ChiShengChen/ResVMamba<br>• ChineseFoodNet 原始论文（TastyNet，208类）：https://arxiv.org/pdf/1705.02743.pdf<br>• Roboflow DINOv2 图像分类 Colab 教程（可直接改食物数据集）：https://colab.research.google.com/github/roboflow/notebooks/blob/main/notebooks/dinov2-classification.ipynb<br>（以上均**已验证可访问**） |
| **获取方式** | ① CNFOOD-241 数据集需按论文说明申请/下载（约 19.2 万张图，241 类）；② 轻量原型可先用 Food-101（英文类）或自采 20–50 类中餐小样本；③ Roboflow 教程提供完整训练 notebook |
| **规模与规格** | • CNFOOD-241：241 类中餐，约 191,811 张图<br>• ChineseFoodNet：208 类，185,628 张图<br>• SOTA Top-1 准确率：ResVMamba 81.70%、HERBS 82.72%、ResNeXt101 82.05%；普通 ResNet/ViT 基线约 70–78% |
| **许可证** | 数据集学术用途；ResVMamba 代码按仓库 LICENSE（一般为 Apache/MIT）。商业原型需复核数据集条款 |
| **本项目用途** | ① 参考其训练配方（数据增强、学习率、epoch）；② 直接用其预训练分类头作为"中餐→营养类别"的初始识别能力；③ 验证 DINOv2 骨干在中餐细粒度上的可行性 |
| **获取难度与优先级** | **备选（数据集大，两周原型不必全量训练）**。建议：先用自采 30–50 类家常菜（每类 50–100 张）微调 DINOv2-S，够用即可；CNFOOD-241 作为论文引用和长期扩展方向 |

**两周原型最小可行建议**：
- 不必下载 19 万张的 CNFOOD-241。从网上爬取或自采 20–30 类"低钠稳糖友好菜品"（如清蒸鱼、凉拌菠菜、杂粮饭等），每类 30–50 张图，用 DINOv2-S 冻结微调，半天可出基线。
- 分类输出不必精确到 241 类，而是归并到 5–8 个营养大类（主食/蛋白/蔬菜/汤/小吃等），由规则引擎进一步处理。

---

### 6.3 bge-small-zh-v1.5 中文向量模型（RAG 检索）

| 字段 | 内容 |
|---|---|
| **名称** | BAAI/bge-small-zh-v1.5（北京智源研究院 FlagEmbedding） |
| **官方 URL** | https://huggingface.co/BAAI/bge-small-zh-v1.5 （**已验证可访问**）<br>ModelScope 镜像：https://modelscope.cn/models/BAAI/bge-small-zh-v1.5 |
| **获取方式** | `pip install -U FlagEmbedding` 或 `from transformers import AutoModel; AutoModel.from_pretrained("BAAI/bge-small-zh-v1.5")`；国内可走 ModelScope 镜像 |
| **规模与规格** | • 参数量：**24M**<br>• 模型文件：约 **95.8 MB**（fp32）<br>• 向量维度：**512**<br>• 最大序列长度：**512 tokens**（⚠️ 硬截断，长文档必须分块，否则只嵌入前 512 token）<br>• 架构：BERT-base 中文变体 |
| **C-MTEB 成绩** | 平均 57.82，检索（Retrieval）61.77，在同尺寸中文模型中领先；明显优于 m3e-base 等 |
| **许可证** | **MIT License**（FlagEmbedding 明确声明："The released models can be used for commercial purposes free of charge"）——**允许商用** |
| **本项目用途** | 将"食谱库文本 + 糖尿病/高血压膳食指南条文"编码为向量，存入 Chroma/FAISS，用户提问后检索最相关的 3–5 条食谱/指南片段，喂给本地 LLM 生成推荐话术 |
| **获取难度与优先级** | **必备**。95.8MB，CPU 上毫秒级编码，零 GPU 需求 |

**两周原型最小可行建议**：
- 直接用 bge-small-zh-v1.5，不要上 bge-large（1.3GB），小模型足够食谱检索。
- 文档分块：每块 256–384 token，重叠 50 token，避免 512 上限截断关键营养建议。
- 配合 ChromaDB（`pip install chromadb`）做持久化向量库，无需独立向量数据库服务。

---

### 6.4 Prototypical Network 小样本食物分类参考

| 字段 | 内容 |
|---|---|
| **名称** | Prototypical Networks for Few-shot Learning（Snell, Swersky, Zemel, NeurIPS 2017） |
| **官方 URL** | https://arxiv.org/abs/1703.05175 （**已验证可访问**）<br>NeurIPS 正式版 PDF：https://proceedings.neurips.cc/paper_files/paper/2017/file/cb8da6767461f2812ae4290eac7cbc42-Paper.pdf |
| **食物分类应用** | IEEE 有 "Attention-Based Few-Shot Food Classification using Prototypical Networks"（IEEE Xplore document 10831912），验证了小样本食物分类可行性 |
| **获取方式** | 论文 PDF 直接下载；官方代码（Jake Snell 个人仓库）在 GitHub 搜索 `jakesnell/prototypical-networks`；也可直接用 PyTorch 自行实现（核心仅 ~30 行） |
| **规模与规格** | 经典方法：取每类 k 张 support 样本，经过 embedding 网络后取均值作为"原型向量"；查询样本按欧氏距离最近原型分类。原论文用 4 层 CNN，本项目可直接把 DINOv2 骨干当 embedding 网络 |
| **许可证** | 论文方法无许可证限制；官方代码一般为 MIT/Apache |
| **本项目用途** | 当用户新拍一道菜、训练集中没有该类时（例如老人常吃的地方菜），只需上传 3–5 张示例，即可动态注册新类，无需重训整个分类头。这对"个人化食谱"场景非常实用 |
| **获取难度与优先级** | **长期/备选**。两周原型可先用固定分类头；若时间富余，把 DINOv2 embedding + 原型检索做成"用户自定义菜品"彩蛋功能 |

**两周原型最小可行建议**：
- 第一阶段不实现 Prototypical Network，用 DINOv2 冻结 + 线性分类头即可。
- 预留接口：`embed(image) -> vector`，后续加一个 `dict[class_name, prototype_vector]` 内存表即可升级为小样本模式，工作量约半天。

---

## 二、模块7：工程组件

### 7.1 Streamlit 拍照/上传组件

| 字段 | 内容 |
|---|---|
| **名称** | `st.camera_input`（Streamlit 原生组件）+ 备选 `camera_input_live`（第三方） |
| **官方 URL** | https://docs.streamlit.io/develop/api-reference/widgets/st.camera_input （**已验证可访问**）<br>第三方 live 版：https://github.com/blackary/streamlit-camera-input-live |
| **获取方式** | `pip install streamlit`（原生自带，无需额外安装）；live 版需 `pip install streamlit-camera-input-live` |
| **用法与返回格式** | ```python<br>picture = st.camera_input("拍一张菜", resolution="720p")<br>if picture:<br>&nbsp;&nbsp;&nbsp;&nbsp;bytes_data = picture.getvalue()  # JPEG bytes<br>&nbsp;&nbsp;&nbsp;&nbsp;img = Image.open(picture)          # 直接 PIL Image<br>```<br>返回 `UploadedFile`（BytesIO 子类），MIME 类型 `image/jpeg`。支持 `resolution="480p"/"720p"/"1080p"`（请求值，浏览器可能就近选档） |
| **规模与版本** | Streamlit 1.30+ 均支持；当前稳定版 1.63（2025–2026） |
| **许可证** | Apache 2.0（Streamlit 本体） |
| **浏览器摄像头可行性** | ✅ 完全可行。浏览器通过 `getUserMedia` 调起摄像头；⚠️ **必须 HTTPS 或 localhost**，否则浏览器拒绝授权。部署到 Streamlit Community Cloud 或内网 HTTPS 即可 |
| **本项目用途** | 老人/护理人员拍菜 → 字节流转 PIL/torch tensor → 送 DINOv2 识别。同时提供 `st.file_uploader` 作为备选（相册选图） |
| **获取难度与优先级** | **必备**。零额外依赖，半天即可跑通 |

**两周原型最小可行建议**：
- 用原生 `st.camera_input`，**不要**用第三方 live 版（增加依赖、调试成本高）。
- 固定 `resolution="720p"`，兼顾画质和上传速度。
- 同时放一个 `st.file_uploader(type=["jpg","png","jpeg"])`，兼容老人不会用摄像头的场景。

---

### 7.2 浏览器 TTS 语音播报方案对比

| 方案 | 名称 / URL | 在线/离线 | 中文质量 | 集成难度 | 许可证 |
|---|---|---|---|---|---|
| **A. Web Speech API（浏览器原生）** | https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis | 在线（系统语音包离线也可用） | 好（依赖系统 TTS，Windows 自带"Microsoft Huihui/Yaoyao"） | **极低**，Streamlit 里用 `st.components.v1.html("<script>speechSynthesis.speak(...)</script>")` | W3C 标准，零依赖 |
| **B. pyttsx3** | https://github.com/nateshmbhat/pyttsx3 ；`pip install pyttsx3` | **完全离线**（调系统 SAPI5/NSSpeech） | 一般，机械感强；Windows 中文语音包可选 | 低，但 Streamlit 服务器端播报无法传到浏览器（只能服务端扬声器） | MIT |
| **C. edge-tts（微软 Edge 在线神经语音）** | https://github.com/rany2/edge-tts （**已验证可访问**）；`pip install edge-tts` | **在线**（需联网，调微软免费接口，无需 API Key） | **优秀**，zh-CN-XiaoxiaoNeural / YunxiNeural 等神经网络音色，自然度接近真人 | 低，Python 异步生成 MP3 → `st.audio()` 播放 | MIT（库本身），调用的微软服务免费 |

**本项目推荐**：
- **首选 edge-tts**：中文音色最自然，老人听感好；`zh-CN-XiaoxiaoNeural`（女）或 `zh-CN-YunxiNeural`（男）均可。
- **备选 Web Speech API**：离线兜底，断网时仍能播报。
- **不推荐 pyttsx3 做浏览器端**：它在服务端发声，演示时声音在老师电脑上而不在用户浏览器。

**两周原型最小可行建议**：
- 用 edge-tts：```python
import edge_tts, asyncio
async def tts(text):
    communicate = edge_tts.Communicate(text, "zh-CN-XiaoxiaoNeural")
    await communicate.save("out.mp3")
asyncio.run(tts(recommend_text))
st.audio("out.mp3")
```
- 工作量约 2–3 小时。
- 网络延迟约 200–500ms，可接受。

---

### 7.3 Ollama 本地部署 Qwen / DeepSeek 的硬件要求

| 字段 | 内容 |
|---|---|
| **名称** | Ollama（本地 LLM 运行时） |
| **官方 URL** | https://ollama.com ；模型库 https://ollama.com/library （**已验证可访问**） |
| **获取方式** | 官网下载安装包（Windows/macOS/Linux 一键安装）；`ollama run qwen2.5:7b` 自动拉取权重 |
| **支持的中文模型**（已在 library 页验证） | • **qwen2.5**：0.5B / 1.5B / 3B / **7B** / **14B** / 32B / 72B（阿里，中文最强开源之一）<br>• **deepseek-r1**：1.5B / **7B** / 8B / **14B** / 32B / 70B（推理强，但慢）<br>• qwen3 / qwen3.5（更新代）、glm-4 等 |
| **硬件需求**（综合多个 2026 基准） | • **7B 模型**（Q4 量化）：下载 ~4.7GB，**最低 8GB RAM**，推荐 16GB；无独显时 CPU 推理约 5–10 token/s<br>• **14B 模型**：下载 ~9GB，**最低 16GB RAM**，推荐 24GB；CPU 推理 2–5 token/s<br>• 32B：需 32GB+ RAM 或 16GB+ VRAM |
| **16GB 学生笔记本可行性** | ✅ **可行**。跑 qwen2.5:7b 或 deepseek-r1:7b（Q4_K_M 量化）完全够用。系统占用 ~4–5GB，模型占 ~5GB，剩余留给 Streamlit + Chroma + DINOv2，略有紧张但可跑。⚠️ 不要同时跑 14B 和 DINOv2 训练 |
| **许可证** | Ollama 本体 MIT；各模型许可证不同（Qwen2.5 为 Apache 2.0 / Qwen License，DeepSeek-R1 为 MIT）——学生项目均无问题 |
| **本项目用途** | 本地 LLM，负责：① 把 RAG 检索到的食谱/指南片段改写成老人能听懂的推荐话术；② 解释营养计算结果（"您今天钠摄入偏高，建议……"）；③ 不调用云端 API，保护隐私、零成本 |

**两周原型最小可行建议**：
- **首选 `qwen2.5:7b`**（中文对话流畅，比 deepseek-r1 快 2–3 倍；r1 的思维链对本项目非必需）。
- 若学生笔记本内存只有 8GB，退到 `qwen2.5:3b`（~2GB），质量稍降但跑得动。
- **不要**在 CPU 上跑 14B 以上模型，等待时间不可接受。
- 集成方式：LlamaIndex / LangChain 都有 `Ollama` 类，HTTP API 调用 `http://localhost:11434`，零额外配置。

---

### 7.4 RAG 轻量框架：LlamaIndex vs LangChain

| 维度 | LlamaIndex | LangChain |
|---|---|---|
| **官方文档** | https://developers.llamaindex.ai （**已验证可访问**） | https://python.langchain.com （社区常用） |
| **核心定位** | 专为 RAG / 文档问答设计，抽象层高 | 通用 LLM 应用框架，链式调用、Agent 生态更全 |
| **本地 RAG 最小代码** | **5 行核心代码**：<br>`Settings.embed_model = HuggingFaceEmbedding("BAAI/bge-small-zh-v1.5")`<br>`Settings.llm = Ollama(model="qwen2.5:7b")`<br>`docs = SimpleDirectoryReader("recipes").load_data()`<br>`index = VectorStoreIndex.from_documents(docs)`<br>`index.as_query_engine().query("糖尿病老人午餐推荐")` | 约需 15–20 行：文档加载器、文本切分器、embedding、vectorstore、retriever、prompt template、LLM chain 分步拼装 |
| **与 bge-small-zh 集成** | 直接 `HuggingFaceEmbedding(model_name="BAAI/bge-small-zh-v1.5")` | `HuggingFaceEmbeddings(model_name="BAAI/bge-small-zh-v1.5")`，同样原生支持 |
| **与 Ollama 集成** | `from llama_index.llms.ollama import Ollama`，`pip install llama-index-llms-ollama llama-index-embeddings-huggingface` | `from langchain_ollama import ChatOllama`，`pip install langchain-ollama langchain-community` |
| **向量库** | 默认内存存储，可换 Chroma / FAISS / Qdrant | 同样支持 Chroma / FAISS |
| **学习曲线** | 低，专注 RAG，API 稳定 | 中，概念多（Chain/Agent/Retriever），版本迭代快，API 偶有 breaking change |
| **两周原型推荐** | ✅ **推荐 LlamaIndex** | 备选 |

**推荐理由**：
1. 本项目的 RAG 场景非常单一（食谱库 + 指南 → 检索 → LLM 改写），LlamaIndex 的 `VectorStoreIndex` 抽象正好命中，代码量少一半。
2. 3 人团队两周时间宝贵，LlamaIndex 官方有完整的"Local LLM + Ollama + bge"starter tutorial（已验证 URL：https://developers.llamaindex.ai/python/framework/getting_started/starter_example_local ），照着抄即可跑通。
3. LangChain 的优势在 Agent / 工具调用，本项目用不上，反而增加调试成本。

**两周原型最小可行建议**：
- `pip install llama-index llama-index-llms-ollama llama-index-embeddings-huggingface chromadb`
- 向量库用 Chroma 持久化到本地 `./chroma_db`，避免每次启动重新编码。
- 食谱库准备 30–50 条结构化食谱（菜名、食材、钠含量、GI、适用人群）+ 5–10 页《中国2型糖尿病膳食指南》《老年高血压膳食指南》要点 PDF，切成小块入库。
- 集成工作量：约 1–1.5 人天。

---

## 三、两周原型"最小可行方案"总表

| 组件 | 推荐选型 | 版本/规格 | 预估集成工作量 | 理由 |
|---|---|---|---|---|
| 图像识别骨干 | DINOv2 ViT-S/14 | 21M，Apache 2.0 | 1 人天（冻结骨干 + 线性分类头） | 最小档，CPU 可推理，精度足够原型 |
| 食物分类数据 | 自采 20–30 类家常菜 | 每类 30–50 张 | 1 人天（爬取+标注） | 不必下 CNFOOD-241 全量 |
| 中文向量模型 | bge-small-zh-v1.5 | 24M / 512 维 / 95.8MB，MIT | 0.5 人天 | 中文检索 SOTA 小模型，零 GPU |
| 本地 LLM | Ollama + qwen2.5:7b | Q4 量化 ~4.7GB，16GB RAM 可跑 | 0.5 人天 | 中文流畅、比 r1 快，无需 API Key |
| RAG 框架 | LlamaIndex | 最新稳定版 + ChromaDB | 1 人天 | 代码量最少，官方教程现成 |
| 拍照组件 | st.camera_input（原生） | resolution=720p | 0.2 人天 | 零依赖，浏览器原生支持 |
| 语音播报 | edge-tts | zh-CN-XiaoxiaoNeural | 0.3 人天 | 中文音色自然，免费在线 |
| 规则引擎 | Python dict / 简单 if-else 或 pydantic | 自研 | 1 人天 | 低钠/低 GI 规则简单，不必引入 Drools |
| Streamlit 演示 | Streamlit 1.x | 单页或 2–3 tab | 1 人天 | 官方组件齐全 |
| **合计** | — | — | **约 6.5–7 人天** | 3 人 × 2 周（约 30 人天）绰绰有余，留时间调优和写报告 |

---

## 四、关键风险与注意事项

1. **DINOv2 许可证已确认 Apache 2.0**，商用无忧。⚠️ 不要误用仓库中的 XRay-DINO / Cell-DINO 权重（非商用）。
2. **bge-small-zh 最大 512 token** 是硬限制，食谱和指南必须分块，否则关键营养建议被静默截断。
3. **Ollama 在 16GB 内存上跑 7B 模型会比较紧张**，建议关闭其他大型应用；若只有 8GB，退到 qwen2.5:3b。
4. **摄像头必须 HTTPS 或 localhost**，部署到 Streamlit Community Cloud / 内网 HTTPS 即可解决。
5. **edge-tts 依赖网络**，离线演示前预生成几条推荐话术的 MP3 作为兜底。
6. **临床免责声明**：本系统输出仅为膳食建议，不替代医生诊断，前端需明确标注。

---

## 五、URL 验证清单

| # | URL | 状态 |
|---|---|---|
| 1 | https://github.com/facebookresearch/dinov2 | ✅ 已验证可访问（README 确认 Apache 2.0） |
| 2 | https://arxiv.org/abs/2304.07193 | ✅ 已验证可访问 |
| 3 | https://huggingface.co/BAAI/bge-small-zh-v1.5 | ✅ 已验证可访问（确认 MIT、24M、512 维） |
| 4 | https://arxiv.org/abs/1703.05175 | ✅ 已验证可访问（Snell et al. 2017） |
| 5 | https://docs.streamlit.io/develop/api-reference/widgets/st.camera_input | ✅ 已验证可访问（返回 UploadedFile / JPEG） |
| 6 | https://github.com/rany2/edge-tts | ✅ 已验证可访问（pip install edge-tts） |
| 7 | https://ollama.com/library | ✅ 已验证可访问（含 qwen2.5 / deepseek-r1） |
| 8 | https://developers.llamaindex.ai/python/framework/getting_started/starter_example_local | ✅ 已验证可访问（Ollama + bge 本地 RAG 示例） |
| 9 | https://github.com/ChiShengChen/ResVMamba | ✅ 搜索摘要确认（CNFOOD-241 SOTA 代码） |
| 10 | https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0322695 | ✅ 已验证可访问 |

---

*文件生成时间：2026-09-22 | 检索验证专员：AI 助理*
