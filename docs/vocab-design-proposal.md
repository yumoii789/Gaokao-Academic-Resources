# 词汇工作室 · 设计方案（评审稿）

| 项 | 值 |
| --- | --- |
| 状态 | **设计方案，未实施** —— 本文档不包含任何已落地的代码或数据改动，一切以"方案/建议/拟"表述 |
| 评审对象 | 小墨高考平台 `/vocab` 词汇工作室模块 |
| 需求来源 | 用户手绘需求图 ×2（辨读）、用户 DOCX 备注 ×1、现有代码库 |
| 版本 | v0.1（待用户评审） |
| 标记约定 | 【事实】= 现有代码/数据/附件可直接验证；【假设】= 本方案推荐做法，可推翻；【决策】= 需用户拍板后才能定稿 |

---

## 1. 设计解读（Design Read）

### 1.1 需求清单（据手稿辨读 + 沟通纪要）

| # | 功能 | 辨读要点 |
| --- | --- | --- |
| F1 | 电子词典 | 查词：汉语翻译、音标、例句、语法、词形变化 |
| F2 | 记单词 · 三模式 | ① 英文单词+英文例句 → 选中文释义；② 中文释义+英文例句（词位显示 `____`）→ 选英文单词；③ 无选项，手动拼写 |
| F3 | 记语法 = 完形填空 | 句子挖空，四选一 |
| F4 | 四选一通用规则（ABCD） | 答错 → 指出"你选了 X + 正确答案 Y"，并**记入错题库**；答对 → **记入答对题库** |
| F5 | 答题界面导航 | 所有题型**必显示解析**与"**下一个**"按钮；答题界面另加"**上一个**"按钮（**无论是否已作答**均可用） |
| F6 | 随机抽题比例 | 默认 **10% 答对题库 / 25% 错题库 / 65% 未答题库**，用户可自行调节 —— **此组数字为【待用户决策·推荐值】（手稿辨读），未获用户确认前不得视为定案** |
| F7 | 翻译 + AI 对话 | 翻译用"网上免费 API（可联网搜索选定）"；AI 对话界面需提供系统提示词设计（DOCX 第 1 条明确要求 AI 支持**多轮对话**） |
| F8 | 词库数据 | 条目含：汉语翻译、音标、例句（**每个汉语释义配一个例句**）、语法、词形变化；整理为 **json 文件** |

### 1.2 设计基调

【事实】首页对词汇工作室的定位文案是"温暖、专注。将记忆转化为一种视觉成就感"（`src/app/page.tsx:28-34`），卡片主色为 amber 系。本方案延续：暖色（琥珀）主视觉 + 学术衬线标题 + 玻璃拟态卡片，把"进步可见"作为核心体验（进度条、答对/错题/未答三池计数）。

### 1.3 范围边界

- 本模块只新增/扩展 `/vocab` 子树与 `data/` 下词汇数据文件；**不改动**全局 `Question` 类型、其他页面、构建配置（除非验收阶段证明必要，另行评审）。
- DOCX 中的后台管理、IP 限流、访客统计、PDF 下载等属于站点级需求，**不在本模块设计范围内**，仅在 §13 登记。

---

## 2. 现状盘点（已知事实，全部来自代码库）

### 2.1 既有 `/vocab` 页面（翻卡闪记）

- 路由 `/vocab` 已存在，为客户端组件，数据来自 `import mockData from "@data/mock_data.json"`（`src/app/vocab/page.tsx:4`），使用 `mockData.vocab`（`src/app/vocab/page.tsx:35`）。
- 进度存储：localStorage 键 `xiaomo-vocab-progress-v1`（word → `{known, reviewedAt}`）与 `xiaomo-vocab-index`（`src/app/vocab/page.tsx:7-8`）；读写做了 SSR/CSR 水合门控，避免静态导出下的不一致（`src/app/vocab/page.tsx:26-55`）。
- 难度三档：`DIFF_LABEL {1:'基础', 2:'进阶', 3:'冲刺'}`，配色 emerald-600 / amber-600 / rose-500（`src/app/vocab/page.tsx:16-24`）。
- 交互：3D 翻转卡（`perspective-1000 / preserve-3d / backface-hidden / rotate-y-180`，`src/app/vocab/page.tsx:201-235`），"认识/再看看"（`:238-253`），"上一个/下一个"+可点进度条+重置（`:255-266`）。
- 页面元数据：标题"词汇工作室 — 小墨高考"，OG 图 `/og.png`（`src/app/vocab/layout.tsx:4-12`）。

