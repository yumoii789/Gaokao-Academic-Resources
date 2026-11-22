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
  structured?: StructuredPaperIndex;
}

export interface QuestionProvenance {
  repository: 'deekur/gaokaomath' | 'deekur/gaokaophysics';
  paperId: string;
  page: number;
  questionNumber: number;
  extraction: 'text' | 'ocr';
  confidence: number | null;
  needsReview: boolean;
}

export interface StructuredPaperIndex {
  paperId: string;
  count: number;
  file: string;
  textPages: number;
  ocrPages: number;
  emptyPages?: number;
  reviewCount: number;
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
  provenance?: QuestionProvenance;
}
