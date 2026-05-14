import { BACKEND_URL } from '../config/backend.config';

const API_BASE_URL = BACKEND_URL;

export interface UploadResponse {
  success: boolean;
  data: unknown;
  originalFilename: string;
}

export interface ErrorResponse {
  error: string;
  message?: string;
}

export interface Flashcard {
  id: string;
  word: string;
  category: string;
  definition: string;
  exampleSentence: string;
  label: string;
  mediaLink: string;
  partOfSpeech: string;
  source: string;
}

export interface FlashcardsResponse {
  success: boolean;
  data: Flashcard[];
  count: number;
}

export async function uploadFileToBackend(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('data', file);

  const response = await fetch(`${API_BASE_URL}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData: ErrorResponse = await response.json();
    throw new Error(errorData.message || errorData.error || 'Upload failed');
  }

  return response.json();
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function fetchFlashcards(): Promise<FlashcardsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/flashcards`);

  if (!response.ok) {
    const errorData: ErrorResponse = await response.json();
    throw new Error(errorData.message || errorData.error || 'Failed to fetch flashcards');
  }

  return response.json();
}

export async function fetchFlashcardByWord(word: string): Promise<{ success: boolean; data: Flashcard }> {
  const response = await fetch(`${API_BASE_URL}/api/flashcards/${encodeURIComponent(word)}`);

  if (!response.ok) {
    const errorData: ErrorResponse = await response.json();
    throw new Error(errorData.message || errorData.error || 'Failed to fetch flashcard');
  }

  return response.json();
}
