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
