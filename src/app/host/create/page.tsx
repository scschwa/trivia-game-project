'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, FileText } from 'lucide-react';
import { CSVUpload } from '@/components/ui/CSVUpload';
import { validateCSV, createTriviaConfig } from '@/actions/config';
import { CSVValidationError, Question } from '@/types';

export default function CreateConfigPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [errors, setErrors] = useState<CSVValidationError[]>([]);
  const [isValid, setIsValid] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  
  const handleCSVContent = async (content: string) => {
    setIsValidating(true);
    setErrors([]);
    setIsValid(false);
    setQuestions([]);
    
    try {
      const result = await validateCSV(content);
      setErrors(result.errors);
      setIsValid(result.valid);
      if (result.valid) {
        setQuestions(result.questions);
      }
    } catch (error) {
      setErrors([{ row: 0, column: 'CSV', value: '', message: 'Failed to parse CSV' }]);
    } finally {
      setIsValidating(false);
    }
  };
  
  const handleSave = async () => {
    if (!name.trim()) {
      setSaveError('Please enter a config name');
      return;
    }
    
    if (!isValid || questions.length === 0) {
      setSaveError('Please upload a valid CSV');
      return;
    }
    
    setIsSaving(true);
    setSaveError('');
    
    try {
      const result = await createTriviaConfig(name.trim(), description.trim() || undefined, questions);
      
      if (result.success) {
        router.push('/host/start');
      } else {
        setSaveError(result.error || 'Failed to save config');
      }
    } catch (error) {
      setSaveError('An error occurred');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Group questions by round for preview
  const questionsByRound = questions.reduce((acc, q) => {
    if (!acc[q.roundNumber]) {
      acc[q.roundNumber] = [];
    }
    acc[q.roundNumber].push(q);
    return acc;
  }, {} as Record<number, Question[]>);
  
  const totalRounds = Object.keys(questionsByRound).length;
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Create Trivia Config</h1>
            <p className="text-gray-600">Upload a CSV with your questions</p>
          </div>
        </div>
        
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Form */}
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-500" />
                Config Details
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="label">Config Name *</label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Friday Night Trivia"
                    className="input-field"
                  />
                </div>
                
                <div>
                  <label htmlFor="description" className="label">Description (optional)</label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add a description..."
                    rows={3}
                    className="input-field resize-none"
                  />
                </div>
              </div>
            </div>
            
            <div className="card">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Upload Questions</h2>
              <CSVUpload
                onFileContent={handleCSVContent}
                errors={errors}
                isValid={isValid}
                isValidating={isValidating}
              />
            </div>
            
            {/* Save Button */}
            <div className="card">
              {saveError && (
                <p className="text-red-500 mb-4">{saveError}</p>
              )}
              
              <button
                onClick={handleSave}
                disabled={!isValid || !name.trim() || isSaving}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Config
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Right Column - Preview */}
          <div className="card lg:sticky lg:top-8 lg:h-fit">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Preview</h2>
            
            {questions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Upload a CSV to see preview</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-4 text-sm">
                  <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full">
                    {totalRounds} Rounds
                  </div>
                  <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                    {questions.length} Questions
                  </div>
                </div>
                
                <div className="max-h-96 overflow-y-auto space-y-4">
                  {Object.entries(questionsByRound).map(([round, roundQuestions]) => (
                    <div key={round} className="border-l-4 border-purple-500 pl-4">
                      <h3 className="font-semibold text-gray-700 mb-2">
                        Round {round} ({roundQuestions.length} questions)
                      </h3>
                      <ul className="space-y-2">
                        {roundQuestions.map((q, idx) => (
                          <li key={idx} className="text-sm text-gray-600 truncate">
                            <span className="font-medium">Q{q.questionNumber}:</span> {q.question}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