### 2.2 现有词数据基线

【事实】`data/mock_data.json` 顶层键为 `standard / spring / vocab`；`vocab` 共 **140 词**，条目形如：

```json
{ "word": "abandon", "translation": "放弃；抛弃", "difficulty": 1, "book": "高考高频核心词",
  "example": "He had to abandon his plan due to lack of funding." }
```

字段仅有 word / translation / difficulty / book / example（**单例句、无音标、无逐释义、无语法、无词形变化**）——距 F8 目标字段有明确缺口。

### 2.3 技术底座

- Next.js 14 App Router + 静态导出：`STATIC_EXPORT=1` 时 `output:'export'`、`basePath:'/Gaokao-Academic-Resources'`、`images.unoptimized`（`next.config.mjs`）→ 所有子页必须是客户端组件、无 SSR 数据请求。
- 路径别名：`@/* → src/*`、`@data/* → data/*`（`tsconfig.json`）。
- AI 现成通道：`src/lib/ai.ts:1-43` 的 `streamTutor(messages, onText, signal)`，客户端 SSE POST `https://text.pollinations.ai/openai`（model `openai`，免密钥），消息类型 `TutorMessage{role:'system'|'user', content}`。
- 全局类型 `Question`（`src/types.ts:42-56`）无选项字段（questionId/content/answer/analysis/analysisSource/difficulty/knowledgePoints/tags/year/subject/provenance）；题目数据源为 GitHub 仓库 `deekur/gaokaomath|gaokaophysics`（`src/types.ts:1-7`）。

### 2.4 词库数据仓库（DictionaryData）

【事实】本地克隆 `D:\mo\dshweb\DictionaryData\`（上游声称 https://github.com/LinXueyuanStdio/DictionaryData ；本次会话外网 GitHub 直连不可达，在线一致性核验未能执行，列为待核实点）。仓库自带 README 与数据文件如下：

| 文件 | 行数 | 字段（README 载明 + 实测表头一致） |
| --- | --- | --- |
| `word.csv`（分隔符 `>`） | 70,164 词 | `vc_id > vc_vocabulary > vc_phonetic_uk > vc_phonetic_us > vc_frequency > vc_difficulty > vc_acknowledge_rate` |
| `word_translation.csv` | 103,976 条 | `"word","translation"`（多释义打包在一个字符串内） |
| `book.csv`（分隔符 `>`） | 582 本词书 | `bk_id > bk_parent_id > bk_level > bk_order > bk_name > bk_item_num > …`（含"大学英语四级词汇 74062 项""小学英语 15233 项"等） |
| `relation_book_word.zip` | — | 词↔书关系表（zip 内 CSV） |

实测样例（`word.csv`）：`57067c89a172044907c6698e > superspecies > [su:pərsˈpi:ʃi:z] > [supɚsˈpiʃiz] > 0.0 > 1 > 0.664122`。

**关键缺口【事实】**：该仓库**没有**逐释义例句、语法说明、词形变化字段——F8 的完整字段需另行补齐（见 §6.3 补齐管线）。

### 2.5 用户 DOCX 备注原文（附件已读取）

> 1. 我希望 AI 相关功能可以进行多轮对话，同时 AI 应可以查看题目的图片。
> 2. PDF 查看下载功能会因为 GitHub 在国内的访问问题无法正常使用。
> 3. 为网站添加后台管理界面……（管理登录 / 每 IP 的 AI 速率限制 / 访客统计 / AI API 与模型配置）
> 4. 网站中应包含开源地址。

与本模块的交集：F7 的 AI 助教必须支持**多轮会话**（第 1 条）；其余条目登记为站点级需求，不在本模块范围。

---

## 3. 品牌与设计 Tokens（沿用，不新造）

【事实】`src/app/globals.css`：

| Token | 值 | 来源 |
| --- | --- | --- |
| `--color-standard` | `#312e81`（Indigo 900） | globals.css:5-11 |
| `--color-spring` | `#059669`（Emerald 600） | globals.css:5-11 |
| `--color-vocab` | `#d97706`（Amber 600）← 本模块主色 | globals.css:5-11 |
| `--font-serif` | 'Noto Serif SC', Georgia, serif（标题） | globals.css + layout.tsx:36-41（Google Fonts 400;600;700;900） |
| `--font-sans` | Inter, PingFang SC, sans-serif（正文） | globals.css + layout.tsx:36-41 |
| 页面底/文字 | `#fdfdfd` / `#1a1a1a` | globals.css |
| `.academic-title` | 衬线、letter-spacing -0.02em | globals.css:19-22 |
| `.glass-card` | rgba(255,255,255,0.7)+backdrop-blur(10px)+hover 上浮 | globals.css:30-40 |
| 3D 翻转工具类 | perspective-1000 / preserve-3d / backface-hidden / rotate-y-180 | globals.css:42-46 |

