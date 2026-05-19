import { useState } from 'react';
import { FileText, Download, Trash2, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Loader, ChevronLeft, ChevronRight } from 'lucide-react';
import type { FileData } from '../types';
import { downloadAsCSV, downloadAsJSON } from '../utils/downloadHelper';
import { Flashcard } from './Flashcard';

interface FileCardProps {
  file: FileData;
  onDelete: (id: string) => void;
}

export function FileCard({ file, onDelete }: FileCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleDownloadCSV = () => {
    downloadAsCSV(file.processedData as unknown as Record<string, unknown>[], `${file.name.split('.')[0]}_processed.csv`);
  };

  const handleDownloadJSON = () => {
    downloadAsJSON(file.processedData as unknown as Record<string, unknown>[], `${file.name.split('.')[0]}_processed.json`);
  };

  const handlePreviousCard = () => {
    setCurrentCardIndex((prev) => (prev > 0 ? prev - 1 : file.processedData.length - 1));
  };

  const handleNextCard = () => {
    setCurrentCardIndex((prev) => (prev < file.processedData.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="bg-white rounded-lg overflow-hidden shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02]">
      <div className="p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 bg-gradient-to-br from-[#5DADE2] to-[#0047AB] rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[#003D82] truncate" title={file.name}>{file.name}</h3>
              <p className="text-[#5DADE2]">{file.type.toUpperCase()}</p>
            </div>
          </div>
          <button
            onClick={() => onDelete(file.id)}
            className="text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
            title="Delete file"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-gray-600">
            <span>Size:</span>
            <span className="text-[#003D82]">{formatFileSize(file.size)}</span>
          </div>
          <div className="flex items-center justify-between text-gray-600">
            <span>Uploaded:</span>
            <span className="text-[#003D82]">{formatDate(file.uploadDate)}</span>
          </div>
          <div className="flex items-center justify-between text-gray-600">
            <span>Words:</span>
            <span className="text-[#003D82]">
              {file.wordCount != null ? file.wordCount : file.type === 'pdf' ? '—' : file.processedData.length}
            </span>
          </div>
        </div>

        <div className="mb-4">
          {file.status === 'processing' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[#3498DB]">
                <div className="flex items-center gap-2">
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </div>
                <span>{file.progress || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#5DADE2] via-[#3498DB] to-[#0047AB] h-2.5 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${file.progress || 0}%` }}
                />
              </div>
            </div>
          )}
          {file.status === 'completed' && (
            <div>
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span>
                  {file.wordCount == null && file.type === 'pdf'
                    ? 'Sent for processing'
                    : 'Processed successfully'}
                </span>
              </div>
              <p className="text-xs text-[#5DADE2] mt-1">
                View results in the Bulk Review tab
              </p>
            </div>
          )}
          {file.status === 'error' && (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-4 h-4" />
              <span>{file.errorMessage || 'Processing error'}</span>
            </div>
          )}
        </div>

        {file.status === 'completed' && (
          <>
            <div className="flex gap-2 mb-4">
              <button
                onClick={handleDownloadCSV}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all shadow-md hover:shadow-lg"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={handleDownloadJSON}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
              >
                <Download className="w-4 h-4" />
                JSON
              </button>
            </div>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-[#5DADE2] rounded-lg hover:bg-[#5DADE2]/10 transition-colors text-[#003D82]"
            >
              {isExpanded ? (
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
          </>
        )}
      </div>

      {isExpanded && file.status === 'completed' && file.processedData.length > 0 && (
        <div className="border-t border-gray-200 bg-gradient-to-br from-gray-50 to-blue-50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[#003D82]">Flashcard Preview</h4>
            <div className="text-[#5DADE2]">
              {currentCardIndex + 1} / {file.processedData.length}
            </div>
          </div>

          <Flashcard wordCard={file.processedData[currentCardIndex]} />

          {/* Navigation Controls */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={handlePreviousCard}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#5DADE2] to-[#3498DB] text-white rounded-lg hover:from-[#3498DB] hover:to-[#0047AB] transition-all shadow-md hover:shadow-lg"
            >
              <ChevronLeft className="w-5 h-5" />
              Previous
            </button>
            <button
              onClick={handleNextCard}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#3498DB] to-[#0047AB] text-white rounded-lg hover:from-[#0047AB] hover:to-[#003D82] transition-all shadow-md hover:shadow-lg"
            >
              Next
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}