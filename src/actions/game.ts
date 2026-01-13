'use server';

/**
 * Server Actions for Game Session Management
 */

import prisma from '@/lib/db';
import { hashPin, verifyPin } from '@/lib/auth/hash';
import { generateGameCode, StartGameSchema } from '@/lib/validation/schemas';
import { Question, LeaderboardEntry } from '@/types';

export interface StartGameResult {
  success: boolean;
  gameSessionId?: string;
  gameCode?: string;
  error?: string;
}

/**
 * Generate a unique game code
 */
async function generateUniqueGameCode(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const code = generateGameCode();
    const existing = await prisma.gameSession.findUnique({
      where: { gameCode: code },
    });
    
    if (!existing) {
      return code;
    }
    attempts++;
  }
  
  throw new Error('Failed to generate unique game code');
}

/**
 * Start a new game session from a trivia config
 */
export async function startGameSession(
  triviaConfigId: string,
  hostPin: string,
  customGameCode?: string,
  readingDelayMs: number = 15000,
  answeringTimeMs: number = 30000
): Promise<StartGameResult> {
  try {
    // Validate config exists
    const config = await prisma.triviaConfig.findUnique({
      where: { id: triviaConfigId },
    });
    
    if (!config) {
      return { success: false, error: 'Trivia config not found' };
    }
    
    // Validate or generate game code
    let gameCode: string;
    if (customGameCode) {
      const validation = StartGameSchema.shape.gameCode.safeParse(customGameCode);
      if (!validation.success) {
        return { success: false, error: validation.error.errors[0]?.message };
      }
      
      // Check if code is already in use
      const existing = await prisma.gameSession.findUnique({
        where: { gameCode: validation.data },
      });
      
      if (existing && existing.status !== 'FINISHED') {
        return { success: false, error: 'Game code is already in use' };
      }
      
      gameCode = validation.data;
    } else {
      gameCode = await generateUniqueGameCode();
    }
    
    // Validate host PIN
    const pinValidation = StartGameSchema.shape.hostPin.safeParse(hostPin);
    if (!pinValidation.success) {
      return { success: false, error: pinValidation.error.errors[0]?.message };
    }
    
    // Hash the PIN
    const hostPinHash = await hashPin(hostPin);
    
    // Create game session
    const session = await prisma.gameSession.create({
      data: {
        gameCode,
        hostPinHash,
        triviaConfigId,
        readingDelayMs,
        answeringTimeMs,
      },
    });
    
    return {
      success: true,
      gameSessionId: session.id,
      gameCode: session.gameCode,
    };
  } catch (error) {
    console.error('startGameSession error:', error);
    return { success: false, error: 'Failed to start game session' };
  }
}

/**
 * Verify host PIN for a game session
 */
export async function verifyHostPin(
  gameSessionId: string,
  hostPin: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const session = await prisma.gameSession.findUnique({
      where: { id: gameSessionId },
    });
    
    if (!session) {
      return { valid: false, error: 'Game session not found' };
    }
    
    const isValid = await verifyPin(hostPin, session.hostPinHash);
    
    return { valid: isValid, error: isValid ? undefined : 'Invalid PIN' };
  } catch (error) {
    console.error('verifyHostPin error:', error);
    return { valid: false, error: 'Verification failed' };
  }
}

/**
 * Get game session by code
 */
export async function getGameSessionByCode(gameCode: string) {
  try {
    const session = await prisma.gameSession.findUnique({
      where: { gameCode: gameCode.toUpperCase() },
      include: {
        triviaConfig: true,
        teams: {
          orderBy: { joinOrder: 'asc' },
        },
      },
    });
    
    if (!session) return null;
    
    return {
      id: session.id,
      gameCode: session.gameCode,
      status: session.status,
      currentRound: session.currentRound,
      currentQuestion: session.currentQuestion,
      triviaConfig: {
        name: session.triviaConfig.name,
        totalRounds: session.triviaConfig.totalRounds,
        totalQuestions: session.triviaConfig.totalQuestions,
      },
      teams: session.teams.map((t) => ({
        id: t.id,
        name: t.name,
        isReady: t.isReady,
        isConnected: t.isConnected,
        joinOrder: t.joinOrder,
      })),
    };
  } catch (error) {
    console.error('getGameSessionByCode error:', error);
    return null;
  }
}

/**
 * Get game session by ID
 */
export async function getGameSession(gameSessionId: string) {
  try {
    const session = await prisma.gameSession.findUnique({
      where: { id: gameSessionId },
      include: {
        triviaConfig: true,
        teams: {
          orderBy: { joinOrder: 'asc' },
        },
      },
    });
    
    if (!session) return null;
    
    const questions: Question[] = JSON.parse(session.triviaConfig.questionsJson);
    
    return {
      id: session.id,
      gameCode: session.gameCode,
      status: session.status,
      currentRound: session.currentRound,
      currentQuestion: session.currentQuestion,
      readingDelayMs: session.readingDelayMs,
      answeringTimeMs: session.answeringTimeMs,
      triviaConfig: {
        id: session.triviaConfig.id,
        name: session.triviaConfig.name,
        totalRounds: session.triviaConfig.totalRounds,
        totalQuestions: session.triviaConfig.totalQuestions,
        questions,
      },
      teams: session.teams.map((t) => ({
        id: t.id,
        name: t.name,
        isReady: t.isReady,
        isConnected: t.isConnected,
        joinOrder: t.joinOrder,
        totalScore: t.totalScore,
      })),
      createdAt: session.createdAt,
    };
  } catch (error) {
    console.error('getGameSession error:', error);
    return null;
  }
}