组件层规范（沿用现状写法）：amber 主按钮 `rounded-full bg-amber-600 text-white`、描边按钮 `border-amber-200 text-amber-700`、卡片 `rounded-2xl/3xl`、计数用 `font-mono text-slate-400`；难度色沿用 基础=emerald-600 / 进阶=amber-600 / 冲刺=rose-500。正文中 amber 文字建议用 amber-700/800 保证对比度，amber-600 留给大字与按钮底色（现状按钮即 amber-600+白字加粗）。

---

## 4. 信息架构（IA）

```
/                          首页（已含"词汇工作室"amber 卡片入口，src/app/page.tsx:28-34）
└── /vocab                 工作室主页（Hub：统计总览 + 入口卡；保留现有闪卡）
    ├── /vocab/dict        电子词典（F1）
    ├── /vocab/learn       记单词 · 三模式（F2，含模式选择页）
    ├── /vocab/grammar     记语法 · 完形填空（F3）
    ├── /vocab/translate   翻译（F7a）
    ├── /vocab/tutor       AI 助教 · 多轮对话（F7b）
    └── （现有闪卡练习保留在 /vocab 内部，作为"闪卡复习"入口）
```

【假设·推荐】采用**子路由**而非单页 Tab：每页独立 metadata（沿用 `src/app/vocab/layout.tsx:4-12` 的 per-route 写法）、可分享 URL、代码可按页懒加载，且静态导出（`output:'export'`）天然支持。备选：单页 Tab 切换（实现更快，但状态耦合、URL 不可分享）——若用户偏好极简结构可改。

【决策 D5】现有闪卡页去留：推荐**保留**为 Hub 内"闪卡复习"入口（其 localStorage 进度 `xiaomo-vocab-progress-v1` 继续有效），不与答题记录混算（见 §7.1）。

---

## 5. 页面线框与交互

### 5.1 主页 Hub（/vocab）

```
┌───────────────────────────────────────────────┐
│ 词汇工作室  Vocabulary Studio （academic-title，amber 强调）│
│ 已收录 3,500 词 · 答对 128 · 错题 36 · 今日已练 20        │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐│
│ │ 📖 电子  │ │ ✍️ 记   │ │ 🧩 记   │ │ 🀫 闪卡  ││
│ │   词典   │ │  单词×3 │ │  语法   │ │  复习   ││
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘│
│ ┌─────────┐ ┌─────────┐                        │
│ │ 🌐 翻译  │ │ 🤖 AI   │  （glass-card × 6）     │
│ └─────────┘ └─────────┘                        │
└───────────────────────────────────────────────┘
```

### 5.2 电子词典（/vocab/dict，F1）

```
┌───────────────────────────────────┐
│ 🔍 [ 搜索单词或释义……        ] [查]│  ← 本地前端检索（§11）
├───────────────────────────────────┤
│ abandon  /əˈbændən/  /əˈbændən/   │  ← 英/美音标，点击可发音（Web Speech API，【假设】）
│ ① v. 放弃；抛弃                    │
│    · He had to abandon his plan…  │
│      （他不得不放弃他的计划。）      │  ← 每个释义配一个例句（F8）
│ ② n. 放纵，纵情                    │
│    · …                            │
│ 语法：后接名词/代词/动名词作宾语；   │
│       常用 abandon oneself to      │
│ 词形：abandons / abandoned / abandoning │
│ 难度：基础  认知率 66%   [加入今日抽题] │
└───────────────────────────────────┘
```

