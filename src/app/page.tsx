import React from 'react';
import Link from 'next/link';
import mathStructured from '@data/gaokaomath.questions.index.json';
import physicsStructured from '@data/gaokaophysics.questions.index.json';

export default function HomePage() {
  const indexes = [...mathStructured, ...physicsStructured];
  const totalQuestions = indexes.reduce((sum, paper) => sum + paper.count, 0);
  const readyPapers = indexes.filter(paper => paper.count > 0).length;
  const sites = [
    {
      title: '普通高考',
      desc: '按试卷检索，逐题练习，随时获得 AI 引导与逐步解析。',
      path: '/standard',
      color: 'bg-indigo-600',
      lightColor: 'bg-indigo-50',
      textColor: 'text-indigo-900'
    },
    {
      title: '春季高考',
      desc: '春考原卷逐题结构化，结合 AI 助教高效突破。',
      path: '/spring',
      color: 'bg-emerald-600',
      lightColor: 'bg-emerald-50',
      textColor: 'text-emerald-900'
    },
    {
      title: '词汇工作室',
      desc: '温暖、专注。将记忆转化为一种视觉成就感。',
      path: '/vocab',
      color: 'bg-amber-600',
      lightColor: 'bg-amber-50',
      textColor: 'text-amber-900'
    },
  ];

  return (
    <div className='min-h-screen bg-[#fdfdfd] flex items-center justify-center p-6'>
      <div className='max-w-6xl w-full'>
        <header className='text-center mb-12'>
          <div className='inline-flex items-center rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 mb-5'>AI 驱动的学业提升平台</div>
          <h1 className='academic-title text-6xl font-bold text-slate-900 mb-6'>小墨高考</h1>
          <p className='text-slate-500 text-xl max-w-2xl mx-auto'>完整原卷、逐题结构化与 AI 启发式学习</p>
          <div className='mt-8 flex flex-wrap justify-center gap-3'>
            <span className='rounded-2xl bg-white border border-slate-100 px-5 py-3 text-sm text-slate-500'><strong className='mr-1.5 text-xl text-slate-900'>{indexes.length}</strong>份完整原卷</span>
            <span className='rounded-2xl bg-white border border-slate-100 px-5 py-3 text-sm text-slate-500'><strong className='mr-1.5 text-xl text-slate-900'>{totalQuestions.toLocaleString('zh-CN')}</strong>道结构化题目</span>
            <span className='rounded-2xl bg-white border border-slate-100 px-5 py-3 text-sm text-slate-500'><strong className='mr-1.5 text-xl text-slate-900'>{readyPapers}</strong>卷可逐题练习</span>
            <span className='rounded-2xl bg-indigo-600 px-5 py-3 text-sm text-indigo-100'><strong className='mr-1.5 text-xl text-white'>2</strong>种 AI 学习模式</span>
          </div>
        </header>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
          {sites.map(site => (
            <Link 
              key={site.path} 
              href={site.path}
              className='group relative overflow-hidden rounded-3xl p-8 h-80 flex flex-col justify-end transition-all duration-500 hover:-translate-y-2'
            >
              <div className={'absolute inset-0 ' + site.lightColor + ' group-hover:opacity-0 transition-opacity duration-500'} />
              <div className={'absolute inset-0 ' + site.color + ' opacity-0 group-hover:opacity-100 transition-opacity duration-500'} />
              <div className='relative z-10'>
                <h2 className={'text-3xl font-bold mb-3 transition-colors duration-500 ' + site.textColor + ' group-hover:text-white'}>
                  {site.title}
                </h2>
                <p className='text-slate-600 group-hover:text-white/80 transition-colors duration-500 leading-relaxed'>
                  {site.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
