# 词库覆盖率审计报告（vocab coverage audit）

- 审计对象：本站词库数据现状 vs 上游 [LinXueyuanStdio/DictionaryData](https://github.com/LinXueyuanStdio/DictionaryData)
- 审计方式：纯本地实测 + git 协议网络核验（无浏览器、未修改任何业务文件；临时克隆写入系统 Temp 并已清理）
- 上游 HEAD：`032c3cd60cf97ac7e0211a37af152aebb8bf6984`（2025-03-28，"Merge pull request #2"）

---

## 一、结论（是否全量？）

**不是全量覆盖。**

| 指标 | 数值 |
|---|---|
| 上游 word.csv 数据行 | 70,164 |
| 上游唯一词（区分大小写） | 70,162 |
| 上游唯一词（不区分大小写） | 69,605 |
| 站点当前词数（mock_data.json vocab） | 140 |
| 覆盖率 | **140 / 70,164 ≈ 0.20%** |
| 缺失词数（区分大小写口径） | **70,022** |
| 缺失词数（不区分大小写口径） | **69,465** |

站点 140 词全部能在上游 word.csv 中精确命中（无大小写变体、无捏造词），即站点词集是上游的真子集。

---

## 二、上游核验结果（本次已完成的网络核验范围）

沙箱内 curl / Node fetch 均被 TLS 策略阻断，但 **git 协议可用**。因此采用 `git clone --depth 1` 将上游浅克隆到系统临时目录（未触碰工作区），逐文件比对 blob SHA 后删除临时目录。

- 上游默认分支 HEAD：`032c3cd60cf97ac7e0211a37af152aebb8bf6984`（2025-03-28 21:13 +0800）
- 上游文件清单（共 6 个）：LICENSE、README.md、book.csv、word.csv、word_translation.csv、relation_book_word.zip
- **上游不存在独立的 vc_vocabulary 文件**：`vc_vocabulary` 是 word.csv 的第 2 列（分隔符 `>`）。

### 本地 vs 上游 blob SHA 比对（内容一致性）

| 文件 | 上游 blob SHA | 本地 LF 归一化 SHA | 一致？ |
|---|---|---|---|
| word.csv | 34430036c74c3bb556f3eb8f3f812d80db43d41d | 同左 | 一致 |
| book.csv | d4e84c3593ce065d0dd369340d0acaef4310cf06 | 同左 | 一致 |
| word_translation.csv | 711df801c49c391993f5640ac9d4ced6ca1e3f8c | 同左 | 一致 |
| README.md | c178b47ba86fec68e1d4d2b03b0a678cc41ce2e7 | 同左 | 一致 |

即：**本地 DictionaryData 目录与上游默认分支内容逐字节一致**（仅换行符差异：本地落盘为 CRLF，上游为 LF；word.csv 本地 7,325,703 B 减 上游 7,255,538 B = 70,165 B，恰等于行数）。

> 出处澄清：`D:\mo\dshweb\DictionaryData` **不是** git 克隆，而是 dshweb 工作区里的一个未跟踪目录（父仓库 origin 为 deekur/Gaokao-Academic-Resources.git）。其身份此前无证明，本次已用 blob SHA 证毕与上游一致。

---

## 三、各数据源实测计数（本地实测，且已证与上游一致）

### 3.1 word.csv（分隔符 `>`，14 列）

| 项 | 值 |
|---|---|
| 总行数（含表头） | 70,165 |
| 数据行 | **70,164** |
| vc_vocabulary 非空 | **70,164**（0 缺失） |
| 唯一词（区分大小写） | **70,162**（2 组重复） |
| 唯一词（不区分大小写） | **69,605**（559 组大小写变体合并） |
| 缺列行 | 0 |

2 组精确重复：`drop ... off`（行 id 57067c8ca172044907c66a91 / 5840f0ebdfbe2c5b47879040）、`o'clock`（5796b5599884876e526dbf8c / 57067c33a172044907c64ce3）。

### 3.2 word_translation.csv（逗号+引号格式）

| 项 | 值 |
|---|---|
| 数据行 | **103,976** |
| 去重后单词数 | **103,976**（每词一行，无重复） |
| 空 word / 空 translation | 0 / 0 |
| 与 word.csv 词交集 | **27,419**（= word.csv 词的 **39.08%**） |
| 不在 word.csv 中的翻译词 | 76,557 |

注意：即便全量导入，上游也只能为 **27,419 / 70,162（39.08%）** 的词条提供中文释义；其余 **42,743** 词无释义数据（需留空或另行补充）。

### 3.3 book.csv（分隔符 `>`，14 列）

| 项 | 值 |
|---|---|
| 数据行（词书） | **583** |
| 一级分类（bk_level=1, parent=0） | **25** |
| 二级词书（bk_level=2） | **558** |
| 合计 bk_item_num | 2,050,544（含一级分类行的聚合值，重复计入） |
| 合计 bk_direct_item_num | **1,044,576**（仅叶子书） |

25 个一级分类：大学英语四级词汇、小学英语、高中英语、新概念英语、分频词汇、托福词汇、GRE词汇、雅思词汇、大学英语六级词汇、大学英语专业八级、BEC词汇、GMAT词汇、考研英语、其他书籍、大学英语专业四级、大学英语教科书类、托业词汇、SAT词汇、初中英语、ACT词汇、全国等级考试、词典单词、考博英语、MBA词汇、老版词书。

### 3.4 relation_book_word.zip（词书与单词的关系）

| 项 | 值 |
|---|---|
| zip 大小 | 10,899,013 B |
| 解包后 relation_book_word.csv | **110,974,824 B（约 111 MB）** |
| 数据行 | **1,044,580**（与合计 bk_direct_item_num=1,044,576 差 4，自洽） |
| 列 | bv_id>bv_book_id>bv_voc_id>bv_flag>bv_tag>bv_order |
| 样例行 | 58450c828958a37d5c10f763>d645920e395fedad7bbbed0e>57067b9ca172044907c615d7>4>Unit 1>1 |

---

## 四、站点当前消费状态

| 项 | 现状 |
|---|---|
| data/mock_data.json（48,243 B） | standard 19 题、spring 9 题、vocab **140** 词（字段 word/translation/difficulty/book/example） |
| data/vocab_seed.json（24,685 B） | 140 词，与 mock.vocab 词集一致，book 均为「高考高频核心词」 |
| data/vocab/ | **存在但为空**（流水线尚未生成） |
| public/data/vocab/ | **不存在**（public/data/ 下仅 figures/、questions/、search-index.json） |
| src/app/vocab/page.tsx | 导入 @data/mock_data.json，仅渲染 mockData.vocab，线上词库页实际词数 = **140** |

### 缺口精确数字

- 区分大小写口径：70,162（上游唯一） − 140（站点） = **缺 70,022 词**
- 不区分大小写口径：69,605 − 140 = **缺 69,465 词**
- 释义缺口：全量导入时仅 39.08% 词条能带中文释义（27,419 / 70,162）

---

## 五、复现命令（要点）

```bash
# 行数/字节（LF 归一化后与上游 blob 一致）
wc -l DictionaryData/{word.csv,book.csv,word_translation.csv}

# 唯一词与重复（Node 示例，> 为字段分隔符，第 2 列是 vc_vocabulary）
node -e "const L=require('fs').readFileSync('DictionaryData/word.csv','utf8').split(/\r?\n/).filter(Boolean);const s=new Set(L.slice(1).map(l=>l.split('>')[1].trim()));console.log(s.size)"

# 上游核验（git 协议；curl/fetch 在本沙箱被 TLS 阻断）
git ls-remote https://github.com/LinXueyuanStdio/DictionaryData HEAD
git clone --depth 1 https://github.com/LinXueyuanStdio/DictionaryData "$TMP/up"
git -C "$TMP/up" cat-file blob HEAD:word.csv | git hash-object --stdin

# relation 行数（PowerShell 解包到临时目录后）
wc -l relation_book_word.csv   # 1,044,581 行（含表头）
```

---

## 六、全量导入体积估算

| 数据 | 原始 | 转 JSON（估） | 说明 |
|---|---|---|---|
| word.csv 全字段 | 7.26 MB | 约 9–10 MB | 70,164 词，含音标/词频/难度/认识率 |
| 精简词表（word+音标+difficulty+frequency） | — | 约 6–7 MB | 去掉内部 id |
| word_translation | 4.72 MB | 约 5–6 MB | 103,976 条 |
| relation（全量） | 111 MB（CSV） | 约 60–65 MB | **禁止整包下发客户端** |
| 合计（词表+释义，静态 JSON） | — | **约 15–16 MB 原始 / 约 3–4 MB gzip** | 可接受；relation 只作构建期输入 |

建议形态：按词书/首字母分片（558 本书，平均每本约 1,900 词），构建期用 relation 生成「每本词书一个 JSON + 清单 manifest」，放到 public/data/vocab/，运行时按需加载；data/vocab/（现为空）可作为生成中间产物目录。

---

## 七、后续步骤（建议流水线实施方执行）

1. **定范围（产品决策）**：全量 70,164 词，还是按书过滤（如「高中英语」子树、四六级核心）？范围决定分片方案与体积。高中子树词量可用 relation 按 bk_parent_id 聚合得出（本次未逐本统计）。
2. **解析 word.csv**：分隔符 `>`；按 lowercase 去重（559 组大小写合并，含 2 组完全重复），保留规范大小写。
3. **释义 join**：word_translation.csv 精确匹配仅覆盖 39.08%；其余 42,743 词释义置空或标「待补」，不要伪造。
4. **关系数据**：解包 relation_book_word.zip（111 MB CSV，104 万行），join bv_voc_id→vc_id、bv_book_id→bk_id，生成每书 JSON + manifest；**不要**把全量 relation 下发到客户端。
5. **生成后复测**：重跑本报告第五节命令核对覆盖率（全量应达 100% 或所选范围 100%），并把结果回写本文件。

## 八、局限与未决

- curl / Node fetch / GitHub API 在本沙箱被阻断，上游核验通过 git 协议完成（HEAD + 浅克隆 blob SHA 比对），可信度等同逐字节比对；除此之外未做任何 HTTP 层核验。
- relation 的 bv_flag / bv_tag 语义未逐值校验（README 有字段说明，样例 flag=4、tag="Unit 1"），接入流水线时建议抽样验证。
- 按要求未启动浏览器、未修改本报告以外的任何文件；临时克隆/解包均写入系统 Temp 并已清理。