交互要点：空态显示"随机一词"；搜索无结果给近形词建议；右上角"难度/词书"筛选沿用 `DIFF_LABEL` 三档样式（page.tsx:16-24）。

### 5.3 记单词 · 三模式（/vocab/learn）

模式选择页：三张 glass-card（模式名 + 示意 + 说明），进入后共用同一套**通用答题机**（§5.5）。

**模式一 英→中**：题面 = 单词（大字，衬线）+ 音标 + 英文例句（目标词加粗下划线）；四选一中文释义。

```
┌───────────────────────────────────┐
│ ← 返回   英译中 · 第 3/10 题  ⏱ 12/20│
│ ▓▓▓▓▓▓▓░░░░░░░░  (进度条可点击回跳)   │
│                                   │
│         abandon   /əˈbændən/      │
│   "He had to *abandon* his plan   │
│       due to lack of funding."    │
│                                   │
│  A. 放弃；抛弃        ○           │
│  B. 达到；完成        ○           │
│  C. 出现；显露        ○           │
│  D. 避免；回避        ○           │
│                                   │
│   [← 上一个]              [下一个 →] │   ← 两键常驻（F5）
└───────────────────────────────────┘
```

**模式二 中→英**：题面 = 中文释义 + 英文例句（词位显示 `____`）；四选一英文单词。

**模式三 拼写（无选项）**：题面 = 中文释义 + 英文例句（词位 `____`）+ 输入框；提交后**逐字符对比**（对=绿，错=红并显示正确字母），忽略大小写；连续错 2 次可点"提示"显示首字母。

```
│ 释义：放弃；抛弃                     │
│ "He had to ______ his plan…"       │
│ [ a b a n d o n＿        ] [提交]    │
│ 反馈： a✓ b✓ a✓ n✓ d✓ o✓ n✓        │
```

### 5.4 记语法 · 完形填空（/vocab/grammar，F3）

```
│ ── 完形填空 · 第 2/10 题 ──          │
│ This is the museum ____ we visited │
│ last year.                         │
│  A. which   B. where               │
│  C. when    D. what                │
│                                   │
│ 答错时示例反馈：                     │
│  ✗ 你选了 B. where                 │
│  ✓ 正确答案：A. which              │
│ ┌─ 解析 ─────────────────────────┐ │
│ │ 语法：先行词 museum 指物，且在从句中│
│ │ 作 visited 的宾语 → which/that。  │
│ │ 译：这就是我们去年参观的那家博物馆。│
│ │ 逐词：This(这) is(是) the(这)     │
│ │ museum(n.博物馆) which(关系代词)  │
│ │ we(我们) visited(v.参观)…         │
│ └────────────────────────────────┘ │
│   [← 上一个]              [下一个 →] │
```

语法题的选项来自**题库预生成数据**（不从运行时造选项），解析含三层：句中语法 / 整句翻译 / 逐词释义——对应手稿要求。

### 5.5 通用答题机（QuizCard，F4/F5）

状态机：`idle → answered(correct|wrong) → reviewed → next`

| 规则 | 行为 |
| --- | --- |
| 答对 | 选项标绿；`records[qid].status='correct'` → 入**答对题库**；显示解析 |
| 答错 | 指出"你选了 X"+高亮"正确答案 Y"；`status='wrong'` → 入**错题库**；显示解析 |
| 解析 | 所有题型**必显示**（答后自动展开；未答时"查看解析"也可展开） |
| 下一个 | 常驻按钮：已答→推进队列；未答→视为"跳过"（不写入 records，仍留在未答池），解析区提示 |
| 上一个 | 常驻按钮（**无论是否已作答**可用）：回看队列中上一题及其作答结果 |
| 键盘 | 1-4 / A-D 选择，Enter=下一个，←=上一个（【假设】桌面增强） |

### 5.6 翻译（/vocab/translate，F7a）

```
│ [英→汉 ▾]  服务商：MyMemory(免key) ▾  │
│ ┌ 原文 ──────────────┐ ┌ 译文 ─────┐ │
│ └──────────────[翻译]─┘ └─────────[复制]│
│ 今日已用 216 / 5,000 字符（免费额度）   │
```

