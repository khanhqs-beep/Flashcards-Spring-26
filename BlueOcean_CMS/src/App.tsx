import { useState } from "react";
import { FileUploader } from "./components/FileUploader";
import { FileCard } from "./components/FileCard";
import { FlashcardLibrary } from "./components/FlashcardLibrary";
import { BulkReview } from "./components/BulkReview";
import type { FileData, WordCard } from "./types";
import companyLogo from "./assets/company_logo.svg";

export default function App() {
  const [uploadedFiles, setUploadedFiles] = useState<
    FileData[]
  >([]);
  const [activeTab, setActiveTab] = useState<"library" | "review">("review");

  const handleFilesUploaded = (newFiles: FileData[]) => {
    setUploadedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleDeleteFile = (id: string) => {
    setUploadedFiles((prev) =>
      prev.filter((file) => file.id !== id),
    );
  };

  const handleProgressUpdate = (
    id: string,
    progress: number,
  ) => {
    setUploadedFiles((prev) =>
      prev.map((file) =>
        file.id === id ? { ...file, progress } : file,
      ),
    );
  };

  const handleFileComplete = (
    id: string,
    processedData: WordCard[],
  ) => {
    setUploadedFiles((prev) =>
      prev.map((file) =>
        file.id === id
          ? {
              ...file,
              status: "completed" as const,
              processedData,
              progress: 100,
            }
          : file,
      ),
    );
  };

  const handleFileError = (
    id: string,
    errorMessage: string,
  ) => {
    setUploadedFiles((prev) =>
      prev.map((file) =>
        file.id === id
          ? { ...file, status: "error" as const, errorMessage }
          : file,
      ),
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#5DADE2] via-[#3498DB] to-[#0047AB]">
      <header className="bg-[#003D82] border-b border-blue-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Company logo */}
          <img src={companyLogo} alt="Company Logo" className="h-12 w-auto object-contain mb-4" style={{ filter: 'brightness(0) invert(1)' }}/>
          <div className="text-center">
            <h1 className="text-white">
              Content Management System
            </h1>
            <p className="text-blue-100 mt-2">
              Upload PDF, CSV, or XLS files to process and export
              as CSV or JSON
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <FileUploader
          onFilesUploaded={handleFilesUploaded}
          onProgressUpdate={handleProgressUpdate}
          onFileComplete={handleFileComplete}
          onFileError={handleFileError}
        />

        {uploadedFiles.length > 0 && (
          <div className="mt-8">
            <h2 className="text-white mb-4">Uploaded Files</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {uploadedFiles.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  onDelete={handleDeleteFile}
                />
              ))}
            </div>
          </div>
        )}

        {uploadedFiles.length === 0 && (
          <div className="text-center py-12">
            <p className="text-white/80">
              No files uploaded yet. Drop some files above to
              get started.
            </p>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mt-12 flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("library")}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === "library"
                ? "bg-white text-[#003D82] shadow-lg"
                : "bg-white/20 text-white hover:bg-white/30"
            }`}
          >
            Flashcard Library
          </button>
          <button
            onClick={() => setActiveTab("review")}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === "review"
                ? "bg-white text-[#003D82] shadow-lg"
                : "bg-white/20 text-white hover:bg-white/30"
            }`}
          >
            Bulk Review
          </button>
        </div>

        {activeTab === "library" ? <FlashcardLibrary /> : <BulkReview />}
      </main>
    </div>
  );
}