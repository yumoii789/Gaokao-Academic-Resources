# NOTICE — vocab data modifications

词库数据衍生自 DictionaryData（Apache-2.0 LICENSE 已随附于本目录）。

## Modifications / 相对原始数据集的修改

- 从 word.csv / word_translation.csv / book.csv / relation_book_word.zip 抽取子集（按书），转换为 JSON 分片。
- 难度映射为站点 1-3 刻度（difficultyRaw<=3 -> 1; 4-6 -> 2; >=7 -> 3），difficultyRaw 保留。
- 种子书 gk-core-140 的 senses（释义+例句）与 grammar 字段为 AI 辅助撰写（exampleSource=seed-mock-v1 / ai-draft-v1，grammarSource/formsSource 见各条目），并非原数据集内容；原词汇与释义行保留在 translationRaw。
- 词典书 gk688 仅含原数据集字段（无例句/语法/屈折），由 books.json 的 missingFields 声明。

原始许可与版权声明见同目录 LICENSE（Apache-2.0）。
