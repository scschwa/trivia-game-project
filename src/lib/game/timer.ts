/**
 * Server-Authoritative Timer Utilities
 * All timing is based on Unix timestamps (milliseconds)
 */

import { TimerState } from '@/types';

export interface ServerTimerState {
  questionRevealedAt: number | null;
  answeringStartsAt: number | null;
  questionEndsAt: number | null;
  pausedAt: number | null;
  remainingTimeOnPause: number | null;
  readingDelayMs: number;
  answeringTimeMs: number;
}

/**
 * Start a new question timer (reading delay phase)
 */
export function startQuestionTimer(
  readingDelayMs: number,
  answeringTimeMs: number
): ServerTimerState {
  const now = Date.now();
  return {
    questionRevealedAt: now,
    answeringStartsAt: now + readingDelayMs,
    questionEndsAt: now + readingDelayMs + answeringTimeMs,
    pausedAt: null,
    remainingTimeOnPause: null,
    readingDelayMs,
    answeringTimeMs,
  };
}

/**
 * Pause the timer at current moment
 */
export function pauseTimer(state: ServerTimerState): ServerTimerState {
  if (state.pausedAt !== null) {
    return state; // Already paused
  }
  
  const now = Date.now();
  const remainingTime = state.questionEndsAt ? state.questionEndsAt - now : 0;
  
  return {
    ...state,
    pausedAt: now,
    remainingTimeOnPause: Math.max(0, remainingTime),
  };
}

/**
 * Resume the timer from paused state
 */
export function resumeTimer(state: ServerTimerState): ServerTimerState {
  if (state.pausedAt === null || state.remainingTimeOnPause === null) {
    return state; // Not paused
  }
  
  const now = Date.now();
  const pauseDuration = now - state.pausedAt;
  
  // Determine which phase we're in and adjust times
  const wasInReadingDelay = state.answeringStartsAt && state.pausedAt < state.answeringStartsAt;
  
  return {
    ...state,
    questionRevealedAt: state.questionRevealedAt ? state.questionRevealedAt + pauseDuration : null,
    answeringStartsAt: state.answeringStartsAt ? state.answeringStartsAt + pauseDuration : null,
    questionEndsAt: state.questionEndsAt ? state.questionEndsAt + pauseDuration : null,
    pausedAt: null,
    remainingTimeOnPause: null,
  };
}

/**
 * Get the current timer state for clients
 */
export function getClientTimerState(serverState: ServerTimerState): TimerState {
  const now = Date.now();
  
  // Timer not started
  if (!serverState.questionRevealedAt) {
    return {
      phase: 'waiting',
      remainingMs: 0,
      totalMs: 0,
      endsAt: null,
      serverTime: now,
    };
  }
  
  // Paused
  if (serverState.pausedAt !== null) {
    const wasInReadingDelay = serverState.answeringStartsAt && 
      serverState.pausedAt < serverState.answeringStartsAt;
    
    return {
      phase: 'paused',
      remainingMs: serverState.remainingTimeOnPause || 0,
      totalMs: wasInReadingDelay ? serverState.readingDelayMs : serverState.answeringTimeMs,
      endsAt: null,
      serverTime: now,
    };
  }
  
  // In reading delay phase
  if (serverState.answeringStartsAt && now < serverState.answeringStartsAt) {
    return {
      phase: 'reading',
      remainingMs: serverState.answeringStartsAt - now,
      totalMs: serverState.readingDelayMs,
      endsAt: serverState.answeringStartsAt,
      serverTime: now,
    };
  }
  
  // In answering phase
  if (serverState.questionEndsAt && now < serverState.questionEndsAt) {
    return {
      phase: 'answering',
      remainingMs: serverState.questionEndsAt - now,
      totalMs: serverState.answeringTimeMs,
      endsAt: serverState.questionEndsAt,
      serverTime: now,
    };
  }
  
  // Timer ended
  return {
    phase: 'ended',
    remainingMs: 0,
    totalMs: serverState.answeringTimeMs,
    endsAt: serverState.questionEndsAt,
    serverTime: now,
  };
}

/**
 * Check if timer has expired
 */
export function isTimerExpired(serverState: ServerTimerState): boolean {
  if (serverState.pausedAt !== null) {
    return false; // Paused timers don't expire
  }
  
  if (!serverState.questionEndsAt) {
    return false;
  }
  
  return Date.now() >= serverState.questionEndsAt;
}

/**
 * Get milliseconds until answering phase starts
 */
export function getMsUntilAnswering(serverState: ServerTimerState): number {
  if (serverState.pausedAt !== null || !serverState.answeringStartsAt) {
    return 0;
  }
  
  return Math.max(0, serverState.answeringStartsAt - Date.now());
}

/**
 * Get milliseconds until question ends
 */
export function getMsUntilQuestionEnds(serverState: ServerTimerState): number {
  if (serverState.pausedAt !== null || !serverState.questionEndsAt) {
    return 0;
  }
  
  return Math.max(0, serverState.questionEndsAt - Date.now());
}

/**
 * Format milliseconds as MM:SS or SS
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  return `${seconds}`;
}
