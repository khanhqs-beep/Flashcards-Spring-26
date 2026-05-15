import { useState, useEffect, useCallback } from "react";
import {
  fetchFlashcards,
  updateFlashcard,
  regenerateImage,
} from "../utils/api";
import type { Flashcard } from "../utils/api";
import {
  Loader2,
  AlertCircle,
  Save,
  RefreshCw,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
} from "lucide-react";

const PAGE_SIZE = 20;

interface EditState {
  [word: string]: Partial<Flashcard>;
}

export function BulkReview() {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [edits, setEdits] = useState<EditState>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({});
  const [successMsg, setSuccessMsg] = useState<Record<string, string>>({});

  const loadFlashcards = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchFlashcards();
      setFlashcards(response.data);
      setEdits({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlashcards();
  }, [loadFlashcards]);

  const totalPages = Math.ceil(flashcards.length / PAGE_SIZE);
  const pageCards = flashcards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleFieldChange = (word: string, field: string, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [word]: { ...prev[word], [field]: value },
    }));
  };

  const hasEdits = (word: string) => {
    const e = edits[word];
    if (!e) return false;
    const card = flashcards.find((c) => c.word === word);
    if (!card) return false;
    return Object.entries(e).some(
      ([key, val]) => val !== card[key as keyof Flashcard]
    );
  };

  const handleSave = async (word: string) => {
    const e = edits[word];
    if (!e) return;
    setSaving((prev) => ({ ...prev, [word]: true }));
    try {
      const result = await updateFlashcard(word, e);
      setFlashcards((prev) =>
        prev.map((c) => (c.word === word ? result.data : c))
      );
      setEdits((prev) => {
        const next = { ...prev };
        delete next[word];
        return next;
      });
      showSuccess(word, "Saved");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving((prev) => ({ ...prev, [word]: false }));
    }
  };

  const handleDiscard = (word: string) => {
    setEdits((prev) => {
      const next = { ...prev };
      delete next[word];
      return next;
    });
  };

  const handleRegenerate = async (word: string) => {
    setRegenerating((prev) => ({ ...prev, [word]: true }));
    try {
      await regenerateImage(word);
      showSuccess(word, "Image regeneration triggered");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setRegenerating((prev) => ({ ...prev, [word]: false }));
    }
  };

  const showSuccess = (word: string, msg: string) => {
    setSuccessMsg((prev) => ({ ...prev, [word]: msg }));
    setTimeout(() => {
      setSuccessMsg((prev) => {
        const next = { ...prev };
        delete next[word];
        return next;
      });
    }, 2000);
  };

  const getVal = (card: Flashcard, field: keyof Flashcard) => {
    return edits[card.word]?.[field] ?? card[field] ?? "";
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
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-700" />
          <span className="text-red-800">{error}</span>
          <button
            onClick={loadFlashcards}
            className="ml-auto px-4 py-2 border-2 border-red-600 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (flashcards.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-8 text-center">
        <p className="text-white text-xl">No flashcards to review</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-white" style={{ fontWeight: 500 }}>
          Bulk Review ({flashcards.length} cards)
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={loadFlashcards}
            className="px-4 py-2 border-2 border-white text-white rounded-lg hover:bg-white hover:text-[#003D82] transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1 px-3 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>
          <span className="text-white">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="flex items-center gap-1 px-3 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {pageCards.map((card) => (
          <div
            key={card.word}
            className={`bg-white rounded-xl shadow-lg overflow-hidden transition-all ${
              hasEdits(card.word) ? "ring-2 ring-yellow-400" : ""
            }`}
          >
            {/* Image */}
            <div className="relative h-36 bg-gradient-to-br from-gray-100 to-gray-200">
              {card.mediaLink ? (
                <img
                  src={card.mediaLink}
                  className="w-full h-full object-cover"
                  alt={card.word}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <ImageIcon className="w-10 h-10" />
                </div>
              )}
              <button
                onClick={() => handleRegenerate(card.word)}
                disabled={regenerating[card.word]}
                className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg shadow hover:bg-white transition-colors"
                title="Regenerate image"
              >
                <RefreshCw
                  className={`w-4 h-4 text-[#003D82] ${
                    regenerating[card.word] ? "animate-spin" : ""
                  }`}
                />
              </button>
            </div>

            {/* Editable Fields */}
            <div className="p-3 space-y-2">
              {/* Word (read-only, it's the PK) */}
              <div className="text-center">
                <span className="text-[#003D82] font-semibold text-lg">
                  {card.word}
                </span>
              </div>

              {/* Part of Speech */}
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">
                  Part of Speech
                </label>
                <input
                  type="text"
                  value={getVal(card, "partOfSpeech")}
                  onChange={(e) =>
                    handleFieldChange(card.word, "partOfSpeech", e.target.value)
                  }
                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-[#5DADE2] focus:outline-none focus:ring-1 focus:ring-[#5DADE2]"
                />
              </div>

              {/* CEFR Level */}
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">
                  CEFR Level
                </label>
                <select
                  value={getVal(card, "label")}
                  onChange={(e) =>
                    handleFieldChange(card.word, "label", e.target.value)
                  }
                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-[#5DADE2] focus:outline-none focus:ring-1 focus:ring-[#5DADE2]"
                >
                  <option value="A1">A1</option>
                  <option value="A2">A2</option>
                  <option value="B1">B1</option>
                  <option value="B2">B2</option>
                  <option value="C1">C1</option>
                  <option value="C2">C2</option>
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">
                  Category
                </label>
                <input
                  type="text"
                  value={getVal(card, "category")}
                  onChange={(e) =>
                    handleFieldChange(card.word, "category", e.target.value)
                  }
                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-[#5DADE2] focus:outline-none focus:ring-1 focus:ring-[#5DADE2]"
                />
              </div>

              {/* Definition */}
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">
                  Definition
                </label>
                <textarea
                  value={getVal(card, "definition")}
                  onChange={(e) =>
                    handleFieldChange(card.word, "definition", e.target.value)
                  }
                  rows={2}
                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-[#5DADE2] focus:outline-none focus:ring-1 focus:ring-[#5DADE2] resize-none"
                />
              </div>

              {/* Example Sentence */}
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">
                  Example Sentence
                </label>
                <textarea
                  value={getVal(card, "exampleSentence")}
                  onChange={(e) =>
                    handleFieldChange(
                      card.word,
                      "exampleSentence",
                      e.target.value
                    )
                  }
                  rows={2}
                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-[#5DADE2] focus:outline-none focus:ring-1 focus:ring-[#5DADE2] resize-none"
                />
              </div>

              {/* Success message */}
              {successMsg[card.word] && (
                <div className="flex items-center gap-1 text-green-600 text-xs">
                  <Check className="w-3 h-3" />
                  {successMsg[card.word]}
                </div>
              )}

              {/* Action buttons */}
              {hasEdits(card.word) && (
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    onClick={() => handleSave(card.word)}
                    disabled={saving[card.word]}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                  >
                    {saving[card.word] ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3" />
                    )}
                    Save
                  </button>
                  <button
                    onClick={() => handleDiscard(card.word)}
                    className="flex items-center justify-center gap-1 px-2 py-1.5 bg-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Discard
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1 px-3 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>
          <span className="text-white">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="flex items-center gap-1 px-3 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
