/**
 * Timer Manager - Handles server-authoritative timing for games
 */

import { Server } from 'socket.io';
import prisma from './db';
import { GameStatus, Question, TimerState, GameState, LeaderboardEntry } from './types';

interface ActiveGame {
  gameSessionId: string;
  gameCode: string;
  intervalId: NodeJS.Timeout | null;
  autoAdvanceTimeout: NodeJS.Timeout | null;
  readingDelayTimeout: NodeJS.Timeout | null;
}

// Track active games
const activeGames = new Map<string, ActiveGame>();

/**
 * Start managing timers for a game
 */
export function startGameTimers(
  io: Server,
  gameSessionId: string,
  gameCode: string
): void {
  // Clean up any existing timers
  stopGameTimers(gameSessionId);
  
  const game: ActiveGame = {
    gameSessionId,
    gameCode,
    intervalId: null,
    autoAdvanceTimeout: null,
    readingDelayTimeout: null,
  };
  
  // Broadcast timer sync every 500ms
  game.intervalId = setInterval(async () => {
    const session = await prisma.gameSession.findUnique({
      where: { id: gameSessionId },
    });
    
    if (!session || session.status === 'FINISHED') {
      stopGameTimers(gameSessionId);
      return;
    }
    
    if (session.status === 'PAUSED') {
      return; // Don't broadcast during pause
    }
    
    const timerState = calculateTimerState(session);
    io.to(`game:${gameCode}`).emit('TIMER_SYNC', timerState);
  }, 500);
  
  activeGames.set(gameSessionId, game);
}

/**
 * Stop all timers for a game
 */
export function stopGameTimers(gameSessionId: string): void {
  const game = activeGames.get(gameSessionId);
  if (!game) return;
  
  if (game.intervalId) clearInterval(game.intervalId);
  if (game.autoAdvanceTimeout) clearTimeout(game.autoAdvanceTimeout);
  if (game.readingDelayTimeout) clearTimeout(game.readingDelayTimeout);
  
  activeGames.delete(gameSessionId);
}

/**
 * Schedule auto-advance when question timer ends
 */
export function scheduleAutoAdvance(
  io: Server,
  gameSessionId: string,
  gameCode: string,
  delayMs: number,
  onAdvance: () => Promise<void>
): void {
  const game = activeGames.get(gameSessionId);
  if (!game) return;
  
  // Clear existing timeout
  if (game.autoAdvanceTimeout) {
    clearTimeout(game.autoAdvanceTimeout);
  }
  
  game.autoAdvanceTimeout = setTimeout(async () => {
    await onAdvance();
  }, delayMs);
}

/**
 * Schedule transition from reading delay to answering
 */
export function scheduleAnsweringStart(
  io: Server,
  gameSessionId: string,
  gameCode: string,
  delayMs: number
): void {
  const game = activeGames.get(gameSessionId);
  if (!game) return;
  
  // Clear existing timeout
  if (game.readingDelayTimeout) {
    clearTimeout(game.readingDelayTimeout);
  }
  
  game.readingDelayTimeout = setTimeout(async () => {
    // Update game status to ANSWERING
    const session = await prisma.gameSession.update({
      where: { id: gameSessionId },
      data: { status: 'ANSWERING' },
    });
    
    const timerState = calculateTimerState(session);
    io.to(`game:${gameCode}`).emit('ANSWERING_STARTED', { timer: timerState });
  }, delayMs);
}

/**
 * Cancel scheduled events (for pause)
 */
export function cancelScheduledEvents(gameSessionId: string): void {
  const game = activeGames.get(gameSessionId);
  if (!game) return;
  
  if (game.autoAdvanceTimeout) {
    clearTimeout(game.autoAdvanceTimeout);
    game.autoAdvanceTimeout = null;
  }
  if (game.readingDelayTimeout) {
    clearTimeout(game.readingDelayTimeout);
    game.readingDelayTimeout = null;
  }
}

/**
 * Calculate timer state from session data
 */
