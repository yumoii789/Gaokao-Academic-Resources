import React from 'react';
import QuestionCard from '@/components/ui/QuestionCard';
import mockData from '@data/mock_data.json';

export default function SpringPage() {
  const questions = mockData.spring;
  return (
    <div className='min-h-screen bg-[#fafffa] text-[#1a1a1a]'>
      <header className='py-12 px-6 max-w-6xl mx-auto text-center'>
        <h1 className='academic-title text-5xl font-bold text-emerald-700 mb-4'>春季高考 · 资源中心</h1>
        <p className='text-slate-500 text-lg max-w-2xl mx-auto leading-relaxed'>轻盈、高效、突破。为春考考生量身定制的精选真题库。</p>
      </header>
      <main className='max-w-6xl mx-auto px-6 pb-24'>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {questions.map((q, idx) => (
            <div key={q.questionId} className={'transition-all duration-500 hover:scale-[1.02] ' + (idx % 3 === 0 ? 'md:col-span-2' : '')}>
              <QuestionCard question={q} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}