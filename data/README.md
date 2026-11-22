# 原卷与逐题数据

## 来源

- 数学：https://github.com/deekur/gaokaomath （CC BY 4.0）
- 物理：https://github.com/deekur/gaokaophysics （CC BY-NC 4.0，勿用于商业用途）

原 PDF 仍保留在来源仓库，本站不重复托管 PDF，仅保存试卷元数据与自动结构化文本。

## 文件

- gaokao*.papers.json：完整试卷清单，含 track、year、subject、原始路径和字节数。
- gaokao*.questions.index.json：每卷题数、文本页/OCR 页、待校对数及逐题 JSON 地址。
- public/data/questions/*.json：按卷拆分的逐题数据，浏览器选卷后才加载。

## 质量边界

每题的 provenance 记录原仓库、paperId、起始页、原题号、提取方式、OCR 置信度与 needsReview。OCR 题、低置信度题、跳号题及内容过短题均标记待校对；原卷是最终核对依据。

自动结构化不等于人工校对。未从原卷可靠提取标准答案时，answer 和 analysis 明确写为未提供，不得编造为官方答案。AI 引导与 AI 解析由 Pollinations 公共文本接口生成，只应用于公开试题，不发送用户私密数据。

本站无 /admin。数据在本地通过 MuPDF 与 Tesseract.js 批量生成，随后由 Next.js 静态构建发布。
