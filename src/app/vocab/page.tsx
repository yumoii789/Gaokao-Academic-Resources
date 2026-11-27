'use client';

// 词汇工作室首页 —— Hub ↔ 闪卡复习 的视图开关（§5.1）：闪卡入口保留在本页，其余入口为路由链接。
import React, { useCallback, useState } from 'react';
import Hub from '@/components/vocab/Hub';
import Flashcards from '@/components/vocab/Flashcards';

type VocabView = 'hub' | 'flashcards';

export default function VocabPage() {
  const [view, setView] = useState<VocabView>('hub');
  const openFlashcards = useCallback(() => setView('flashcards'), []);
  const backToHub = useCallback(() => setView('hub'), []);

  if (view === 'flashcards') {
    return <Flashcards onBack={backToHub} />;
  }
  return <Hub onOpenFlashcards={openFlashcards} />;
}