export function calculateTimerState(session: {
  status: string;
  questionRevealedAt: bigint | null;
  answeringStartsAt: bigint | null;
  questionEndsAt: bigint | null;
  pausedAt: bigint | null;
  remainingTimeOnPause: number | null;
  readingDelayMs: number;
  answeringTimeMs: number;
}): TimerState {
  const now = Date.now();
  
  // Timer not started
  if (!session.questionRevealedAt) {
    return {
      phase: 'waiting',
      remainingMs: 0,
      totalMs: 0,
      endsAt: null,
    };
  }
  
  // Paused
  if (session.pausedAt !== null) {
    const pausedAt = Number(session.pausedAt);
    const answeringStartsAt = session.answeringStartsAt ? Number(session.answeringStartsAt) : null;
    const wasInReadingDelay = answeringStartsAt && pausedAt < answeringStartsAt;
    
    return {
      phase: 'paused',
      remainingMs: session.remainingTimeOnPause || 0,
      totalMs: wasInReadingDelay ? session.readingDelayMs : session.answeringTimeMs,
      endsAt: null,
    };
  }
  
  const answeringStartsAt = session.answeringStartsAt ? Number(session.answeringStartsAt) : null;
  const questionEndsAt = session.questionEndsAt ? Number(session.questionEndsAt) : null;
  
  // In reading delay phase
  if (answeringStartsAt && now < answeringStartsAt) {
    return {
      phase: 'reading',
      remainingMs: answeringStartsAt - now,
      totalMs: session.readingDelayMs,
      endsAt: answeringStartsAt,
    };
  }
  
  // In answering phase
  if (questionEndsAt && now < questionEndsAt) {
    return {
      phase: 'answering',
      remainingMs: questionEndsAt - now,
      totalMs: session.answeringTimeMs,
      endsAt: questionEndsAt,
    };
  }
  
  // Timer ended
  return {
    phase: 'ended',
    remainingMs: 0,
    totalMs: session.answeringTimeMs,
    endsAt: questionEndsAt,
  };
}

/**
 * Build game state for clients
 */
export async function buildGameState(gameSessionId: string): Promise<GameState | null> {
  const session = await prisma.gameSession.findUnique({
    where: { id: gameSessionId },
    include: {
      triviaConfig: true,
      teams: {
        orderBy: { joinOrder: 'asc' },
      },
      answers: true,
    },
  });
  
  if (!session) return null;
  
  const questions: Question[] = JSON.parse(session.triviaConfig.questionsJson);
  const currentQuestion = questions.find(
    (q) => q.roundNumber === session.currentRound && q.questionNumber === session.currentQuestion
  ) || null;
  
  // Calculate team rankings
  const teamsWithScores = session.teams.map((team) => {
    const roundScores: Record<number, number> = JSON.parse(team.roundScoresJson || '{}');
    return {
      id: team.id,
      name: team.name,
      totalScore: team.totalScore,
      roundScores,
      isConnected: team.isConnected,
      score: team.totalScore, // For ranking calculation
    };
  });
  
  // Sort by score and assign ranks
  const sorted = [...teamsWithScores].sort((a, b) => b.score - a.score);
  let currentRank = 1;
  let previousScore: number | null = null;
  let skipCount = 0;
  
  const teamsWithRanks = sorted.map((team, index) => {
    if (previousScore !== null && team.score < previousScore) {
      currentRank += skipCount + 1;
      skipCount = 0;
    } else if (previousScore !== null && team.score === previousScore) {
      skipCount++;
    }
    previousScore = team.score;
    
    return {
      id: team.id,
      name: team.name,
      totalScore: team.totalScore,
      rank: currentRank,
      roundScores: team.roundScores,
      isConnected: team.isConnected,
    };
  });
  
  // Determine which rounds have been scored
  const scoredRounds: number[] = [];
  for (let r = 1; r < session.currentRound; r++) {
    scoredRounds.push(r);
  }
  if (session.status === 'ROUND_SCORED' || session.status === 'FINISHED') {
    if (!scoredRounds.includes(session.currentRound)) {
      scoredRounds.push(session.currentRound);
    }
  }
  
  return {
    sessionId: session.id,
    gameCode: session.gameCode,
    status: session.status as GameStatus,
    currentRound: session.currentRound,
    currentQuestion: session.currentQuestion,
    totalRounds: session.triviaConfig.totalRounds,
    totalQuestions: session.triviaConfig.totalQuestions,
    currentQuestionData: currentQuestion,
    timer: calculateTimerState(session),
    teams: teamsWithRanks,
    scoredRounds,
  };
}

/**
 * Build leaderboard from teams
 */
export function buildLeaderboard(teams: Array<{
  id: string;
  name: string;
  totalScore: number;
  roundScoresJson: string;
}>): LeaderboardEntry[] {
  const teamsWithScores = teams.map((team) => ({
    teamId: team.id,
    teamName: team.name,
    totalScore: team.totalScore,
    roundScores: JSON.parse(team.roundScoresJson || '{}') as Record<number, number>,
    score: team.totalScore,
  }));
  
  const sorted = [...teamsWithScores].sort((a, b) => b.score - a.score);
  let currentRank = 1;
  let previousScore: number | null = null;
  let skipCount = 0;
  
  return sorted.map((team) => {
    if (previousScore !== null && team.score < previousScore) {
      currentRank += skipCount + 1;
      skipCount = 0;
    } else if (previousScore !== null && team.score === previousScore) {
      skipCount++;
    }
    previousScore = team.score;
    
    return {
      teamId: team.teamId,
      teamName: team.teamName,
      totalScore: team.totalScore,
      rank: currentRank,
      roundScores: team.roundScores,
    };
  });
}
