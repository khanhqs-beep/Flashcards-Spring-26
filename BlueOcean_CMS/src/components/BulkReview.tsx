import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchFlashcards,
  fetchFlashcardByWord,
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
  Search,
} from "lucide-react";

const PAGE_SIZE = 20;

interface EditState {
  [word: string]: Partial<Flashcard>;
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function ExpandableInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (expanded) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setExpanded(false)}
        placeholder={placeholder}
        rows={3}
        autoFocus
        className="w-full px-1 py-0.5 text-xs h-auto border border-blue-300 rounded focus:border-[#5DADE2] focus:outline-none focus:ring-1 focus:ring-[#5DADE2] resize-none"
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setExpanded(true)}
      placeholder={placeholder}
      title={value}
      className="w-full px-1 py-0.5 text-xs h-6 border border-gray-200 rounded focus:border-[#5DADE2] focus:outline-none focus:ring-1 focus:ring-[#5DADE2] truncate"
    />
  );
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
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [imgBust, setImgBust] = useState<Record<string, number>>({});
  const searchRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 150);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setPage(0);
  }, [debouncedQuery]);

  const filtered = debouncedQuery
    ? flashcards.filter((c) => {
        const q = debouncedQuery.toLowerCase();
        return (
          c.word.toLowerCase().includes(q) ||
          (c.definition ?? "").toLowerCase().includes(q) ||
          (c.exampleSentence ?? "").toLowerCase().includes(q) ||
          (c.category ?? "").toLowerCase().includes(q) ||
          (c.partOfSpeech ?? "").toLowerCase().includes(q)
        );
      }).sort((a, b) => {
        const q = debouncedQuery.toLowerCase();
        const aExact = a.word.toLowerCase() === q ? 0 : a.word.toLowerCase().startsWith(q) ? 1 : a.word.toLowerCase().includes(q) ? 2 : 3;
        const bExact = b.word.toLowerCase() === q ? 0 : b.word.toLowerCase().startsWith(q) ? 1 : b.word.toLowerCase().includes(q) ? 2 : 3;
        return aExact - bExact;
      })
    : flashcards;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageCards = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
      // Capture current mediaLink to detect change
      const currentCard = flashcards.find((c) => c.word === word);
      const oldLink = currentCard?.mediaLink ?? "";

      await regenerateImage(word);
      showSuccess(word, "Regenerating…");

      // Poll every 5s for up to 30s until image URL changes
      let attempts = 0;
      const maxAttempts = 6;
      const poll = async () => {
        attempts++;
        try {
          const result = await fetchFlashcardByWord(word);
          const newLink = result.data.mediaLink ?? "";
          // Detect change: different URL, or same URL but we assume regen done after 30s
          if (newLink !== oldLink || attempts >= maxAttempts) {
            setFlashcards((prev) =>
              prev.map((c) => (c.word === word ? result.data : c))
            );
            setImgBust((prev) => ({ ...prev, [word]: Date.now() }));
            setRegenerating((prev) => ({ ...prev, [word]: false }));
            showSuccess(word, "Image updated");
            return;
          }
        } catch {
          // fetch failed, keep polling
        }
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        } else {
          // Final timeout — force cache bust anyway
          setImgBust((prev) => ({ ...prev, [word]: Date.now() }));
          setRegenerating((prev) => ({ ...prev, [word]: false }));
          showSuccess(word, "Refresh to see new image");
        }
      };
      setTimeout(poll, 5000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Regeneration failed");
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
    }, 3000);
  };

  const getVal = (card: Flashcard, field: keyof Flashcard) => {
    return edits[card.word]?.[field] ?? card[field] ?? "";
  };

  const imgSrc = (card: Flashcard) => {
    if (!card.mediaLink) return "";
    const bust = imgBust[card.word];
    return bust ? `${card.mediaLink}?t=${bust}` : card.mediaLink;
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
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-white text-sm whitespace-nowrap" style={{ fontWeight: 500 }}>
          Bulk Review ({debouncedQuery ? `${filtered.length} of ${flashcards.length}` : flashcards.length} cards)
        </h2>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearchQuery("");
                searchRef.current?.blur();
              }
            }}
            placeholder="Search flashcards..."
            className="w-full pl-8 pr-7 py-1.5 text-sm bg-white/20 text-white placeholder-white/50 border border-white/30 rounded-lg focus:bg-white/30 focus:outline-none focus:ring-1 focus:ring-white/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-0.5 px-2 py-1 text-xs bg-white/20 text-white rounded hover:bg-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3 h-3" /> Prev
            </button>
            <span className="text-white text-xs">
              {page + 1}/{totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-0.5 px-2 py-1 text-xs bg-white/20 text-white rounded hover:bg-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
        <button
          onClick={loadFlashcards}
          className="px-3 py-1.5 text-sm border border-white text-white rounded-lg hover:bg-white hover:text-[#003D82] transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Empty search state */}
      {filtered.length === 0 && debouncedQuery && (
        <div className="bg-white/10 border border-white/20 rounded-lg p-6 text-center">
          <p className="text-white/80">No flashcards match &lsquo;{debouncedQuery}&rsquo;</p>
        </div>
      )}

      {/* Card Grid */}
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {pageCards.map((card) => (
            <div
              key={card.word}
              className={`bg-white rounded-lg shadow overflow-hidden transition-all max-w-[240px] ${
                hasEdits(card.word) ? "ring-2 ring-yellow-400" : ""
              }`}
            >
              {/* Image */}
              <div className="relative aspect-square bg-gradient-to-br from-gray-100 to-gray-200">
                {card.mediaLink ? (
                  <img
                    src={imgSrc(card)}
                    className="w-full h-full object-cover rounded-t-lg"
                    alt={card.word}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
                <button
                  onClick={() => handleRegenerate(card.word)}
                  disabled={regenerating[card.word]}
                  className="absolute top-1 right-1 p-0.5 bg-white/90 rounded shadow hover:bg-white transition-colors"
                  title="Regenerate image"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-[#003D82] ${
                      regenerating[card.word] ? "animate-spin" : ""
                    }`}
                  />
                </button>
                {regenerating[card.word] && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                    <span className="text-white text-[10px] mt-1">Regenerating…</span>
                  </div>
                )}
                {successMsg[card.word] && !regenerating[card.word] && (
                  <div className="absolute bottom-0 left-0 right-0 bg-green-500/90 text-white text-[10px] text-center py-0.5 flex items-center justify-center gap-0.5">
                    <Check className="w-2.5 h-2.5" />
                    {successMsg[card.word]}
                  </div>
                )}
              </div>

              {/* Fields */}
              <div className="p-2 space-y-0.5">
                {/* Row 1: word + save/discard */}
                <div className="flex items-center justify-between min-h-[20px]">
                  <span className="text-[#003D82] font-semibold text-sm truncate flex-1" title={card.word}>
                    <HighlightMatch text={card.word} query={debouncedQuery} />
                  </span>
                  {hasEdits(card.word) && (
                    <div className="flex items-center gap-0.5 ml-1 shrink-0">
                      <button
                        onClick={() => handleSave(card.word)}
                        disabled={saving[card.word]}
                        className="p-0.5 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 transition-colors"
                        title="Save changes"
                      >
                        {saving[card.word] ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDiscard(card.word)}
                        className="p-0.5 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-colors"
                        title="Discard changes"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Row 2: POS + CEFR */}
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={getVal(card, "partOfSpeech")}
                    onChange={(e) =>
                      handleFieldChange(card.word, "partOfSpeech", e.target.value)
                    }
                    placeholder="POS"
                    title="Part of Speech"
                    className="flex-1 min-w-0 px-1 py-0.5 text-xs h-6 border border-gray-200 rounded focus:border-[#5DADE2] focus:outline-none focus:ring-1 focus:ring-[#5DADE2]"
                  />
                  <select
                    value={getVal(card, "label")}
                    onChange={(e) =>
                      handleFieldChange(card.word, "label", e.target.value)
                    }
                    title="CEFR Level"
                    className="w-14 px-1 py-0.5 text-xs h-6 border border-gray-200 rounded focus:border-[#5DADE2] focus:outline-none focus:ring-1 focus:ring-[#5DADE2]"
                  >
                    <option value="A1">A1</option>
                    <option value="A2">A2</option>
                    <option value="B1">B1</option>
                    <option value="B2">B2</option>
                    <option value="C1">C1</option>
                    <option value="C2">C2</option>
                  </select>
                </div>

                {/* Row 3: Category */}
                <input
                  type="text"
                  value={getVal(card, "category")}
                  onChange={(e) =>
                    handleFieldChange(card.word, "category", e.target.value)
                  }
                  placeholder="Category"
                  title="Category"
                  className="w-full px-1 py-0.5 text-xs h-6 border border-gray-200 rounded focus:border-[#5DADE2] focus:outline-none focus:ring-1 focus:ring-[#5DADE2]"
                />

                {/* Row 4: Definition */}
                <ExpandableInput
                  value={String(getVal(card, "definition"))}
                  onChange={(v) => handleFieldChange(card.word, "definition", v)}
                  placeholder="Definition"
                />

                {/* Row 5: Example */}
                <ExpandableInput
                  value={String(getVal(card, "exampleSentence"))}
                  onChange={(v) => handleFieldChange(card.word, "exampleSentence", v)}
                  placeholder="Example sentence"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-0.5 px-2 py-1 text-xs bg-white/20 text-white rounded hover:bg-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3 h-3" /> Prev
          </button>
          <span className="text-white text-xs">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="flex items-center gap-0.5 px-2 py-1 text-xs bg-white/20 text-white rounded hover:bg-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
