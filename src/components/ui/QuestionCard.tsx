
import React, { useState } from 'react';

export default function QuestionCard({ question }) {
  const [showAnalysis, setShowAnalysis] = useState(false);

  return (
    <div className="glass-card p-6 rounded-2xl mb-6">
      <div className="flex justify-between items-start mb-4">
        <span className="text-xs font-mono text-slate-400">#{question.questionId}</span>
        <div className="flex gap-2">
          {question.tags.map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded-full">{tag}</span>
          ))}
        </div>
      </div>
      
      <div className="academic-title text-lg leading-relaxed mb-4">
        {question.content}
      </div>
      
      {question.imagePath && (
        <img src={question.imagePath} alt="Question Figure" className="rounded-lg mb-4 max-w-full h-auto border border-slate-100" />
      )}
      
      <div className="flex gap-3">
        <button 
          onClick={() => setShowAnalysis(!showAnalysis)}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          {showAnalysis ? '隐藏解析' : '查看解析'}
        </button>
        <button className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
          AI 引导
        </button>
      </div>
      
      {showAnalysis && (
        <div className="mt-4 p-4 bg-slate-50 rounded-xl text-sm leading-loose text-slate-700 animate-in fade-in slide-in-from-top-2">
          <div className="font-bold mb-2 text-indigo-900">标准答案：{question.answer}</div>
          <div className="whitespace-pre-wrap">{question.analysis}</div>
        </div>
      )}
    </div>
  );
}
