'use server';

/**
 * Server Actions for Team Management
 */

import prisma from '@/lib/db';
import { TeamNameSchema } from '@/lib/validation/schemas';
import { createSimpleReconnectToken } from '@/lib/auth/tokens';
import { AnswerHistory, Question } from '@/types';

/**
 * Get team by reconnect token
 */
export async function getTeamByToken(reconnectToken: string) {
  try {
    const team = await prisma.team.findUnique({
      where: { reconnectToken },
      include: {
        gameSession: {
          include: {
            triviaConfig: true,
          },
        },
      },
    });
    
    if (!team) return null;
    
    return {
      id: team.id,
      name: team.name,
      isReady: team.isReady,
      totalScore: team.totalScore,
      gameSession: {
        id: team.gameSession.id,
        gameCode: team.gameSession.gameCode,
        status: team.gameSession.status,
        currentRound: team.gameSession.currentRound,
        currentQuestion: team.gameSession.currentQuestion,
      },
    };
  } catch (error) {
    console.error('getTeamByToken error:', error);
    return null;
  }
}

/**
 * Get team answer history
 */
export async function getTeamAnswerHistory(teamId: string): Promise<AnswerHistory[]> {
  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        gameSession: {
          include: {
            triviaConfig: true,
          },
        },
        answers: {
          orderBy: [{ roundNumber: 'asc' }, { questionNumber: 'asc' }],
        },
      },
    });
    
    if (!team) return [];
    
    const questions: Question[] = JSON.parse(team.gameSession.triviaConfig.questionsJson);
    
    // Determine which rounds have been scored
    const scoredRounds = new Set<number>();
    for (let r = 1; r < team.gameSession.currentRound; r++) {
      scoredRounds.add(r);
    }
    if (team.gameSession.status === 'ROUND_SCORED' || team.gameSession.status === 'FINISHED') {
      scoredRounds.add(team.gameSession.currentRound);
    }
    
    return team.answers.map((answer) => {
      const question = questions.find(
        (q) => q.roundNumber === answer.roundNumber && q.questionNumber === answer.questionNumber
      );
      
      const answerText = question
        ? question[`answer${answer.selectedAnswer}` as keyof Question] as string
        : '';
      
      return {
        roundNumber: answer.roundNumber,
        questionNumber: answer.questionNumber,
        selectedAnswer: answer.selectedAnswer,
        answerText,
        isCorrect: scoredRounds.has(answer.roundNumber) ? answer.isCorrect : null,
        pointsAwarded: answer.pointsAwarded,
      };
    });
  } catch (error) {
    console.error('getTeamAnswerHistory error:', error);
    return [];
  }
}

/**
 * Check if team has answered current question
 */
export async function hasTeamAnswered(
  teamId: string,
  roundNumber: number,
  questionNumber: number
): Promise<boolean> {
  try {
    const answer = await prisma.answer.findFirst({
      where: {
        teamId,
        roundNumber,
        questionNumber,
      },
    });
    
    return answer !== null;
  } catch (error) {
    console.error('hasTeamAnswered error:', error);
    return false;
  }
}

/**
 * Get team's answer for a specific question
 */
export async function getTeamAnswer(
  teamId: string,
  roundNumber: number,
  questionNumber: number
) {
  try {
    const answer = await prisma.answer.findFirst({
      where: {
        teamId,
        roundNumber,
        questionNumber,
      },
    });
    
    return answer;
  } catch (error) {
    console.error('getTeamAnswer error:', error);
    return null;
  }
}
