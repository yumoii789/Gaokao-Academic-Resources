# 小墨高考

AI 驱动的学业提升平台。三个子站：**普通高考**、**春季高考**、**词汇工作室**。

## 功能

- **真题题库**：按学科、年份、知识点组织的结构化真题，含答案与逐步解析
- **KaTeX 公式渲染**：题干、答案、解析中的 `$...$` LaTeX 在服务端渲染为高质量公式
- **AI 引导**：每道题可发起 AI 助教启发式引导（流式输出）
- **词汇翻转卡**：140 词高考核心词库，本地进度记忆

## 数据格式

题库位于 `data/mock_data.json`，键为 `standard` / `spring` / `vocab`。题目字段：

| 字段 | 说明 |
| --- | --- |
| `questionId` | 唯一标识，如 `std-math-2024-01` |
| `content` / `answer` / `analysis` | 正文，支持 `$...$` 行内 LaTeX |
| `knowledgePoints` | 知识点标签数组 |
| `difficulty` | 1-3 |
| `tags` | 年份、学科、题型、子站 |

> 图片题暂以「（图略）」在题干中标注，`imagePath` 字段保留可选。

## 本地开发

```bash
npm install
npm run dev    # http://localhost:3000
npm run build
```

AI 引导需在环境变量中配置 `AI_API_KEY`（DeepSeek）。

## 技术栈

Next.js 14 (App Router, SSG) · TypeScript · Tailwind CSS 3 · KaTeX · DeepSeek API