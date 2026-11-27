// 词汇工作室 · 共享类型（词汇侧独立 schema，不改全局 src/types.ts）
// 词条/题库 schema 对齐 docs/vocab-design-proposal.md §6.2 / §6.4

export interface Sense {
  pos: string;
  zh: string;
  exampleEn: string;
  exampleZh: string;
}

export interface WordForms {
  plural?: string;
  past?: string;
  pastParticiple?: string;
  presentParticiple?: string;
  thirdPerson?: string;
  comparative?: string;
  superlative?: string;
}

export interface VocabWord {
  id: string;
  word: string;
  translation: string;
  phoneticUk: string;
  phoneticUs: string;
  difficulty: number; // 1 基础 / 2 进阶 / 3 冲刺
  book: string;
  senses: Sense[];
  grammar: string;
  forms: WordForms;
}

export interface ChoiceOption {
  text: string;
  isCorrect: boolean;
}

export type LearnMode = 'en2zh' | 'zh2en' | 'spell';
export type QuizMode = LearnMode | 'grammar';

export interface QuizRecord {
  status: 'correct' | 'wrong';
  chosen: string;
  at: number;
  mode: QuizMode;
}

export interface RatioSettings {
  correct: number;
  wrong: number;
  unseen: number;
}

export interface QuizSettings {
  ratio: RatioSettings;
  book: string;
  lastMode: QuizMode;
}

export interface QuizStore {
  settings: QuizSettings;
  records: Record<string, QuizRecord>;
}

// 本轮抽题队列（持久化，保证刷新后"上一个"仍可用）—— proposal §7.1
export interface QuizQueue {
  mode: QuizMode;
  size: number;
  items: string[];
  pos: number;
}

export interface GrammarAnalysis {
  grammar: string;
  sentenceZh: string;
  wordGloss: { en: string; zh: string }[];
}

// 语法完形题库 schema —— proposal §6.4
export interface GrammarItem {
  id: string;
  sentence: string;
  options: string[]; // 恒 4 项
  answerIndex: number;
  analysis: GrammarAnalysis;
  difficulty: number;
  tags: string[];
}
