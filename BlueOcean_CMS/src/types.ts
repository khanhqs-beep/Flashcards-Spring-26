export interface FileData {
  id: string;
  name: string;
  type: 'pdf' | 'csv' | 'xls' | 'xlsx';
  uploadDate: Date;
  size: number;
  originalData: unknown;
  processedData: WordCard[];
  status: 'processing' | 'completed' | 'error';
  progress?: number; // 0-100
  errorMessage?: string;
}

export interface WordCard {
  word: string;
  image: string;
  definition: string;
  partOfSpeech: string;
  exampleSentence: string;
  cefrLevel: string;
}

export interface ProcessedRow {
  [key: string]: unknown;
}