服务失败时：给出"翻译服务暂不可用"并自动降级到备选服务商（§8），原文可复制。

### 5.7 AI 助教（/vocab/tutor，F7b）

- 多轮对话：复用 `streamTutor`（`src/lib/ai.ts:1-43`），前端维护 `messages: TutorMessage[]` 逐轮累积，SSE 流式渲染（DOCX 第 1 条：必须多轮）。
- 上下文注入：词典页/答题页提供"问 AI 助教"按钮，把当前词/题目以 `[上下文] …` 追加进用户消息；答题页解析下方"让 AI 再讲一遍"。
- 会话仅存内存（刷新清空），【决策 D7】确认是否需要本地持久化历史。
- **系统提示词（设计稿全文）**：

```text
你是小墨高考「词汇工作室」的 AI 助教，名叫墨墨。你的学生是中国高考考生。
1) 范围：只回答英语词汇、语法、例句、考试技巧相关的问题；无关话题礼貌拒绝并引导回学习。
2) 学生发来一个单词时：给英/美音标、词性、高考范围内的核心释义（不超过 4 条）、1 个原创例句+中文翻译、
   常用搭配、1-2 个易混词辨析。
3) 学生发来一个句子时：先指出句子主干（主谓宾/主系表），再逐层说明修饰成分与从句类型（用课本术语：
   定语从句、状语从句、非谓语等），最后给整句翻译。
4) 启发式：学生直接索要答案时，先给一个提示并确认；学生明确要求完整解释时才给全量。
5) 语言：用中文讲解；术语与高考课本一致；例句难度控制在高考大纲内。
6) 格式：先一句话结论，再分点展开；不使用表格；总长度不超过 300 字，除非学生要求展开。
7) 若学生消息中带有 [上下文] 标注的题目或单词内容，优先围绕它解答。
```

---

## 6. 数据 Schema 与词库映射（F8）

### 6.1 目标词库 `data/vocab/` 组织

```
data/vocab/
  books.json               // 词书目录（映射 book.csv）
  index.<book-slug>.json   // 轻索引：id, word, difficulty（供检索/建池）
  words.<book-slug>.<chunk>.json  // 分块全量词条（500 词/块，动态加载）
  grammar.gk.json          // 语法完形题库
```

### 6.2 词条 schema（`words.*.json`）

```jsonc
{
  "schemaVersion": 1,
  "book": "高考高频核心词",
  "words": [{
    "id": "57067c89a172044907c6698e",        // ← DictionaryData word.csv: vc_id
    "word": "superspecies",                   // ← vc_vocabulary
    "phoneticUk": "[su:pərsˈpi:ʃi:z]",        // ← vc_phonetic_uk
    "phoneticUs": "[supɚsˈpiʃiz]",            // ← vc_phonetic_us
    "frequency": 0.0,                          // ← vc_frequency（构建期可折算为"高频/低频"）
    "difficulty": 1,                           // ← vc_difficulty（沿用 1基础/2进阶/3冲刺）
    "ackRate": 0.664,                          // ← vc_acknowledge_rate（可选，用于排序）
    "senses": [                                // ← word_translation.csv 拆分（见映射表）
      { "pos": "n.", "zh": "……", "exampleEn": "…", "exampleZh": "…" }
    ],
    "grammar": "可数名词；常用于……",             // ★ 仓库无此字段 → 补齐管线
    "forms": { "plural": "…", "past": "…", "pastParticiple": "…",
               "presentParticiple": "…", "thirdPerson": "…",
               "comparative": "…", "superlative": "…" }   // ★ 补齐管线
  }]
}
```

### 6.3 字段映射表与缺口补齐

