'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play, Settings, Trash2 } from 'lucide-react';
import { getTriviaConfigs, deleteTriviaConfig } from '@/actions/config';
import { startGameSession } from '@/actions/game';
import { ConfirmModal } from '@/components/ui/Modal';

interface TriviaConfig {
  id: string;
  name: string;
  description: string | null;
  totalRounds: number;
  totalQuestions: number;
  createdAt: Date;
  gameCount: number;
}

export default function StartGamePage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<TriviaConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [hostPin, setHostPin] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  useEffect(() => {
    loadConfigs();
  }, []);
  
  const loadConfigs = async () => {
    setIsLoading(true);
    const data = await getTriviaConfigs();
    setConfigs(data);
    if (data.length > 0 && !selectedConfigId) {
      setSelectedConfigId(data[0].id);
    }
    setIsLoading(false);
  };
  
  const handleDelete = async (id: string) => {
    const result = await deleteTriviaConfig(id);
    if (result.success) {
      await loadConfigs();
    } else {
      setError(result.error || 'Failed to delete');
    }
    setDeleteConfirmId(null);
  };
  
  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!selectedConfigId) {
      setError('Please select a trivia config');
      return;
    }
    
    if (!hostPin || hostPin.length < 4) {
      setError('Host PIN must be at least 4 digits');
      return;
    }
    
    if (useCustomCode && customCode.length !== 6) {
      setError('Custom game code must be 6 characters');
      return;
    }
    
    setIsStarting(true);
    
    try {
      const result = await startGameSession(
        selectedConfigId,
        hostPin,
        useCustomCode ? customCode : undefined
      );
      
      if (result.success && result.gameSessionId) {
        // Store PIN temporarily for presenter access
        sessionStorage.setItem(`hostPin_${result.gameSessionId}`, hostPin);
        router.push(`/host/${result.gameSessionId}/lobby`);
      } else {
        setError(result.error || 'Failed to start game');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setIsStarting(false);
    }
  };
  
  const selectedConfig = configs.find((c) => c.id === selectedConfigId);
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Start a Game</h1>
            <p className="text-gray-600">Select a trivia config and set up your game</p>
          </div>
        </div>
        
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Config Selection */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">Select Trivia Config</h2>
                <Link 
                  href="/host/create" 
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  + Create New
                </Link>
              </div>
              
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : configs.length === 0 ? (
                <div className="text-center py-12">
                  <Settings className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 mb-4">No trivia configs yet</p>
                  <Link href="/host/create" className="btn-primary inline-block">
                    Create Your First Config
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {configs.map((config) => (
                    <div
                      key={config.id}
                      onClick={() => setSelectedConfigId(config.id)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedConfigId === config.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800">{config.name}</h3>
                          {config.description && (
                            <p className="text-sm text-gray-600 mt-1">{config.description}</p>
                          )}
                          <div className="flex gap-3 mt-2 text-xs">
                            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">
                              {config.totalRounds} rounds
                            </span>
                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              {config.totalQuestions} questions
                            </span>
                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">
                              Used {config.gameCount} times
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (config.gameCount === 0) {
                              setDeleteConfirmId(config.id);
                            }
                          }}
                          className={`p-2 rounded-lg transition-colors ${
                            config.gameCount > 0 
                              ? 'text-gray-300 cursor-not-allowed' 
                              : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                          }`}
                          disabled={config.gameCount > 0}
                          title={config.gameCount > 0 ? 'Cannot delete config used in games' : 'Delete config'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Right Column - Game Setup */}
          <div className="space-y-6">
            <form onSubmit={handleStart} className="card space-y-6">
              <h2 className="text-xl font-bold text-gray-800">Game Setup</h2>
              
              {selectedConfig && (
                <div className="p-4 bg-primary-50 rounded-xl">
                  <p className="text-sm text-primary-600 font-medium">Selected Config</p>
                  <p className="font-semibold text-primary-800">{selectedConfig.name}</p>
                </div>
              )}
              
              <div>
                <label htmlFor="hostPin" className="label">
                  Host PIN (4-8 digits) *
                </label>
                <input
                  type="password"
                  id="hostPin"
                  value={hostPin}
                  onChange={(e) => setHostPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="••••"
                  className="input-field text-center text-2xl tracking-widest"
                  pattern="\d{4,8}"
                  inputMode="numeric"
                />
                <p className="text-xs text-gray-500 mt-1">
                  You'll need this to control the game
                </p>
              </div>
              
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomCode}
                    onChange={(e) => setUseCustomCode(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Use custom game code</span>
                </label>
                
                {useCustomCode && (
                  <input
                    type="text"
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                    placeholder="ABCDEF"
                    maxLength={6}
                    className="input-field mt-2 text-center text-xl font-mono tracking-widest uppercase"
                  />
                )}
              </div>
              
              {error && (
                <p className="text-red-500 text-sm">{error}</p>
              )}
              
              <button
                type="submit"
                disabled={!selectedConfigId || !hostPin || isStarting}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isStarting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Start Game
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        title="Delete Config"
        message="Are you sure you want to delete this trivia config? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
