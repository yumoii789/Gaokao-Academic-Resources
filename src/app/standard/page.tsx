
import React from 'react';
import QuestionCard from '@/components/ui/QuestionCard';
import mockData from '@/data/mock_data.json';

export default function StandardPage() {
  const questions = mockData.standard;

  return (
    <div className="min-h-screen bg-[#fdfdfd] text-[#1a1a1a]">
      {/* Header */}
      <header className="py-12 px-6 max-w-5xl mx-auto">
        <h1 className="academic-title text-5xl font-bold text-indigo-900 mb-4">普通高考 · 数理资源库</h1>
        <p className="text-slate-500 text-lg max-w-2xl leading-relaxed">
          一个为追求极致学术体验而设计的资源平台。覆盖数十年高考真题，通过启发式 AI 引导，将答案转化为能力。
        </p>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-24 flex gap-12">
        {/* Sidebar Filter */}
        <aside className="w-64 shrink-0 hidden md:block">
          <div className="sticky top-12 space-y-8">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">筛选科目</h3>
              <div className="flex flex-col gap-2">
                {['数学', '物理'].map(s => (
                  <button key={s} className="text-left px-3 py-2 text-sm rounded-lg hover:bg-indigo-50 text-indigo-900 font-medium transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">年份范围</h3>
              <div className="grid grid-cols-2 gap-2">
                {[2024, 2023, 2022, 2021].map(y => (
                  <button key={y} className="px-2 py-1 text-xs rounded border border-slate-200 hover:border-indigo-300 transition-colors">
                    {y}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Question Stream */}
        <section className="flex-1">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-semibold text-slate-800">所有题目 ({questions.length})</h2>
            <div className="text-xs text-slate-400 font-mono">Sorted by: Newest</div>
          </div>
          
          <div className="space-y-6">
            {questions.map(q => (
              <QuestionCard key={q.questionId} question={q} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