| json 字段 | DictionaryData 来源 | 缺口处理 |
| --- | --- | --- |
| id / word | `word.csv: vc_id / vc_vocabulary` | 直接映射 |
| phoneticUk / phoneticUs | `vc_phonetic_uk / vc_phonetic_us` | 直接映射 |
| frequency / difficulty / ackRate | `vc_frequency / vc_difficulty / vc_acknowledge_rate` | 直接映射 |
| book | `book.csv: bk_name` + `relation_book_word` 关联 | 脚本 join |
| senses[].zh | `word_translation.csv: translation`（整串打包多释义） | 构建期脚本按词性标记（`n. / v. / adj. / adv. / vt. / vi. / prep.` 等）启发式拆分，拆分结果进人工抽检名单 |
| senses[].exampleEn / exampleZh | **无** | 补齐管线：构建期批量 AI 生成（复用 pollinations/DeepSeek 通道）+ 人工抽检 ≥5%；第一期可先用 `mock_data.json` 的 140 词手工精修为种子集 |
| grammar / forms | **无** | 同上管线；forms 亦可用 inflection 库离线规则生成后 AI 校验 |

【决策 D4】补齐方式与词书范围：推荐**先做 140 词种子集跑通全链路 → 再扩 1-2 本高考词书（约 2,500-3,500 词）**；全量 7 万词不建议（体积与校验成本）。另：DictionaryData LICENSE 已核为 Apache-2.0（§13 D6），再分发需保留声明。

### 6.4 语法题库 schema（`grammar.gk.json`）

```jsonc
{
  "schemaVersion": 1,
  "items": [{
    "id": "gram-gk-0001",
    "sentence": "This is the museum ____ we visited last year.",
    "options": ["which", "where", "when", "what"],   // 恒 4 项
    "answerIndex": 0,
    "analysis": {
      "grammar": "先行词 museum 指物且在从句中作宾语 → which/that。",
      "sentenceZh": "这就是我们去年参观的那家博物馆。",
      "wordGloss": [{ "en": "museum", "zh": "n. 博物馆" }]
    },
    "difficulty": 2, "tags": ["定语从句"]
  }]
}
```

与全局 `Question`（`src/types.ts:42-56`）对齐但**不改动全局类型**：id/questionId、sentence/content、answer、analysis、difficulty、tags/knowledgePoints 同构；新增 `options/answerIndex`（词汇侧独立 schema）。

---

## 7. 抽题与状态模型（localStorage）

### 7.1 键设计（与现有键并存，互不迁移）

| 键 | 内容 |
| --- | --- |
| `xiaomo-vocab-progress-v1`（现有） | 闪卡"认识"标记，**继续沿用**（page.tsx:7-8） |
| `xiaomo-vocab-quiz-v1`（新） | `{ settings:{ ratio:{correct,wrong,unseen}, book, mode }, records:{ [qid]:{ status:'correct'｜'wrong', chosen, at, mode } } }` |
| `xiaomo-vocab-queue-v1`（新） | `{ items:[qid…], pos:number }` —— 持久化本轮队列，保证刷新后"上一个"仍可用 |

**三池口径**：答对题库 = `records[status=correct]`；错题库 = `records[status=wrong]`；未答题库 = 总题池 − 已答 qid。闪卡"认识"**不**计入答题记录（题型独立，【假设】）。

### 7.2 抽题比例（默认值待确认）

`{ correct: 10, wrong: 25, unseen: 65 }` —— **【决策 D1】此为手稿辨读的推荐默认值，未经用户确认**。用户可在设置抽屉用三个滑块调节；三者之和不强制 100，按实际权重归一化。

### 7.3 抽题算法（伪代码）

```
function pickNext():
  pools = { correct: ids(records.correct), wrong: ids(records.wrong), unseen: allIds − answered }
  weights = ratio 复制；对空池：将其权重按其余池比例再分配
  pool = weightedRandom(pools, weights)
  if pool == wrong:  取 at 最久未复习者（错题重排间隔）   // 【假设】
  else:              均匀随机
  push qid 到 queue.items；pos = 末位
```

### 7.4 干扰项生成（运行时、确定性）

- 模式一（中文选项）：同词书内 `difficulty ±1` 的其他词释义，优先同词性、长度相近；按 `qid` 做 seed 保证刷新后选项不变。
- 模式二（英文选项）：同词书内编辑距离 ≤2 的词 + 同词性词，排除正确项。
- 语法题：不用运行时生成，读题库 `options`。

---

## 8. 翻译服务（F7a）

【事实】本项目已有"免密钥公开端点 + 客户端直连"先例（`src/lib/ai.ts:3-14`，pollinations）。翻译按同一思路设计**可插拔 provider**：

