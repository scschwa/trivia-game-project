// Shared types for socket server
// These mirror the types in the main app

export const GameStatus = {
  LOBBY: 'LOBBY',
  READING_DELAY: 'READING_DELAY',
  ANSWERING: 'ANSWERING',
  PAUSED: 'PAUSED',
  ROUND_SCORED: 'ROUND_SCORED',
  FINISHED: 'FINISHED',
} as const;

export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

export interface Question {
  roundNumber: number;
  questionNumber: number;
  question: string;
  answerA: string;
  answerB: string;
  answerC: string;
  answerD: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  points: number;
}

export interface TimerState {
  phase: 'waiting' | 'reading' | 'answering' | 'paused' | 'ended';
  remainingMs: number;
  totalMs: number;
  endsAt: number | null;
}

export interface TeamWithRank {
  id: string;
  name: string;
  totalScore: number;
  rank: number;
  roundScores: Record<number, number>;
  isConnected: boolean;
}

export interface LeaderboardEntry {
  teamId: string;
  teamName: string;
  totalScore: number;
  rank: number;
  roundScores: Record<number, number>;
}

export interface GameState {
  sessionId: string;
  gameCode: string;
  status: GameStatus;
  currentRound: number;
  currentQuestion: number;
  totalRounds: number;
  totalQuestions: number;
  currentQuestionData: Question | null;
  timer: TimerState;
  teams: TeamWithRank[];
  scoredRounds: number[];
}

export interface RoundScoringResult {
  roundNumber: number;
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
}

// Socket event interfaces
export interface ClientToServerEvents {
  JOIN_GAME: (data: { gameCode: string; reconnectToken?: string }) => void;
  TEAM_READY: (data: { teamId: string }) => void;
  TEAM_RENAME: (data: { teamId: string; newName: string }) => void;
  SUBMIT_ANSWER: (data: {
    teamId: string;
    roundNumber: number;
    questionNumber: number;
    selectedAnswer: 'A' | 'B' | 'C' | 'D';
    responseTimeMs: number;
  }) => void;
  HOST_JOIN: (data: { gameSessionId: string; hostPin: string }) => void;
  HOST_START_GAME: (data: { gameSessionId: string }) => void;
  HOST_NEXT_QUESTION: (data: { gameSessionId: string }) => void;
  HOST_PAUSE: (data: { gameSessionId: string }) => void;
  HOST_RESUME: (data: { gameSessionId: string }) => void;
  HOST_SCORE_ROUND: (data: { gameSessionId: string; roundNumber: number }) => void;
  RECONNECT: (data: { reconnectToken: string }) => void;
  REQUEST_STATE: (data: { gameCode: string }) => void;
}

export interface ServerToClientEvents {
  CONNECTED: (data: { socketId: string }) => void;
  JOIN_SUCCESS: (data: {
    teamId: string;
    teamName: string;
    reconnectToken: string;
    gameState: GameState;
  }) => void;
  JOIN_ERROR: (data: { message: string }) => void;
  HOST_JOIN_SUCCESS: (data: { gameState: GameState }) => void;
  HOST_JOIN_ERROR: (data: { message: string }) => void;
  RECONNECT_SUCCESS: (data: {
    teamId: string;
    teamName: string;
    gameState: GameState;
  }) => void;
  RECONNECT_ERROR: (data: { message: string }) => void;
  GAME_STATE: (data: GameState) => void;
  TEAM_JOINED: (data: { teamId: string; teamName: string; joinOrder: number }) => void;
  TEAM_LEFT: (data: { teamId: string }) => void;
  TEAM_READY: (data: { teamId: string }) => void;
  TEAM_RENAMED: (data: { teamId: string; newName: string }) => void;
  GAME_STARTED: (data: { gameState: GameState }) => void;
  QUESTION_REVEALED: (data: {
    roundNumber: number;
    questionNumber: number;
    question: Question;
    timer: TimerState;
  }) => void;
  TIMER_SYNC: (data: TimerState) => void;
  ANSWERING_STARTED: (data: { timer: TimerState }) => void;
  QUESTION_ENDED: (data: { roundNumber: number; questionNumber: number }) => void;
  ANSWER_SUBMITTED: (data: {
    teamId: string;
    roundNumber: number;
    questionNumber: number;
  }) => void;
  ANSWER_CONFIRMED: (data: {
    teamId: string;
    roundNumber: number;
    questionNumber: number;
    selectedAnswer: 'A' | 'B' | 'C' | 'D';
  }) => void;
  ANSWER_ERROR: (data: { message: string }) => void;
  GAME_PAUSED: (data: { pausedAt: number; remainingMs: number }) => void;
  GAME_RESUMED: (data: { timer: TimerState }) => void;
  ROUND_SCORED: (data: RoundScoringResult) => void;
  LEADERBOARD_UPDATE: (data: { leaderboard: LeaderboardEntry[] }) => void;
  GAME_FINISHED: (data: { finalLeaderboard: LeaderboardEntry[]; gameSessionId: string }) => void;
  ERROR: (data: { message: string; code?: string }) => void;
}

export interface SocketData {
  teamId?: string;
  gameSessionId?: string;
  isHost?: boolean;
  reconnectToken?: string;
}
