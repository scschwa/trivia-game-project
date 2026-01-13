'use client';

import { useCallback } from 'react';
import { useDropzone, Accept } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { CSVValidationError } from '@/types';

interface CSVUploadProps {
  onFileContent: (content: string) => void;
  errors?: CSVValidationError[];
  isValid?: boolean;
  isValidating?: boolean;
  className?: string;
}

export function CSVUpload({ 
  onFileContent, 
  errors = [], 
  isValid,
  isValidating = false,
  className 
}: CSVUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        onFileContent(content);
      };
      reader.readAsText(file);
    }
  }, [onFileContent]);
  
  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] } as Accept,
    multiple: false,
  });
  
  const hasFile = acceptedFiles.length > 0;
  
  return (
    <div className={cn('space-y-4', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
          isDragActive && 'border-primary-500 bg-primary-50',
          hasFile && isValid && 'border-green-500 bg-green-50',
          hasFile && !isValid && errors.length > 0 && 'border-red-500 bg-red-50',
          !isDragActive && !hasFile && 'border-gray-300 hover:border-primary-400 hover:bg-gray-50',
        )}
      >
        <input {...getInputProps()} />
        
        {isValidating ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-600">Validating CSV...</p>
          </div>
        ) : hasFile ? (
          <div className="flex flex-col items-center gap-3">
            {isValid ? (
              <>
                <CheckCircle className="w-12 h-12 text-green-500" />
                <div>
                  <p className="font-medium text-green-700">{acceptedFiles[0].name}</p>
                  <p className="text-sm text-green-600">CSV validated successfully</p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="w-12 h-12 text-red-500" />
                <div>
                  <p className="font-medium text-red-700">{acceptedFiles[0].name}</p>
                  <p className="text-sm text-red-600">{errors.length} error(s) found</p>
                </div>
              </>
            )}
            <p className="text-sm text-gray-500">Drop a new file to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className={cn(
              'w-12 h-12',
              isDragActive ? 'text-primary-500' : 'text-gray-400'
            )} />
            <div>
              <p className="font-medium text-gray-700">
                {isDragActive ? 'Drop your CSV here' : 'Drag & drop a CSV file'}
              </p>
              <p className="text-sm text-gray-500">or click to browse</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Error table */}
      {errors.length > 0 && (
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <h4 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Validation Errors
          </h4>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-red-700 border-b border-red-200">
                <tr>
                  <th className="pb-2 pr-4">Row</th>
                  <th className="pb-2 pr-4">Column</th>
                  <th className="pb-2">Error</th>
                </tr>
              </thead>
              <tbody className="text-red-800">
                {errors.map((error, index) => (
                  <tr key={index} className="border-b border-red-100 last:border-0">
                    <td className="py-2 pr-4">{error.row}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{error.column}</td>
                    <td className="py-2">{error.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* CSV format help */}
      <div className="bg-gray-50 rounded-xl p-4 text-sm">
        <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Required CSV Format
        </h4>
        <p className="text-gray-600 mb-2">Your CSV must include these columns:</p>
        <code className="block bg-gray-200 p-2 rounded text-xs overflow-x-auto">
          roundNumber, questionNumber, question, answerA, answerB, answerC, answerD, correctAnswer, points (optional)
        </code>
      </div>
    </div>
  );
}
