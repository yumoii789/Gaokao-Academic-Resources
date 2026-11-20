import React from 'react';
import Link from 'next/link';

export default function HomePage() {
  const sites = [
    {
      title: '普通高考',
      desc: '权威、深邃。覆盖数十年真题，构建学术之基。',
      path: '/standard',
      color: 'bg-indigo-600',
      lightColor: 'bg-indigo-50',
      textColor: 'text-indigo-900'
    },
    {
      title: '春季高考',
      desc: '清新、高效。轻量化设计，助力快速突破。',
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
        <header className='text-center mb-20'>
          <h1 className='academic-title text-6xl font-bold text-slate-900 mb-6'>Academic Resources</h1>
          <p className='text-slate-500 text-xl max-w-2xl mx-auto'>选择你的学习空间，开启学术进阶之旅</p>
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
