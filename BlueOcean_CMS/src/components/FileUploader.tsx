import { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import type { FileData, WordCard } from '../types';
import { uploadFileToBackend } from '../utils/api';

interface FileUploaderProps {
  onFilesUploaded: (files: FileData[]) => void;
  onProgressUpdate: (id: string, progress: number) => void;
  onFileComplete: (id: string, processedData: WordCard[], wordCount?: number | null) => void;
  onFileError: (id: string, errorMessage: string) => void;
}

export function FileUploader({ onFilesUploaded, onProgressUpdate, onFileComplete, onFileError }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setError(null);
      setIsProcessing(true);

      const initialFiles: FileData[] = [];

      // Create initial file entries
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file type
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        const supportedTypes = ['pdf', 'csv', 'xls', 'xlsx'];
        if (!fileExtension || !supportedTypes.includes(fileExtension)) {
          setError(`Invalid file type: ${file.name}. Only PDF, CSV, XLS, and XLSX files are supported.`);
          continue;
        }

        const fileData: FileData = {
          id: Math.random().toString(36).substring(7) + Date.now() + i,
          name: file.name,
          type: fileExtension as 'pdf' | 'csv' | 'xls' | 'xlsx',
          uploadDate: new Date(),
          size: file.size,
          originalData: null,
          processedData: [],
          status: 'processing',
          progress: 0,
        };

        initialFiles.push(fileData);
      }

      // Add files to the list immediately
      onFilesUploaded(initialFiles);

      // Process each file with progress updates
      for (let i = 0; i < initialFiles.length; i++) {
        const fileData = initialFiles[i];
        const file = files[i];

        try {
          // Upload file to backend which will send to n8n
          console.log(`Uploading ${file.name} to backend...`);
          onProgressUpdate(fileData.id, 25);
          
          const response = await uploadFileToBackend(file);
          onProgressUpdate(fileData.id, 90);
          
          console.log('Received response from backend:', response);
          
          // Use the processed data directly from n8n
          // response.data should already be in WordCard[] format from n8n
          const processedData = Array.isArray(response.data) ? response.data : [];

          onProgressUpdate(fileData.id, 100);
          onFileComplete(fileData.id, processedData, response.wordCount);
        } catch (err) {
          console.error('Error processing file:', err);
          onFileError(
            fileData.id,
            err instanceof Error ? err.message : 'Unknown error occurred'
          );
        }
      }

      setIsProcessing(false);
    },
    [onFilesUploaded, onProgressUpdate, onFileComplete, onFileError]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
    },
    [handleFiles]
  );

  return (
    <div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center transition-all
          ${isDragging ? 'border-white bg-white/20 scale-[1.02]' : 'border-white/30 bg-white/10 backdrop-blur-sm'}
          ${isProcessing ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-white/50 hover:bg-white/15'}
        `}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".pdf,.csv,.xls,.xlsx"
          multiple
          onChange={handleFileInputChange}
          disabled={isProcessing}
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="flex flex-col items-center">
            {isProcessing ? (
              <>
                <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-white">Processing files...</p>
              </>
            ) : (
              <>
                <Upload className="w-12 h-12 text-white mb-4" />
                <p className="text-white mb-2">
                  Drag and drop your files here
                </p>
                <p className="text-white">or click to browse</p>
                <div className="flex items-center gap-2 mt-4 text-blue-100">
                  <FileText className="w-4 h-4" />
                  <span>PDF, CSV, XLS, XLSX files supported</span>
                </div>
              </>
            )}
          </div>
        </label>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-500/20 border border-red-400/50 rounded-lg flex items-start gap-3 backdrop-blur-sm">
          <AlertCircle className="w-5 h-5 text-red-200 flex-shrink-0 mt-0.5" />
          <p className="text-red-100">{error}</p>
        </div>
      )}
    </div>
  );
}