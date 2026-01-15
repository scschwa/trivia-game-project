// Game Status Types
export const GameStatus = {
  LOBBY: 'LOBBY',
  READING_DELAY: 'READING_DELAY',
  ANSWERING: 'ANSWERING',
  PAUSED: 'PAUSED',
  ROUND_SCORED: 'ROUND_SCORED',
  FINISHED: 'FINISHED',
} as const;

export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

// Answer option type
export type AnswerOption = 'A' | 'B' | 'C' | 'D';

// Question from CSV (internal storage format)
export interface Question {
  round: number;
  roundNumber: number; // alias for round
  questionNumber: number;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  answerA: string; // alias for optionA
  answerB: string; // alias for optionB
  answerC: string; // alias for optionC
  answerD: string; // alias for optionD
  correctAnswer: AnswerOption;
  points: number;
  timeSeconds: number;
}

// Team with computed fields
export interface TeamWithRank {
  id: string;
  name: string;
  totalScore: number;
  rank: number;
  roundScores: Record<number, number>;
  isConnected: boolean;
}

// Answer history for team view
export interface AnswerHistory {
  roundNumber: number;
  questionNumber: number;
  selectedAnswer: string;
  answerText: string;
  isCorrect: boolean | null; // null if round not yet scored
  pointsAwarded: number;
}

// Leaderboard entry
export interface LeaderboardEntry {
  id: string;
  name: string;
  totalScore: number;
  rank: number;
  roundScores: Record<number, number>;
  isConnected: boolean;
  // Legacy aliases
  teamId?: string;
  teamName?: string;
}

// Timer state from server
export interface TimerState {
  phase: 'waiting' | 'reading' | 'answering' | 'paused' | 'ended';
  remainingMs: number;
  totalMs: number;
  totalDuration?: number; // alias for backwards compatibility
  endsAt: number | null;
  serverTime: number; // Server's Date.now() when this was calculated
  startedAt?: number;
  pausedAt?: number;
}

// Game phase type
export type GamePhase = 
  | 'lobby' 
  | 'reading_delay' 
  | 'answering' 
  | 'paused' 
  | 'round_scored' 
  | 'finished';

// Game session state for clients
export interface GameState {
  sessionId: string;
  gameCode: string;
  status?: GameStatus;
  phase: GamePhase;
  currentRoundIndex?: number;
  currentQuestionIndex?: number;
  currentRound?: number;
  currentQuestion?: Question | null;
  totalRounds: number;
  totalQuestions: number;
  currentQuestionData?: Question | null;
  timer?: TimerState;
  teams: TeamWithRank[];
  questions: Record<number, Question[]>; // Questions grouped by round
  scoredRounds: number[]; // Array of round numbers that have been scored
}

// CSV validation error
export interface CSVValidationError {
  row: number;
  column: string;
  value: string;
  message: string;
}

// CSV validation result
export interface CSVValidationResult {
  valid: boolean;
  errors: CSVValidationError[];
  questions: Question[];
  totalRounds: number;
  totalQuestions: number;
}

// Answer submission
export interface AnswerSubmission {
  teamId: string;
  gameSessionId: string;
  roundNumber: number;
  questionNumber: number;
  selectedAnswer: 'A' | 'B' | 'C' | 'D';
  responseTimeMs: number;
}

// Scoring result for a round
export interface RoundScoringResult {
  roundNumber: number;
  roundIndex: number; // 0-indexed for client
  correctAnswers: Record<number, { correct: 'A' | 'B' | 'C' | 'D'; points: number }>;
  teamScores: {
    teamId: string;
    teamName: string;
    roundScore: number;
    totalScore: number;
    answersCorrect: number;
    answersTotal: number;
  }[];
  leaderboard: LeaderboardEntry[];
  gameState: GameState; // Updated game state after scoring
}

// Completed game for scoreboard
export interface CompletedGame {
  id: string;
  gameCode: string;
  configName: string;
  completedAt: Date;
  totalRounds: number;
  totalQuestions: number;
  teamCount: number;
  winner: {
    name: string;
    score: number;
  } | null;
}

// Detailed game result
export interface GameResult {
  id: string;
  gameCode: string;
  configName: string;
  completedAt: Date;
  totalRounds: number;
  totalQuestions: number;
  leaderboard: LeaderboardEntry[];
  roundBreakdown: {
    roundNumber: number;
    teamScores: { teamName: string; score: number }[];
  }[];
}
