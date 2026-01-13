'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { 
  CheckCircle, 
  Clock, 
  History, 
  ChevronDown, 
  ChevronUp,
  Send,
  RefreshCw
} from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { useTimer } from '@/hooks/useTimer';
import { getTeamByToken, getTeamAnswerHistory, hasTeamAnswered } from '@/actions/team';
import { TimerDisplay } from '@/components/game/TimerDisplay';
import { AnswerButtons } from '@/components/game/AnswerButtons';
import { GameState, Question, TimerState, AnswerOption } from '@/types';

interface AnswerHistoryItem {
  round: number;
  question: number;
  answer: AnswerOption;
  isCorrect: boolean;
  points: number;
}

export default function TeamPlayPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const gameCode = params.gameCode as string;
  
  const [phase, setPhase] = useState<'joining' | 'naming' | 'ready' | 'playing'>('joining');
  const [teamName, setTeamName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [teamId, setTeamId] = useState('');
  const [reconnectToken, setReconnectToken] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerOption | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [answerResult, setAnswerResult] = useState<{ correct: boolean; points: number } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [answerHistory, setAnswerHistory] = useState<AnswerHistoryItem[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  
  // Timer state
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const { remainingTime, isRunning } = useTimer(timerState);
  
  // Try to reconnect on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(`trivia_token_${gameCode}`);
    if (storedToken) {
      setReconnectToken(storedToken);
    }
  }, [gameCode]);
  
  // Socket handlers
  const socketHandlers = {
    onJoinSuccess: (data: { 
      teamId: string; 
      teamName: string; 
      reconnectToken: string;
      gameState: GameState;
    }) => {
      setTeamId(data.teamId);
      setDisplayName(data.teamName);
      setTeamName(data.teamName); // Pre-fill the team name for editing
      setReconnectToken(data.reconnectToken);
      setGameState(data.gameState);
      localStorage.setItem(`trivia_token_${gameCode}`, data.reconnectToken);
      
      // Check for LOBBY status (server sends uppercase status, not lowercase phase)
      if (data.gameState.status === 'LOBBY') {
        setPhase('naming');
      } else {
        setPhase('playing');
        setIsReady(true);
      }
      setError('');
    },
    onJoinError: (data: { message: string }) => {
      setError(data.message);
    },
    onReconnectSuccess: (data: {
      teamId: string;
      teamName: string;
      isReady?: boolean;
      gameState: GameState;
    }) => {
      setTeamId(data.teamId);
      setDisplayName(data.teamName);
      setTeamName(data.teamName); // Pre-fill the team name for editing
      setGameState(data.gameState);
      
      // Check for LOBBY status (server sends uppercase status, not lowercase phase)
      if (data.gameState.status === 'LOBBY') {
        // Only go to 'ready' phase if team was already ready, otherwise show naming
        if (data.isReady) {
          setIsReady(true);
          setPhase('ready');
        } else {
          setPhase('naming');
        }
      } else {
        setIsReady(true);
        setPhase('playing');
        // Check if we already answered current question
        checkCurrentAnswer(data.teamId, data.gameState);
      }
      setError('');
    },
    onReconnectError: (data: { message: string }) => {
      // Clear invalid token and let them rejoin
      localStorage.removeItem(`trivia_token_${gameCode}`);
      setReconnectToken('');
      setError(data.message);
    },
    onTeamReady: (data: { teamId: string }) => {
      // Check if this is our team
      if (data.teamId === teamId) {
        setIsReady(true);
        setPhase('ready');
      }
    },
    onGameStarted: (data: { gameState: GameState }) => {
      setGameState(data.gameState);
      setPhase('playing');
    },
    onQuestionRevealed: (data: { 
      roundNumber: number; 
      questionNumber: number;
      question: Question;
      timer: TimerState;
    }) => {
      // Only show question text, not options during reading delay
      setCurrentQuestion(data.question);
      setTimerState(data.timer);
      setSelectedAnswer(null);
      setHasSubmitted(false);
      setAnswerResult(null);
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          currentRoundIndex: data.roundNumber - 1,
          currentQuestionIndex: data.questionNumber - 1,
          phase: 'reading_delay',
        };
      });
    },
    onAnsweringStarted: (data: { timer: TimerState }) => {
      setTimerState(data.timer);
      setGameState((prev) => {
        if (!prev) return prev;
        return { ...prev, phase: 'answering' };
      });
    },
    onTimerSync: (data: TimerState) => {
      setTimerState(data);
    },
    onAnswerConfirmed: (data: { teamId: string; roundNumber: number; questionNumber: number; selectedAnswer: 'A' | 'B' | 'C' | 'D' }) => {
      // Only process if this is our team's answer confirmation
      if (data.teamId === teamId) {
        setSelectedAnswer(data.selectedAnswer);
        setHasSubmitted(true);
      }
    },
    onAnswerResult: (data: { correct: boolean; points: number; totalScore: number }) => {
      setAnswerResult({ correct: data.correct, points: data.points });
      setTotalScore(data.totalScore);
      
      // Add to history
      if (gameState && currentQuestion) {
        setAnswerHistory((prev) => [...prev, {
          round: (gameState.currentRoundIndex ?? 0) + 1,
          question: (gameState.currentQuestionIndex ?? 0) + 1,
          answer: selectedAnswer!,
          isCorrect: data.correct,
          points: data.points,
        }]);
      }
    },
    onRoundScored: (data: { 
      roundIndex: number; 
      leaderboard: Array<{ id: string; rank: number; totalScore: number }>;
    }) => {
      // Find our rank
      const myEntry = data.leaderboard.find((e) => e.id === teamId);
      if (myEntry) {
        setTotalScore(myEntry.totalScore);
      }
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
    onGameFinished: () => {
      setGameState((prev) => {
        if (!prev) return prev;
        return { ...prev, phase: 'finished' };
      });
    },
    onError: (data: { message: string }) => {
      setError(data.message);
      setTimeout(() => setError(''), 3000);
    },
  };
  
  const { 
    joinGame, 
    reconnect,
    setTeamReady, 
    renameTeam,
    submitAnswer,
    isConnected 
  } = useSocket(socketHandlers);
  
  // Check if we already answered current question
  const checkCurrentAnswer = async (tid: string, state: GameState) => {
    const answered = await hasTeamAnswered(
      tid,
      state.currentRoundIndex ?? 0,
      state.currentQuestionIndex ?? 0
    );
    if (answered) {
      setHasSubmitted(true);
    }
  };
  
  // Auto-join or reconnect
  useEffect(() => {
    if (isConnected && phase === 'joining') {
      if (reconnectToken) {
        reconnect(reconnectToken);
      } else {
        joinGame(gameCode);
      }
    }
  }, [isConnected, phase, reconnectToken, gameCode, joinGame, reconnect]);
  
  const handleSetReady = () => {
    if (!teamName.trim()) {
      setError('Please enter a team name');
      return;
    }
    
    if (teamName !== displayName) {
      renameTeam(teamId, teamName.trim());
      setDisplayName(teamName.trim());
    }
    
    setTeamReady(teamId);
  };
  
  const handleSelectAnswer = (answer: AnswerOption) => {
    if (hasSubmitted || gameState?.phase !== 'answering' || remainingTime === 0) return;
    setSelectedAnswer(answer);
  };
  
  const handleSubmitAnswer = () => {
    if (!selectedAnswer || hasSubmitted || gameState?.phase !== 'answering') return;
    
    const responseTimeMs = timerState ? (timerState.totalMs || 30000) - timerState.remainingMs : 0;
    
    submitAnswer({
      teamId,
      roundNumber: (gameState?.currentRoundIndex ?? 0) + 1,
      questionNumber: (gameState?.currentQuestionIndex ?? 0) + 1,
      selectedAnswer,
      responseTimeMs,
    });
  };
  
  const isPaused = gameState?.phase === 'paused';
  const isFinished = gameState?.phase === 'finished';
  const isReadingDelay = gameState?.phase === 'reading_delay';
  const isAnswering = gameState?.phase === 'answering';
  const timeUp = remainingTime === 0 && timerState && !isReadingDelay;
  
  // Joining/Loading state
  if (phase === 'joining') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
        <div className="card max-w-sm w-full text-center">
          {error ? (
            <>
              <div className="text-red-500 mb-4">{error}</div>
              <button
                onClick={() => {
                  setError('');
                  localStorage.removeItem(`trivia_token_${gameCode}`);
                  setReconnectToken('');
                  if (isConnected) {
                    joinGame(gameCode);
                  }
                }}
                className="btn-primary"
              >
                <RefreshCw className="w-4 h-4 mr-2 inline" />
                Try Again
              </button>
            </>
          ) : (
            <>
              <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Joining game...</p>
            </>
          )}
        </div>
      </div>
    );
  }
  
  // Team naming phase
  if (phase === 'naming') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
        <div className="card max-w-sm w-full">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Welcome to Trivia!</h1>
          <p className="text-gray-500 mb-6">Game code: <span className="font-mono font-bold">{gameCode}</span></p>
          
          <div className="mb-6">
            <label htmlFor="teamName" className="label">Your Team Name</label>
            <input
              type="text"
              id="teamName"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Enter your team name..."
              className="input-field"
              maxLength={30}
              autoFocus
            />
          </div>
          
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          
          <button onClick={handleSetReady} className="btn-primary w-full">
            <CheckCircle className="w-5 h-5 mr-2 inline" />
            I'm Ready!
          </button>
        </div>
      </div>
    );
  }
  
  // Waiting for game to start
  if (phase === 'ready') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 flex items-center justify-center p-4">
        <div className="card max-w-sm w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">You're Ready!</h1>
          <p className="text-gray-500 mb-6">Waiting for the host to start the game...</p>
          
          <div className="bg-gray-100 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-500">Your team</p>
            <p className="text-xl font-bold text-gray-800">{displayName}</p>
          </div>
          
          <div className="animate-pulse flex items-center justify-center gap-2 text-gray-400">
            <Clock className="w-5 h-5" />
            <span>Game starting soon...</span>
          </div>
        </div>
      </div>
    );
  }
  
  // Main game view
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Team</p>
            <p className="font-bold">{displayName}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Score</p>
            <p className="font-bold text-primary-400">{totalScore} pts</p>
          </div>
        </div>
      </div>
      
      {/* Error banner */}
      {error && (
        <div className="bg-red-500/90 text-white px-4 py-2 text-center text-sm">
          {error}
        </div>
      )}
      
      {/* Game Finished */}
      {isFinished ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-yellow-400 mb-4">🎉 Game Over! 🎉</h2>
            <p className="text-gray-400 mb-6">Thanks for playing!</p>
            <div className="bg-gray-800 rounded-xl p-6 mb-6">
              <p className="text-sm text-gray-400">Your Final Score</p>
              <p className="text-5xl font-bold text-primary-400">{totalScore}</p>
            </div>
            <p className="text-gray-500 text-sm">Check the main screen for final rankings!</p>
          </div>
        </div>
      ) : isPaused ? (
        /* Paused State */
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-10 h-10 text-yellow-400" />
            </div>
            <h2 className="text-2xl font-bold text-yellow-400">Game Paused</h2>
            <p className="text-gray-400 mt-2">The host has paused the game</p>
          </div>
        </div>
      ) : isReadingDelay ? (
        /* Reading Delay */
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center animate-pulse">
            <h2 className="text-3xl font-bold text-primary-400 mb-4">Get Ready!</h2>
            <p className="text-xl text-gray-400">Next question in...</p>
            <p className="text-6xl font-bold mt-4">{remainingTime}</p>
          </div>
        </div>
      ) : currentQuestion ? (
        /* Question & Answer View */
        <div className="flex-1 flex flex-col p-4">
          {/* Question Header */}
          <div className="text-center mb-4">
            <span className="text-sm text-gray-400">
              Round {(gameState?.currentRoundIndex ?? 0) + 1} • Question {(gameState?.currentQuestionIndex ?? 0) + 1}
            </span>
          </div>
          
          {/* Timer */}
          {isAnswering && (
            <div className="flex justify-center mb-4">
              <TimerDisplay
                timerState={timerState}
                size="md"
              />
            </div>
          )}
          
          {/* Already Submitted */}
          {hasSubmitted ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
              <h3 className="text-xl font-bold mb-2">Answer Submitted!</h3>
              <p className="text-gray-400">
                You answered: <span className="font-bold text-white">{selectedAnswer}</span>
              </p>
              
              {answerResult && (
                <div className={`mt-6 p-4 rounded-xl ${
                  answerResult.correct ? 'bg-green-500/20' : 'bg-red-500/20'
                }`}>
                  <p className={`text-lg font-bold ${
                    answerResult.correct ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {answerResult.correct ? '✓ Correct!' : '✗ Incorrect'}
                  </p>
                  <p className="text-sm text-gray-400">
                    {answerResult.points > 0 ? `+${answerResult.points} points` : 'No points'}
                  </p>
                </div>
              )}
            </div>
          ) : timeUp ? (
            /* Time's Up */
            <div className="flex-1 flex flex-col items-center justify-center">
              <Clock className="w-16 h-16 text-red-500 mb-4" />
              <h3 className="text-xl font-bold mb-2">Time's Up!</h3>
              <p className="text-gray-400">You didn't submit an answer</p>
            </div>
          ) : (
            /* Answer Selection */
            <div className="flex-1 flex flex-col">
              <div className="flex-1 flex flex-col justify-center">
                <AnswerButtons
                  options={{
                    A: currentQuestion.answerA,
                    B: currentQuestion.answerB,
                    C: currentQuestion.answerC,
                    D: currentQuestion.answerD,
                  }}
                  selectedAnswer={selectedAnswer}
                  onSelect={handleSelectAnswer}
                  disabled={!isAnswering}
                  showText={false}
                />
              </div>
              
              {/* Submit Button */}
              <div className="mt-4">
                <button
                  onClick={handleSubmitAnswer}
                  disabled={!selectedAnswer || !isAnswering}
                  className="btn-primary w-full text-xl py-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5 mr-2 inline" />
                  Submit Answer
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Waiting for first question */
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Waiting for next question...</p>
          </div>
        </div>
      )}
      
      {/* Answer History Accordion */}
      <div className="border-t border-gray-700">
        <button
          onClick={() => setShowHistory((prev) => !prev)}
          className="w-full px-4 py-3 flex items-center justify-between bg-gray-800 hover:bg-gray-750 transition-colors"
        >
          <span className="flex items-center gap-2 text-gray-400">
            <History className="w-5 h-5" />
            Your Answers ({answerHistory.length})
          </span>
          {showHistory ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronUp className="w-5 h-5 text-gray-400" />}
        </button>
        
        {showHistory && (
          <div className="bg-gray-800 px-4 py-2 max-h-48 overflow-y-auto">
            {answerHistory.length === 0 ? (
              <p className="text-gray-500 text-sm py-2">No answers yet</p>
            ) : (
              <div className="space-y-2">
                {answerHistory.map((item, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                      item.isCorrect ? 'bg-green-500/10' : 'bg-red-500/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        item.isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                      }`}>
                        {item.answer}
                      </span>
                      <span className="text-sm text-gray-400">
                        R{item.round} Q{item.question}
                      </span>
                    </div>
                    <span className={`text-sm font-bold ${
                      item.isCorrect ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {item.points > 0 ? `+${item.points}` : '0'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
