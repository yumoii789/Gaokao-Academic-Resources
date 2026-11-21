import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '词汇工作室 — 小墨高考',
  description: '高考核心词汇卡片，按难度分级，翻卡记忆与掌握进度追踪。',
};

export default function VocabLayout({ children }: { children: ReactNode }) {
  return children;
}
