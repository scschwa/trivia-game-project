/**
 * Socket.IO Event Types and Contracts
 * Shared between client and server
 */

import { GameState, Question, TimerState, LeaderboardEntry, RoundScoringResult } from '@/types';

// ==================== Client -> Server Events ====================

export interface ClientToServerEvents {
  // Team events
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
  
  // Host events
  HOST_JOIN: (data: { gameSessionId: string; hostPin: string }) => void;
  HOST_START_GAME: (data: { gameSessionId: string }) => void;
  HOST_REVEAL_QUESTION: (data: { gameSessionId: string }) => void;
  HOST_NEXT_QUESTION: (data: { gameSessionId: string }) => void;
  HOST_PAUSE: (data: { gameSessionId: string }) => void;
  HOST_RESUME: (data: { gameSessionId: string }) => void;
  HOST_SCORE_ROUND: (data: { gameSessionId: string; roundNumber: number }) => void;
  HOST_END_GAME: (data: { gameSessionId: string }) => void;
  
  // Connection events
  RECONNECT: (data: { reconnectToken: string }) => void;
  REQUEST_STATE: (data: { gameCode: string }) => void;
}

// ==================== Server -> Client Events ====================

export interface ServerToClientEvents {
  // Connection responses
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
  
  // Game state updates
  GAME_STATE: (data: GameState) => void;
  TEAM_JOINED: (data: { teamId: string; teamName: string; joinOrder: number }) => void;
  TEAM_LEFT: (data: { teamId: string }) => void;
  TEAM_READY: (data: { teamId: string }) => void;
  TEAM_RENAMED: (data: { teamId: string; newName: string }) => void;
  
  // Gameplay events
  GAME_STARTED: (data: { gameState: GameState }) => void;
  QUESTION_REVEALED: (data: {
    roundNumber: number;
    questionNumber: number;
    question: Question;
    timer: TimerState;
  }) => void;
  TIMER_SYNC: (data: TimerState) => void;
  ANSWERING_STARTED: (data: { timer: TimerState }) => void;
  QUESTION_ENDED: (data: {
    roundNumber: number;
    questionNumber: number;
  }) => void;
  
  // Answer events
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
  
  // Pause/Resume
  GAME_PAUSED: (data: { pausedAt: number; remainingMs: number }) => void;
  GAME_RESUMED: (data: { timer: TimerState }) => void;
  
  // Scoring events
  ROUND_SCORED: (data: RoundScoringResult) => void;
  LEADERBOARD_UPDATE: (data: { leaderboard: LeaderboardEntry[] }) => void;
  
  // Game completion
  GAME_FINISHED: (data: {
    finalLeaderboard: LeaderboardEntry[];
    gameSessionId: string;
  }) => void;
  
  // Error handling
  ERROR: (data: { message: string; code?: string }) => void;
}

// ==================== Inter-Server Events (for scaling) ====================

export interface InterServerEvents {
  ping: () => void;
}

// ==================== Socket Data (per-socket state) ====================

export interface SocketData {
  teamId?: string;
  gameSessionId?: string;
  isHost?: boolean;
  reconnectToken?: string;
}

// ==================== Room Names ====================

export function getGameRoom(gameCode: string): string {
  return `game:${gameCode}`;
}

export function getTeamRoom(teamId: string): string {
  return `team:${teamId}`;
}

export function getHostRoom(gameSessionId: string): string {
  return `host:${gameSessionId}`;
}
