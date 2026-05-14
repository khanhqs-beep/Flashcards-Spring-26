import type { WordCard } from '../types';
import { BookOpen, MessageSquare, ImageIcon } from 'lucide-react';

interface FlashcardProps {
  wordCard: WordCard;
}

export function Flashcard({ wordCard }: FlashcardProps) {
  const hasImage = wordCard.image && wordCard.image.trim() !== '';
  
  const handleImageDoubleClick = async () => {
    if (!hasImage) return;
    
    try {
      // Fetch the image
      const response = await fetch(wordCard.image);
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${wordCard.word}.jpg`; // Use word as filename
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };
  
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-2xl">
      {/* Image Section */}
      <div className="relative h-64 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
        {hasImage ? (
          <img
            src={wordCard.image}
            className="w-full h-full border-0 cursor-pointer"
            onDoubleClick={handleImageDoubleClick}
            title="Double-click to download"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
            <ImageIcon className="w-16 h-16 mb-2" />
            <p className="text-sm">Image placeholder</p>
            <p className="text-xs mt-1">AI labeling pending</p>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-6 space-y-4">
        {/* Word and Part of Speech */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-[#003D82] text-center mb-2">{wordCard.word}</h3>
          <div className="flex items-center justify-center gap-2 text-[#5DADE2]">
            <BookOpen className="w-4 h-4" />
            <span className="italic">{wordCard.partOfSpeech}</span>
          </div>
          <p className="text-center text-gray-600 mt-1">CEFR Level: {wordCard.cefrLevel}</p>
        </div>

        {/* Definition */}
        <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-lg border border-blue-100">
          <p className="text-gray-700"><span className="text-[#003D82]">Definition:</span> {wordCard.definition}</p>
        </div>

        {/* Example Sentence */}
        <div className="bg-gradient-to-br from-indigo-50 to-white p-4 rounded-lg border border-indigo-100">
          <div className="flex items-start gap-2">
            <MessageSquare className="w-5 h-5 text-[#5DADE2] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-gray-600 italic">"{wordCard.exampleSentence}"</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}