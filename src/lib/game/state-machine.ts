/**
 * Custom State Machine for Trivia Game
 * Handles game status transitions with validation guards
 */

import { GameStatus } from '@/types';

// Valid state transitions
const validTransitions: Record<GameStatus, GameStatus[]> = {
  [GameStatus.LOBBY]: [GameStatus.READING_DELAY],
  [GameStatus.READING_DELAY]: [GameStatus.ANSWERING, GameStatus.PAUSED],
  [GameStatus.ANSWERING]: [GameStatus.READING_DELAY, GameStatus.PAUSED, GameStatus.ROUND_SCORED],
  [GameStatus.PAUSED]: [GameStatus.READING_DELAY, GameStatus.ANSWERING],
  [GameStatus.ROUND_SCORED]: [GameStatus.READING_DELAY, GameStatus.FINISHED],
  [GameStatus.FINISHED]: [],
};

// Transition guards - conditions that must be met for transition
interface TransitionContext {
  currentRound: number;
  currentQuestion: number;
  totalRounds: number;
  questionsInCurrentRound: number;
  teamsReady: number;
  totalTeams: number;
  previousStatus?: GameStatus;
}

type TransitionGuard = (context: TransitionContext) => { allowed: boolean; reason?: string };

const transitionGuards: Partial<Record<`${GameStatus}->${GameStatus}`, TransitionGuard>> = {
  // Can only start game if at least one team is ready
  [`${GameStatus.LOBBY}->${GameStatus.READING_DELAY}`]: (ctx) => ({
    allowed: ctx.teamsReady > 0,
    reason: ctx.teamsReady === 0 ? 'At least one team must be ready to start' : undefined,
  }),
  
  // Can only score round after last question in round
  [`${GameStatus.ANSWERING}->${GameStatus.ROUND_SCORED}`]: (ctx) => ({
    allowed: ctx.currentQuestion === ctx.questionsInCurrentRound,
    reason: ctx.currentQuestion !== ctx.questionsInCurrentRound 
      ? 'Can only score round after last question' 
      : undefined,
  }),
  
  // Can only finish after last round is scored
  [`${GameStatus.ROUND_SCORED}->${GameStatus.FINISHED}`]: (ctx) => ({
    allowed: ctx.currentRound === ctx.totalRounds,
    reason: ctx.currentRound !== ctx.totalRounds 
      ? 'Can only finish after last round' 
      : undefined,
  }),
};

export interface TransitionResult {
  success: boolean;
  newStatus?: GameStatus;
  error?: string;
}

/**
 * Attempt to transition from one game status to another
 */
export function transition(
  from: GameStatus,
  to: GameStatus,
  context: TransitionContext
): TransitionResult {
  // Check if transition is valid
  const allowedTransitions = validTransitions[from];
  if (!allowedTransitions.includes(to)) {
    return {
      success: false,
      error: `Invalid transition from ${from} to ${to}`,
    };
  }
  
  // Check guard if exists
  const guardKey = `${from}->${to}` as const;
  const guard = transitionGuards[guardKey];
  if (guard) {
    const guardResult = guard(context);
    if (!guardResult.allowed) {
      return {
        success: false,
        error: guardResult.reason || `Transition guard failed for ${guardKey}`,
      };
    }
  }
  
  return {
    success: true,
    newStatus: to,
  };
}

/**
 * Get allowed transitions from current status
 */
export function getAllowedTransitions(from: GameStatus): GameStatus[] {
  return validTransitions[from] || [];
}

/**
 * Check if a specific transition is allowed (without guards)
 */
export function isTransitionAllowed(from: GameStatus, to: GameStatus): boolean {
  return validTransitions[from]?.includes(to) ?? false;
}

/**
 * Determine next status after auto-advance from answering
 */
export function getNextStatusAfterQuestion(
  currentRound: number,
  currentQuestion: number,
  questionsInRound: number,
  totalRounds: number
): { nextStatus: GameStatus; nextRound: number; nextQuestion: number } {
  // If not the last question in round, move to next question
  if (currentQuestion < questionsInRound) {
    return {
      nextStatus: GameStatus.READING_DELAY,
      nextRound: currentRound,
      nextQuestion: currentQuestion + 1,
    };
  }
  
  // Last question in round - need to score the round
  return {
    nextStatus: GameStatus.ANSWERING, // Stay in answering until host scores
    nextRound: currentRound,
    nextQuestion: currentQuestion,
  };
}

/**
 * Determine next status after scoring a round
 */
export function getNextStatusAfterScoring(
  currentRound: number,
  totalRounds: number
): { nextStatus: GameStatus; nextRound: number } {
  if (currentRound >= totalRounds) {
    return {
      nextStatus: GameStatus.FINISHED,
      nextRound: currentRound,
    };
  }
  
  return {
    nextStatus: GameStatus.READING_DELAY,
    nextRound: currentRound + 1,
  };
}
