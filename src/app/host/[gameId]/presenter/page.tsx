'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  Play, 
  Pause, 
  SkipForward, 
  Trophy, 
  ChevronRight, 
  LogOut,
  Keyboard,
  X
} from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { useTimer } from '@/hooks/useTimer';
import { getGameSession, verifyHostPin } from '@/actions/game';
import { TimerDisplay } from '@/components/game/TimerDisplay';
import { ProgressBar } from '@/components/game/ProgressBar';
import { QuestionDisplay } from '@/components/game/QuestionDisplay';
import { Leaderboard } from '@/components/game/Leaderboard';
import { ConfirmModal } from '@/components/ui/Modal';
import { GameState, Question, LeaderboardEntry, TimerState } from '@/types';

export default function HostPresenterPage() {
  const router = useRouter();
  const params = useParams();
  const gameSessionId = params.gameId as string;
  
  const [hostPin, setHostPin] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [scoredRoundNumber, setScoredRoundNumber] = useState<number | null>(null);
  
  // Timer state
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const { remainingTime, isRunning } = useTimer(timerState);
  
  // Get stored PIN
  useEffect(() => {
    const storedPin = sessionStorage.getItem(`hostPin_${gameSessionId}`);
    if (storedPin) {
      setHostPin(storedPin);
    }
  }, [gameSessionId]);
  
  // Socket handlers
  const socketHandlers = {
    onHostJoinSuccess: (data: { gameState: GameState }) => {
      setGameState(data.gameState);
      setIsConnected(true);
      setError('');
    },
    onHostJoinError: (data: { message: string }) => {
      setError(data.message);
    },
    onGameStarted: (data: { gameState: GameState }) => {
      setGameState(data.gameState);
      setShowLeaderboard(false);
    },
    onQuestionRevealed: (data: { 
      roundNumber: number; 
      questionNumber: number;
      question: Question;
      timer: TimerState;
    }) => {
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          currentRoundIndex: data.roundNumber - 1,
          currentQuestionIndex: data.questionNumber - 1,
          currentQuestion: data.question,
          phase: 'reading_delay',
          // Reset hasAnswered for all teams when new question starts
          teams: prev.teams.map((t) => ({ ...t, hasAnswered: false })) as typeof prev.teams,
        };
      });
      setTimerState(data.timer);
      setShowLeaderboard(false);
    },
    onAnsweringStarted: (data: { timer: TimerState }) => {
      setGameState((prev) => {
        if (!prev) return prev;
        return { ...prev, phase: 'answering' };
      });
      setTimerState(data.timer);
    },
    onTimerSync: (data: TimerState) => {
      setTimerState(data);
    },
    onAnswerReceived: (data: { teamId: string }) => {
      // Update UI to show team answered
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          teams: prev.teams.map((t) =>
            t.id === data.teamId
              ? { ...t, hasAnswered: true }
              : t
          ) as typeof prev.teams,
        };
      });
    },
    onRoundScored: (data: { 
      roundNumber: number;
      roundIndex: number; 
      leaderboard: LeaderboardEntry[];
      gameState: GameState;
    }) => {
      setGameState(data.gameState);
      setLeaderboard(data.leaderboard);
      setScoredRoundNumber(data.roundNumber);
      setShowLeaderboard(true);
    },
    onGamePaused: () => {
      setGameState((prev) => {
        if (!prev) return prev;
        return { ...prev, phase: 'paused' };
      });
    },
    onGameResumed: (data: { timer: TimerState }) => {
      setTimerState(data.timer);
      setGameState((prev) => {
        if (!prev) return prev;
        return { ...prev, phase: 'answering' };
      });
    },
    onGameFinished: (data: { 
      finalLeaderboard: LeaderboardEntry[];
      gameState?: GameState;
    }) => {
      if (data.gameState) {
        setGameState(data.gameState);
      } else {
        setGameState(prev => prev ? { ...prev, phase: 'finished' } : prev);
      }
      setLeaderboard(data.finalLeaderboard);
      setShowLeaderboard(true);
    },
    onError: (data: { message: string }) => {
      setError(data.message);
      setTimeout(() => setError(''), 3000);
    },
  };
  
  const { 
    hostJoin, 
    startGame, 
    nextQuestion, 
    pauseGame, 
    resumeGame, 
    scoreRound,
    isConnected: socketConnected 
  } = useSocket(socketHandlers);
  
  // Load game session and connect
  useEffect(() => {
    const load = async () => {
      const session = await getGameSession(gameSessionId);
      if (!session) {
        setError('Game session not found');
        setIsLoading(false);
        return;
      }
      
      setIsLoading(false);
    };
    
    load();
  }, [gameSessionId]);
  
  // Connect as host when socket is ready
  useEffect(() => {
    if (socketConnected && hostPin && !isConnected) {
      hostJoin(gameSessionId, hostPin);
    }
  }, [socketConnected, hostPin, isConnected, gameSessionId, hostJoin]);
  
  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isConnected || !gameState) return;
    
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        if (gameState.phase === 'lobby') {
          startGame(gameSessionId);
        } else if (gameState.phase === 'paused') {
          resumeGame(gameSessionId);
        } else if (showLeaderboard && gameState.phase !== 'finished') {
          nextQuestion(gameSessionId);
        }
        break;
      case 'KeyP':
        if (gameState.phase === 'answering') {
          pauseGame(gameSessionId);
        } else if (gameState.phase === 'paused') {
          resumeGame(gameSessionId);
        }
        break;
      case 'KeyN':
        if (gameState.phase !== 'finished' && !showLeaderboard && remainingTime === 0) {
          nextQuestion(gameSessionId);
        }
        break;
      case 'KeyS':
        if (gameState.phase === 'round_scored' || remainingTime === 0) {
          scoreRound(gameSessionId, (gameState?.currentRoundIndex ?? 0) + 1);
        }
        break;
      case 'KeyL':
        setShowLeaderboard((prev) => !prev);
        break;
      case 'Escape':
        setShowLeaderboard(false);
        setShowKeyboardHelp(false);
        break;
      case 'Slash':
        if (e.shiftKey) {
          setShowKeyboardHelp((prev) => !prev);
        }
        break;
    }
  }, [isConnected, gameState, showLeaderboard, remainingTime, gameSessionId, startGame, nextQuestion, pauseGame, resumeGame, scoreRound]);
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!socketConnected || !hostPin) return;
    
    // Verify PIN before connecting
    const valid = await verifyHostPin(gameSessionId, hostPin);
    if (!valid) {
      setError('Invalid PIN');
      return;
    }
    
    sessionStorage.setItem(`hostPin_${gameSessionId}`, hostPin);
    hostJoin(gameSessionId, hostPin);
  };
  
  const handleEndGame = () => {
    setShowConfirmEnd(false);
    router.push(`/scoreboard/${gameSessionId}`);
  };
  
  const currentQuestion = gameState?.currentQuestion;
  const isPaused = gameState?.phase === 'paused';
  const isFinished = gameState?.phase === 'finished';
  const isReadingDelay = gameState?.phase === 'reading_delay';
  const totalQuestions = gameState ? 
    Object.values(gameState.questions).reduce((sum, qs) => sum + qs.length, 0) : 0;
  // currentRoundIndex is 0-indexed, but questions keys are 1-indexed round numbers
  // So we need to compare against currentRoundIndex + 1 (the current round number)
  const currentQuestionNumber = gameState ?
    Object.entries(gameState.questions)
      .filter(([r]) => parseInt(r) < ((gameState.currentRoundIndex ?? 0) + 1))
      .reduce((sum, [, qs]) => sum + qs.length, 0) + ((gameState.currentQuestionIndex ?? 0) + 1) : 0;
  
  const answeredCount = gameState?.teams.filter((t) => (t as typeof t & { hasAnswered?: boolean }).hasAnswered).length ?? 0;
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  // PIN entry if not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="card max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Host Authentication</h1>
          
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <label htmlFor="pin" className="label">Enter Host PIN</label>
              <input
                type="password"
                id="pin"
                value={hostPin}
                onChange={(e) => setHostPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="••••"
                className="input-field text-center text-2xl tracking-widest"
                inputMode="numeric"
              />
            </div>
            
            {error && <p className="text-red-500 text-sm">{error}</p>}
            
            <button type="submit" className="btn-primary w-full" disabled={!socketConnected}>
              {socketConnected ? 'Connect as Host' : 'Connecting...'}
            </button>
          </form>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-gray-800/90 backdrop-blur-sm border-b border-gray-700 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="font-bold text-xl text-primary-400">
              Code: {gameState?.gameCode}
            </div>
            
            {gameState && totalQuestions > 0 && (
              <ProgressBar
                current={currentQuestionNumber}
                total={totalQuestions}
                label={`Question ${currentQuestionNumber}/${totalQuestions}`}
              />
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              {gameState?.teams.length} teams • {answeredCount} answered
            </span>
            
            <button
              onClick={() => setShowKeyboardHelp(true)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => setShowConfirmEnd(true)}
              className="p-2 hover:bg-red-900/50 rounded-lg transition-colors text-red-400"
              title="End game"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="pt-20 pb-24 min-h-screen flex flex-col items-center justify-center px-8">
        {error && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-lg z-50 animate-fade-in">
            {error}
          </div>
        )}
        
        {/* Leaderboard View */}
        {showLeaderboard && leaderboard.length > 0 ? (
          <div className="w-full max-w-4xl animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold text-yellow-400 flex items-center justify-center gap-3">
                <Trophy className="w-10 h-10" />
                {isFinished ? 'Final Results' : `Round ${scoredRoundNumber ?? ((gameState?.currentRoundIndex ?? 0) + 1)} Results`}
              </h2>
            </div>
            
            <Leaderboard entries={leaderboard} showChart />
            
            {!isFinished && scoredRoundNumber !== null && scoredRoundNumber < (gameState?.totalRounds ?? 0) && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => nextQuestion(gameSessionId)}
                  className="btn-primary text-xl px-8 py-4"
                >
                  Next Question <ChevronRight className="w-6 h-6 inline ml-2" />
                </button>
                <p className="text-gray-500 mt-2 text-sm">Press Space to continue</p>
              </div>
            )}
            
            {!isFinished && scoredRoundNumber !== null && scoredRoundNumber >= (gameState?.totalRounds ?? 0) && (
              <div className="mt-8 text-center">
                <p className="text-2xl text-gray-300 mb-6">🎉 All rounds complete! 🎉</p>
                <button
                  onClick={() => router.push(`/scoreboard/${gameSessionId}`)}
                  className="btn-primary text-xl px-8 py-4"
                >
                  <Trophy className="w-6 h-6 inline mr-2" />
                  Finalize Scores
                </button>
              </div>
            )}
            
            {isFinished && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => router.push(`/scoreboard/${gameSessionId}`)}
                  className="btn-primary text-xl px-8 py-4"
                >
                  View Full Results <ChevronRight className="w-6 h-6 inline ml-2" />
                </button>
              </div>
            )}
          </div>
        ) : currentQuestion ? (
          /* Question View */
          <div className="w-full max-w-5xl animate-fade-in">
            {/* Reading Delay Overlay */}
            {isReadingDelay && (
              <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-30">
                <div className="text-center animate-pulse">
                  <h2 className="text-5xl font-bold text-primary-400 mb-4">Get Ready!</h2>
                  <p className="text-2xl text-gray-400">Question coming up...</p>
                  <p className="text-6xl font-bold mt-8">{remainingTime}</p>
                </div>
              </div>
            )}
            
            {/* Pause Overlay */}
            {isPaused && (
              <div className="fixed inset-0 bg-gray-900/95 flex items-center justify-center z-30">
                <div className="text-center">
                  <Pause className="w-24 h-24 text-yellow-400 mx-auto mb-4" />
                  <h2 className="text-4xl font-bold text-yellow-400 mb-4">Game Paused</h2>
                  <button
                    onClick={() => resumeGame(gameSessionId)}
                    className="btn-primary text-xl px-8 py-4 mt-4"
                  >
                    <Play className="w-6 h-6 inline mr-2" />
                    Resume Game
                  </button>
                  <p className="text-gray-500 mt-2 text-sm">Press P or Space to resume</p>
                </div>
              </div>
            )}
            
            <QuestionDisplay
              question={currentQuestion}
              showAnswer={remainingTime === 0}
              roundNumber={(gameState?.currentRoundIndex ?? 0) + 1}
              questionNumber={(gameState?.currentQuestionIndex ?? 0) + 1}
            />
          </div>
        ) : (
          /* Waiting State */
          <div className="text-center animate-fade-in">
            <h2 className="text-4xl font-bold text-gray-300">Waiting to start...</h2>
            <button
              onClick={() => startGame(gameSessionId)}
              className="btn-primary text-xl px-8 py-4 mt-8"
            >
              <Play className="w-6 h-6 inline mr-2" />
              Start First Question
            </button>
          </div>
        )}
      </div>
      
      {/* Bottom Controls */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-4">
            {gameState?.phase === 'answering' && (
              <button
                onClick={() => pauseGame(gameSessionId)}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <Pause className="w-5 h-5" />
                Pause (P)
              </button>
            )}
            
            {remainingTime === 0 && !showLeaderboard && !isFinished && (
              <>
                <button
                  onClick={() => scoreRound(gameSessionId, (gameState?.currentRoundIndex ?? 0) + 1)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Trophy className="w-5 h-5" />
                  Score Round (S)
                </button>
                
                <button
                  onClick={() => nextQuestion(gameSessionId)}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors flex items-center gap-2"
                >
                  <SkipForward className="w-5 h-5" />
                  Next Question (N)
                </button>
              </>
            )}
            
            <button
              onClick={() => setShowLeaderboard((prev) => !prev)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2"
            >
              <Trophy className="w-5 h-5" />
              Leaderboard (L)
            </button>
          </div>
          
          {/* Timer */}
          <div className="flex items-center gap-4">
            {timerState && !showLeaderboard && !isPaused && !isReadingDelay && (
              <TimerDisplay
                timerState={timerState}
                size="md"
              />
            )}
          </div>
        </div>
      </div>
      
      {/* Keyboard Help Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowKeyboardHelp(false)}>
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Keyboard className="w-5 h-5" />
                Keyboard Shortcuts
              </h3>
              <button onClick={() => setShowKeyboardHelp(false)} className="p-1 hover:bg-gray-700 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-700">
                <span className="text-gray-400">Start / Resume / Next</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-white">Space</kbd>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-700">
                <span className="text-gray-400">Pause / Resume</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-white">P</kbd>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-700">
                <span className="text-gray-400">Next Question</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-white">N</kbd>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-700">
                <span className="text-gray-400">Score Round</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-white">S</kbd>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-700">
                <span className="text-gray-400">Toggle Leaderboard</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-white">L</kbd>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-400">Close / Cancel</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-white">Esc</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Confirm End Modal */}
      <ConfirmModal
        isOpen={showConfirmEnd}
        onClose={() => setShowConfirmEnd(false)}
        onConfirm={handleEndGame}
        title="End Game?"
        message="Are you sure you want to end this game and view the final results?"
        confirmText="End Game"
        variant="danger"
      />
    </div>
  );
}