/**
 * Get completed games for scoreboard
 */
export async function getCompletedGames() {
  try {
    const sessions = await prisma.gameSession.findMany({
      where: { status: 'FINISHED' },
      orderBy: { completedAt: 'desc' },
      include: {
        triviaConfig: {
          select: { name: true, totalRounds: true, totalQuestions: true },
        },
        teams: {
          orderBy: { totalScore: 'desc' },
          take: 1,
        },
        _count: {
          select: { teams: true },
        },
      },
    });
    
    return sessions.map((session) => ({
      id: session.id,
      gameCode: session.gameCode,
      configName: session.triviaConfig.name,
      endedAt: session.completedAt || session.updatedAt,
      totalRounds: session.triviaConfig.totalRounds,
      totalQuestions: session.triviaConfig.totalQuestions,
      teamCount: session._count.teams,
      winner: session.teams[0]
        ? { name: session.teams[0].name, score: session.teams[0].totalScore }
        : null,
    }));
  } catch (error) {
    console.error('getCompletedGames error:', error);
    return [];
  }
}

/**
 * Get detailed game result for scoreboard page
 */
export async function getGameResult(gameSessionId: string) {
  try {
    const session = await prisma.gameSession.findUnique({
      where: { id: gameSessionId },
      include: {
        triviaConfig: true,
        teams: {
          orderBy: { totalScore: 'desc' },
        },
        answers: true,
      },
    });
    
    if (!session) return null;
    
    const questions: Question[] = JSON.parse(session.triviaConfig.questionsJson);
    
    // Build leaderboard with rankings
    const teamsWithScores = session.teams.map((team) => ({
      id: team.id,
      name: team.name,
      totalScore: team.totalScore,
      roundScores: JSON.parse(team.roundScoresJson || '{}') as Record<number, number>,
    }));
    
    const sorted = [...teamsWithScores].sort((a, b) => b.totalScore - a.totalScore);
    let currentRank = 1;
    let previousScore: number | null = null;
    let skipCount = 0;
    
    const leaderboard: LeaderboardEntry[] = sorted.map((team) => {
      if (previousScore !== null && team.totalScore < previousScore) {
        currentRank += skipCount + 1;
        skipCount = 0;
      } else if (previousScore !== null && team.totalScore === previousScore) {
        skipCount++;
      }
      previousScore = team.totalScore;
      
      return {
        id: team.id,
        name: team.name,
        totalScore: team.totalScore,
        rank: currentRank,
        roundScores: team.roundScores,
        isConnected: true,
      };
    });
    
    // Calculate statistics
    const totalCorrect = session.answers.filter((a) => a.isCorrect).length;
    const totalAnswers = session.answers.length;
    const avgResponseTime = totalAnswers > 0
      ? Math.round(session.answers.reduce((sum, a) => sum + a.responseTimeMs, 0) / totalAnswers / 1000 * 10) / 10
      : 0;
    
    // Build round breakdown
    const roundBreakdown: { questions: number; correctRate: number; avgScore: number; topScorer: string }[] = [];
    
    // Group questions by round
    const questionsByRound: Record<number, Question[]> = {};
    for (const q of questions) {
      if (!questionsByRound[q.round]) {
        questionsByRound[q.round] = [];
      }
      questionsByRound[q.round].push(q);
    }
    
    for (let r = 1; r <= session.triviaConfig.totalRounds; r++) {
      const roundQuestions = questionsByRound[r] || [];
      const roundAnswers = session.answers.filter((a) => a.roundIndex === r - 1);
      const roundCorrect = roundAnswers.filter((a) => a.isCorrect).length;
      const correctRate = roundAnswers.length > 0 
        ? Math.round(roundCorrect / roundAnswers.length * 100) 
        : 0;
      
      // Find top scorer for this round
      const roundScoresByTeam: Record<string, number> = {};
      for (const team of session.teams) {
        const scores = JSON.parse(team.roundScoresJson || '{}');
        roundScoresByTeam[team.name] = scores[r] || 0;
      }
      
      const topScorer = Object.entries(roundScoresByTeam)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || '-';
      
      const avgScore = session.teams.length > 0
        ? Math.round(Object.values(roundScoresByTeam).reduce((a, b) => a + b, 0) / session.teams.length)
        : 0;
      
      roundBreakdown.push({
        questions: roundQuestions.length,
        correctRate,
        avgScore,
        topScorer,
      });
    }
    
    return {
      game: {
        id: session.id,
        gameCode: session.gameCode,
        configName: session.triviaConfig.name,
        endedAt: session.completedAt || session.updatedAt,
      },
      leaderboard,
      stats: {
        totalTeams: session.teams.length,
        totalQuestions: session.triviaConfig.totalQuestions,
        totalCorrect,
        avgResponseTime,
        roundBreakdown,
      },
    };
  } catch (error) {
    console.error('getGameResult error:', error);
    return null;
  }
}
