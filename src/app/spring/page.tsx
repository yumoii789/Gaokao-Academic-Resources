import React from 'react';
import QuestionBrowser from '@/components/ui/QuestionBrowser';
import mockData from '@data/mock_data.json';
import { resolvePapers } from '@/lib/papers';
import type { Paper, Question } from '@/types';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '春季高考真题练习 — 小墨高考',
  description: '春季高考真题在线浏览，逐题作答，即时查看解析。',
  openGraph: {
    title: '春季高考真题练习 — 小墨高考',
    description: '春季高考真题在线浏览，逐题作答，即时查看解析。',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: '小墨高考 — AI驱动的学业提升平台' }],
  },
};

export default function SpringPage() {
  const questions = mockData.spring as Question[];
  const papers = resolvePapers('spring', questions, (mockData as { papers?: Paper[] }).papers);
  return (
    <div className='min-h-screen bg-[#fafffa] text-[#1a1a1a]'>
      <header className='py-12 px-6 max-w-6xl mx-auto text-center'>
        <h1 className='academic-title text-4xl md:text-5xl font-bold text-emerald-700 mb-4'>春季高考 · 资源中心</h1>
        <p className='text-slate-500 text-lg max-w-2xl mx-auto leading-relaxed'>轻盈、高效、突破。为春考考生量身定制的精选真题库。</p>
      </header>
      <main className='max-w-6xl mx-auto px-6 pb-24'>
        <QuestionBrowser
          questions={questions}
          papers={papers}
          accent='bg-emerald-600'
        />
      </main>
    </div>
  );
}