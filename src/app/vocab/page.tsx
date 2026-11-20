import React, { useState } from 'react';
import mockData from '@/data/mock_data.json';

export default function VocabPage() {
  const words = mockData.vocab;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const currentWord = words[currentIndex];

  return (
    <div className='min-h-screen bg-[#fffdfa] text-[#1a1a1a]'>
      <header className='py-12 px-6 max-w-4xl mx-auto text-center'>
        <h1 className='academic-title text-5xl font-bold text-amber-700 mb-4'>Vocabulary Studio</h1>
        <p className='text-slate-500 text-lg leading-relaxed'>把词汇记忆变成一场探索之旅。</p>
      </header>
      <main className='max-w-xl mx-auto px-6 pb-24'>
        <div 
          className='relative h-96 w-full perspective-1000 cursor-pointer mb-12'
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <div className={'relative w-full h-full transition-all duration-500 preserve-3d ' + (isFlipped ? 'rotate-y-180' : '')}>
            <div className='absolute inset-0 backface-hidden glass-card rounded-3xl flex flex-col items-center justify-center p-12 border-amber-100 bg-white'>
              <span className='text-xs font-mono text-amber-400 mb-4'>WORD</span>
              <h2 className='text-6xl font-bold text-amber-900 academic-title'>{currentWord.word}</h2>
              <p className='mt-8 text-slate-400 text-sm'>点击翻页查看释义</p>
            </div>
            <div className='absolute inset-0 backface-hidden rotate-y-180 glass-card rounded-3xl flex flex-col items-center justify-center p-12 border-amber-100 bg-amber-50'>
              <span className='text-xs font-mono text-amber-600 mb-4'>TRANSLATION</span>
              <h2 className='text-4xl font-bold text-amber-900 mb-6'>{currentWord.translation}</h2>
              <p className='text-slate-600 italic text-center leading-relaxed'>"{currentWord.example}"</p>
            </div>
          </div>
        </div>
        <div className='flex justify-between items-center px-4'>
          <button 
            onClick={() => {setIsFlipped(false); setCurrentIndex(prev => Math.max(0, prev - 1))}}
            className='px-6 py-2 rounded-full border border-amber-200 text-amber-700 hover:bg-amber-50 transition-all'
          >上一个</button>
          <span className='text-sm font-mono text-slate-400'>{currentIndex + 1} / {words.length}</span>
          <button 
            onClick={() => {setIsFlipped(false); setCurrentIndex(prev => Math.min(words.length - 1, prev + 1))}}
            className='px-6 py-2 rounded-full bg-amber-600 text-white hover:bg-amber-700 transition-all shadow-lg shadow-amber-200'
          >下一个</button>
        </div>
      </main>
      <style jsx>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
}
