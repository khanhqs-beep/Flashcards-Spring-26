import { useState, useEffect } from "react";
import { Flashcard } from "./Flashcard";
import { fetchFlashcards } from "../utils/api";
import type { Flashcard as FlashcardType } from "../utils/api";
import { Loader2, AlertCircle, FileText, ChevronDown, ChevronUp, Download, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { downloadAsCSV, downloadAsJSON } from "../utils/downloadHelper";

interface SourceGroup {
  source: string;
  flashcards: FlashcardType[];
  isExpanded: boolean;
  currentCardIndex: number;
}

export function FlashcardLibrary() {
  const [sourceGroups, setSourceGroups] = useState<SourceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFlashcards();
  }, []);

  const loadFlashcards = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchFlashcards();
      
      // Group flashcards by source
      const groupedBySource = response.data.reduce((acc, flashcard) => {
        const source = flashcard.source || "Unknown Source";
        if (!acc[source]) {
          acc[source] = [];
        }
        acc[source].push(flashcard);
        return acc;
      }, {} as Record<string, FlashcardType[]>);

      // Convert to array of source groups
      const groups: SourceGroup[] = Object.entries(groupedBySource).map(([source, flashcards]) => ({
        source,
        flashcards,
        isExpanded: false,
        currentCardIndex: 0,
      }));

      setSourceGroups(groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load flashcards");
      console.error("Error loading flashcards:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (source: string) => {
    setSourceGroups((prev) =>
      prev.map((group) =>
        group.source === source ? { ...group, isExpanded: !group.isExpanded } : group
      )
    );
  };

  const handlePreviousCard = (source: string) => {
    setSourceGroups((prev) =>
      prev.map((group) =>
        group.source === source
          ? {
              ...group,
              currentCardIndex:
                group.currentCardIndex > 0
                  ? group.currentCardIndex - 1
                  : group.flashcards.length - 1,
            }
          : group
      )
    );
  };

  const handleNextCard = (source: string) => {
    setSourceGroups((prev) =>
      prev.map((group) =>
        group.source === source
          ? {
              ...group,
              currentCardIndex:
                group.currentCardIndex < group.flashcards.length - 1
                  ? group.currentCardIndex + 1
                  : 0,
            }
          : group
      )
    );
  };

  const handleDownloadCSV = (source: string, flashcards: FlashcardType[]) => {
    const data = flashcards.map((f) => ({
      word: f.word,
      definition: f.definition,
      partOfSpeech: f.partOfSpeech,
      exampleSentence: f.exampleSentence,
      cefrLevel: f.label,
      category: f.category,
      mediaLink: f.mediaLink,
    }));
    downloadAsCSV(data, `${source.replace(/\.[^/.]+$/, '')}_processed.csv`);
  };

  const handleDownloadJSON = (source: string, flashcards: FlashcardType[]) => {
    const data = flashcards.map((f) => ({
      word: f.word,
      definition: f.definition,
      partOfSpeech: f.partOfSpeech,
      exampleSentence: f.exampleSentence,
      cefrLevel: f.label,
      category: f.category,
      mediaLink: f.mediaLink,
    }));
    downloadAsJSON(data, `${source.replace(/\.[^/.]+$/, '')}_processed.json`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
        <span className="ml-3 text-white">Loading flashcards...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 flex-shrink-0" style={{ color: '#991b1b', strokeWidth: 2 }} />
          <div className="flex-1 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold" style={{ color: '#7f1d1d' }}>Error Loading Flashcards</h3>
              <p className="text-sm mt-1" style={{ color: '#991b1b' }}>{error}</p>
            </div>
            <button
              onClick={loadFlashcards}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
              style={{ 
                border: '2px solid #dc2626',
                color: '#dc2626',
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#dc2626';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#dc2626';
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (sourceGroups.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-8 text-center">
        <FileText className="w-12 h-12 text-white/60 mx-auto mb-4" />
        <h3 className="text-white text-xl font-semibold mb-2">No Flashcards Yet</h3>
        <p className="text-white/80">
          Upload a file to start creating flashcards
        </p>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-white" style={{ fontWeight: 500 }}>
          Flashcard Library
        </h2>
        <button
          onClick={loadFlashcards}
          className="px-4 py-2 border-2 border-white text-white rounded-lg transition-all hover:scale-105 hover:shadow-lg"
          style={{ backgroundColor: 'transparent' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'white';
            e.currentTarget.style.color = '#003D82';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'white';
          }}
        >
          Refresh
        </button>
      </div>

      {/* Grid of file cards matching FileCard layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
        {sourceGroups.map((group) => (
          <div
            key={group.source}
            className="bg-white rounded-lg overflow-hidden shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02]"
          >
            <div className="p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#5DADE2] to-[#0047AB] rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[#003D82] truncate" title={group.source}>
                      {group.source}
                    </h3>
                    <p className="text-[#5DADE2]">PROCESSED</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-gray-600">
                  <span>Source:</span>
                  <span className="text-[#003D82]">Database</span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>Words:</span>
                  <span className="text-[#003D82]">{group.flashcards.length}</span>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span>Ready</span>
                </div>
              </div>

              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => handleDownloadCSV(group.source, group.flashcards)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all shadow-md hover:shadow-lg"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </button>
                <button
                  onClick={() => handleDownloadJSON(group.source, group.flashcards)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
                >
                  <Download className="w-4 h-4" />
                  JSON
                </button>
              </div>

              <button
                onClick={() => toggleExpanded(group.source)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-[#5DADE2] rounded-lg hover:bg-[#5DADE2]/10 transition-colors text-[#003D82]"
              >
                {group.isExpanded ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Hide Preview
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Show Preview
                  </>
                )}
              </button>
            </div>

            {/* Expanded Preview Section */}
            {group.isExpanded && (
              <div className="border-t border-gray-200 bg-gradient-to-br from-gray-50 to-blue-50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[#003D82]">Flashcard Preview</h4>
                  <div className="text-[#5DADE2]">
                    {group.currentCardIndex + 1} / {group.flashcards.length}
                  </div>
                </div>

                <Flashcard
                  wordCard={{
                    word: group.flashcards[group.currentCardIndex].word,
                    image: group.flashcards[group.currentCardIndex].mediaLink,
                    definition: group.flashcards[group.currentCardIndex].definition,
                    partOfSpeech: group.flashcards[group.currentCardIndex].partOfSpeech,
                    exampleSentence: group.flashcards[group.currentCardIndex].exampleSentence,
                    cefrLevel: group.flashcards[group.currentCardIndex].label,
                  }}
                />

                {/* Navigation Controls */}
                <div className="flex items-center justify-center gap-4 mt-6">
                  <button
                    onClick={() => handlePreviousCard(group.source)}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#5DADE2] to-[#3498DB] text-white rounded-lg hover:from-[#3498DB] hover:to-[#0047AB] transition-all shadow-md hover:shadow-lg"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    Previous
                  </button>
                  <button
                    onClick={() => handleNextCard(group.source)}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#3498DB] to-[#0047AB] text-white rounded-lg hover:from-[#0047AB] hover:to-[#003D82] transition-all shadow-md hover:shadow-lg"
                  >
                    Next
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
