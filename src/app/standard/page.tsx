import React from 'react';
import QuestionBrowser from '@/components/ui/QuestionBrowser';
import mockData from '@data/mock_data.json';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '普通高考真题练习 — 小墨高考',
  description: '历年普通高考真题在线浏览，逐题作答，即时查看解析。',
  openGraph: {
    title: '普通高考真题练习 — 小墨高考',
    description: '历年普通高考真题在线浏览，逐题作答，即时查看解析。',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: '小墨高考 — AI驱动的学业提升平台' }],
  },
};

export default function StandardPage() {
  const questions = mockData.standard;

  return (
    <div className='min-h-screen bg-[#fdfdfd] text-[#1a1a1a]'>
      <header className='py-12 px-6 max-w-5xl mx-auto'>
        <h1 className='academic-title text-4xl md:text-5xl font-bold text-indigo-900 mb-4'>普通高考 · 数理资源库</h1>
        <p className='text-slate-500 text-lg max-w-2xl leading-relaxed'>
          一个为追求极致学术体验而设计的资源平台。覆盖数十年高考真题，通过启发式 AI 引导，将答案转化为能力。
        </p>
      </header>

      <main className='max-w-5xl mx-auto px-6 pb-24'>
        <QuestionBrowser
          questions={questions}
          accent='bg-indigo-600'
        />
      </main>
    </div>
  );
}