export interface PaperSource {
  repository: 'deekur/gaokaomath' | 'deekur/gaokaophysics';
  path: string;
  url: string;
  bytes: number;
  format: 'pdf';
}

export interface Paper {
  paperId: string;
  name: string;
  track: 'standard' | 'spring';
  year: number;
  subject: string;
  questionIds: string[];
  source?: PaperSource;
}

export interface Question {
  questionId: string;
  content: string;
  imagePath?: string;
  answer: string;
  analysis: string;
  difficulty: number;
  knowledgePoints: string[];
  tags: string[];
  year: number;
  subject: string;
}