| 候选 | 免 key | 免费额度 | 国内可达 | 备注 |
| --- | --- | --- | --- | --- |
| MyMemory（`api.mymemory.translated.net/get?langpair=en|zh-CN`） | ✅ | 匿名约 5,000 字符/日（官网口径，**待实测**） | 待实测 | 推荐默认；支持 CORS |
| LibreTranslate（自部署/公共镜像） | 自部署✅ | 自部署无限 | 取决于部署 | 备选，公共镜像不稳 |
| 百度翻译开放平台 | 需注册 | 标准版免费额度（约 5 万字符/月，QPS 1，口径待核） | ✅ | 备选；需 appid+签名 |
| Google 翻译非官方端点 | ✅ | — | ❌（被墙） | 不采用：受众在国内 |

设计要点：provider 抽象 `{ id, translate(text, from, to) }`，设置抽屉可切换；主选失败自动降级；失败时原文可复制；字符用量按日计数入 localStorage。【决策 D3】默认服务商与是否需要"自定义 API 地址"入口，待用户确认。

---

## 9. AI 对话（F7b）

- 通道：完全复用 `streamTutor`（`src/lib/ai.ts:1-43`），不改后端（静态站无后端）；词汇侧新增仅是系统提示词 + 上下文注入 + 会话 UI。
- 多轮：`messages` 数组累积，每次请求携带完整历史；上下文窗口超限时截断最早轮次（【假设】保留 system + 最近 10 轮）。
- 系统提示词见 §5.7，作为常量随模块代码评审（**当前仅为设计稿，未写入代码**）。
- 稳定性风险：pollinations 免费端点为现状既有依赖，本模块沿用并接受其波动（超时提示 + 重试按钮）。

---

## 10. 响应式与无障碍

- 布局：全站移动优先；Hub/答题页保持现状居中单列节奏，词典页允许放宽至 `max-w-3xl`；触摸目标 ≥44px。
- 无障碍：选项用 `<fieldset><legend>` + `<button>`；反馈区 `aria-live="polite"`；键盘操作（§5.5）；`focus-visible` 焦点环；`prefers-reduced-motion` 时关闭 3D 翻转与动画（工具类现状为 globals.css:42-46）；音标配 `aria-label`。
- 色彩：难度三色沿用（emerald/amber/rose），同时以文字标签（基础/进阶/冲刺）区分，不单靠颜色（色弱友好）。

---

## 11. 性能

- 数据分块：词条按 500 词/块动态 `import()`；索引文件轻量（id+word+difficulty，3,500 词约 100-150KB）。
- 词典检索：纯前端内存检索（索引加载后过滤），无后端；中英混合（word 前缀 + translation includes）。
- 静态导出：无 SSR/接口；localStorage 读写沿用现状水合门控模式（page.tsx:26-55）。
- AI/翻译仅在用户触发时请求，流式渲染避免整段等待。
- 已知现状约束（记录不改）：Google Fonts 与 GitHub 资产在国内加载偏慢（DOCX 第 2 条相关，属站点级议题）。

---

## 12. 分阶段实施与验收清单（获批后执行）

| 阶段 | 内容 | 验收标准 |
| --- | --- | --- |
| M0 决策确认 | 用户确认 §13 决策表 | 决策表全部落定 |
| M1 数据管线 | 构建期脚本：DictionaryData CSV → vocab json（映射 §6.3）+ 校验脚本 | 生成的 json 通过 schema 校验；种子 140 词全字段齐全 |
| M2 词典页 | /vocab/dict 检索、词条卡、发音 | 查 abandon 显示音标/逐释义例句/语法/词形；空态/无结果可用 |
| M3 记单词 | 三模式 + 通用答题机 + 三池抽题 + 上一个/下一个 | F2/F4/F5/F6 全规则可演示；刷新后队列与记录不丢；比例可调 |
| M4 记语法 | grammar 题库 + 完形页 | 三层解析（语法/翻译/逐词）完整展示 |
| M5 翻译 | 翻译页 + provider 抽象 + 降级 | 中英互译可用；失败降级不白屏 |
| M6 AI 助教 | 多轮对话 + 上下文注入 + 提示词落地 | 多轮上下文有效；"问 AI"从词典/答题页带入上下文 |
| M7 打磨 | 无障碍/性能/移动端 | §10、§11 清单逐项通过 |

