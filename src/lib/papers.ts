import mathPapers from '@data/gaokaomath.papers.json';
import physicsPapers from '@data/gaokaophysics.papers.json';
import type { Paper, Question } from '@/types';

const SUBJECT_SLUG: Record<string, string> = {
  '数学': 'math',
  '物理': 'phys',
  '语文': 'chinese',
  '英语': 'english',
  '化学': 'chemistry',
  '生物': 'biology',
  '历史': 'history',
  '地理': 'geography',
  '政治': 'politics',
};

const ARCHIVE_PAPERS = [...mathPapers, ...physicsPapers] as Paper[];

export function buildPapers(track: 'standard' | 'spring', questions: Question[]): Paper[] {
  const groups = new Map<string, Question[]>();
  for (const q of questions) {
    const key = q.year + '|' + q.subject;
    const list = groups.get(key);
    if (list) list.push(q);
    else groups.set(key, [q]);
  }
  return Array.from(groups.entries())
    .map(([key, list]) => {
      const [yearStr, subject] = key.split('|');
      const year = Number(yearStr);
      const slug = SUBJECT_SLUG[subject] || 'gen';
      const sorted = [...list].sort((a, b) =>
        a.questionId.localeCompare(b.questionId, 'en', { numeric: true })
      );
      return {
        paperId: (track === 'spring' ? 'spr-' : 'std-') + slug + '-' + year,
        name: year + '年' + subject + '（' + (track === 'spring' ? '春季' : '普通') + '高考）',
        track,
        year,
        subject,
        questionIds: sorted.map(q => q.questionId),
      };
    })
    .sort((a, b) => b.year - a.year || a.subject.localeCompare(b.subject));
}

export function resolvePapers(
  track: 'standard' | 'spring',
  questions: Question[],
  raw?: unknown,
): Paper[] {
  const explicit = Array.isArray(raw) ? (raw as Paper[]) : [];
  const archive = explicit.length > 0
    ? explicit
    : ARCHIVE_PAPERS.filter(p => p.track === track);
  const papers = archive.length > 0 ? archive : buildPapers(track, questions);
  return [...papers].sort((a, b) => b.year - a.year || a.name.localeCompare(b.name, 'zh-CN'));
}
