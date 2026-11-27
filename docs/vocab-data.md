# 静态词库（data/vocab / public/data/vocab）

由 `scripts/vocab/build-vocab.mjs` 从 [DictionaryData](https://github.com/wenmin-wu/DictionaryData)（Apache-2.0）确定性生成，可随时重跑复现。设计依据：docs/vocab-design-proposal.md §6。

## 目录布局（§6.1）

- data/vocab/ 与 public/data/vocab/ 内容逐字节一致（构建时镜像，前者供脚本/适配器，后者供静态 fetch）。
- books.json — 全局清单：schemaVersion、generator、sourceStats（源数据行数指纹）、difficultyMapping、每本书的 id/kind/fillLevel/missingFields/wordCount/chunkFiles/stats。
- index.<slug>.json — 每本书的轻量索引：id/word/difficulty + count/chunkCount/chunkFiles。
- words.<slug>.NNN.json — 词条分片，≤500 词/片；首片 001。
- LICENSE（Apache-2.0 原文随数据分发）+ NOTICE.md。

书：gk-core-140（种子 140 词，1 片，147 KB）、gk688（高考历年真题核心高频688，689 唯一词 / 2 片，372 KB）。

## gk688 词数口径

relation_book_word 中该书 799 行 = 核心高频688词汇 688 行 + 核心扩展110词汇 111 行，其中 110 词同时出现在两个 tag。构建按 (tagRank, bv_order) 排序去重（保留高优先级 tag 的顺序），得 689 唯一词（688 + 1 个仅扩展词）。6 词无翻译，标 needsReview: true。

## 词条 schema（§6.2，对齐 src/lib/vocab/types.ts）

公共字段：id（DictionaryData 词 id，种子书同源）、word、phoneticUk/Us、frequency、difficulty（1/2/3，映射 difficultyRaw≤3→1、4-6→2、≥7→3）、difficultyRaw、ackRate、translation（展示用）、translationRaw（CSV 原文，审计留档）、senses[{pos,zh,exampleEn?,exampleZh?,exampleSource?}]、needsReview?。

种子书（gk-core-140，fillLevel=full）额外：grammar + grammarSource: 'ai-draft-v1'、forms（WordForms 键：plural/past/pastParticiple/presentParticiple/thirdPerson/comparative/superlative）+ formsSource（'irregular-table-v1' | 'rule-morph-v1'）。介词/连词/副词类（despite 等）无可派生屈折，省略 forms。例句 provenance：exampleSource = 'seed-mock-v1'（取自 @data/mock_data.json）或 'ai-draft-v1'（AI 起草，仅种子书 140 词允许）。

词典书（gk688，fillLevel='dictionary-only'，missingFields: ['senses.example','grammar','forms']）：额外带 unit（原书 tag）+ order（原书 bv_order）；不携带 grammar/forms/例句。

## 数据来源与质量边界

- 源表：word.csv（70,164 词）、word_translation.csv（103,855 对，121 行解析失败计入 badTranslationLines）、book.csv（583 行）、relation_book_word.zip（1,044,580 行）。行数为本次解析计数，作为 sourceStats 指纹。
- gk688 的 translation/senses 直接取自词典 CSV（translationRaw === translation），语义切分为启发式（13 词多义切分）；~6 词翻译为空（needsReview）。源数据个别行有脏字符（如 characteristic 的 //），保留原文不修饰。
- 种子书的例句/语法为 AI 起草（草稿质量），forms 由规则+不规则表生成；均带 provenance 字段，不冒充词典数据。

## 复现

\`\`\`bash
node scripts/vocab/build-vocab.mjs --dict D:/mo/dshweb/DictionaryData
node scripts/vocab/validate-vocab.mjs
\`\`\`

默认输出 --out data/vocab 并镜像到 --public public/data/vocab；种子词（AI 例句/语法）来自 data/vocab_seed.json 与 scripts/vocab/enrichment/seed-part{1,2,3}.json，其余全部确定性解析，无时间戳，重跑 diff 为空。种子书扩词时更新 seed 输入后重跑即可；扩展其他高考核心书改 --book。

## 许可

DictionaryData 为 Apache-2.0；LICENSE 原文随 data/vocab 与 public/data/vocab 分发，来源与变更见 NOTICE.md。

## 后续（不在本次范围）

- grammar.gk.json（§6.4 语法点库）未生成。
- data/vocab 挂载到应用加载逻辑（seed.ts 适配 data/vocab 分片）属应用侧改动。