每阶段交付前跑 `npm run build`（含静态导出）确认 basePath 下路由正常。

---

## 13. 决策登记表

### 已知事实（代码/数据可验）
1. `/vocab` 已存在且为 amber 主题翻卡页（page.tsx:201-235 等见 §2.1）。
2. 现有词数据 140 词、5 字段，无音标/逐释义/语法/词形（§2.2）。
3. DictionaryData 真实结构为 CSV：word.csv 70,164 词含双音标与难度；translation 单串打包；无例句/语法/词形（§2.4）。
4. 全局 `Question` 类型无选项字段；词汇侧需独立 schema（§6.4）。
5. AI 免密钥流式通道已存在（lib/ai.ts），翻译可循同模式（§8/§9）。
6. 项目为静态导出，basePath `/Gaokao-Academic-Resources`（next.config.mjs）。
7. DOCX 备注：AI 必须多轮对话；后台管理等属站点级需求（§2.5）。

### 推荐假设（可推翻）
A1 子路由 IA（§4）；A2 保留闪卡入口、进度与答题分账（§7.1）；A3 跳过不写入记录（§5.5）；A4 错题按最久未复习优先（§7.3）；A5 干扰项确定性 seed（§7.4）；A6 词典发音用 Web Speech API（§5.2）；A7 会话历史仅内存（§5.7）；A8 语法题选项预生成（§6.4）。

### 待用户决策点
- **D1 抽题默认比例**：10/25/65（手稿辨读推荐值）是否确认？
- **D2 词典/AI 例句补齐**：接受"AI 批量生成 + 人工抽检"管线？先 140 词种子还是直接扩到整本词书？
- **D3 翻译默认服务商**：MyMemory（免 key）为默认 + 可配置，是否可？是否需要"自定义 API 地址"入口？
- **D4 词书范围**：先做哪本（推荐"高考高频核心词"，约 2,500-3,500 词）？
- **D5 现有闪卡页**：保留为 Hub 内"闪卡复习"入口？
- **D6 DictionaryData 授权（已基本落定）**：本地 LICENSE 头部实测为 **Apache-2.0**——允许再分发衍生的词库 json，但需保留版权与许可声明并注明修改；建议 data/vocab/ 随附 LICENSE 副本。剩形式性确认。
- **D7 AI 会话历史**：仅内存（刷新清空）还是本地持久化？

---

## 14. 风险与缓解

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| 词库无例句/语法/词形 → F8 数据缺口 | 高 | 种子集先行 + AI 生成管线 + 人工抽检（D4） |
| 免费翻译 API 国内可达性未验证 | 中 | provider 可插拔 + 双备选 + 失败降级（§8） |
| pollinations 端点波动（现状依赖） | 中 | 超时提示 + 重试；不新增依赖 |
| GitHub 直连不可达 → 仓库在线核验未完成 | 低 | 以本地克隆 README+CSV 实测为准，上线前补核 |
| 全量 7 万词体积 | 低 | 词书级范围控制 + 分块（§6.1/§11） |
| Google Fonts/静态资产国内加载慢 | 低（现状既有） | 记录为站点级议题，不在本模块处理 |

---

## 附录：证据清单

- 源码：`src/app/vocab/page.tsx`（270 行，键/难度/翻卡/导航定位见 §2.1 行号）、`src/app/vocab/layout.tsx`、`src/app/layout.tsx`、`src/app/globals.css`、`src/app/page.tsx`、`src/lib/ai.ts`、`src/types.ts`、`tailwind.config.ts`、`next.config.mjs`、`tsconfig.json`。
- 数据：`data/mock_data.json`（vocab 140 词）、`D:\mo\dshweb\DictionaryData\`（word.csv / word_translation.csv / book.csv / README.md / LICENSE）。
- 需求：手绘需求图 ×2（已辨读入 §1.1）、DOCX 附件（原文见 §2.5）。
- 未完成核验：GitHub 上游在线比对（网络不可达）；翻译 API 额度与可达性实测；DictionaryData LICENSE 仅核对头部（Apache-2.0，标准文本）。
