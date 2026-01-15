'use server';

/**
 * Server Actions for Trivia Config Management
 */

import prisma from '@/lib/db';
import { parseAndValidateCSV } from '@/lib/csv/parser';
import { CreateConfigSchema } from '@/lib/validation/schemas';
import { CSVValidationResult, Question } from '@/types';

export interface CreateConfigResult {
  success: boolean;
  configId?: string;
  error?: string;
}

/**
 * Validate a CSV file content
 */
export async function validateCSV(csvContent: string): Promise<CSVValidationResult> {
  return parseAndValidateCSV(csvContent);
}

/**
 * Create a new trivia config from validated CSV data
 */
export async function createTriviaConfig(
  name: string,
  description: string | undefined,
  questions: Question[]
): Promise<CreateConfigResult> {
  try {
    // Validate input
    const validation = CreateConfigSchema.safeParse({ name, description, questions });
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.errors[0]?.message || 'Invalid input',
      };
    }
    
    // Calculate totals
    const roundSet = new Set(questions.map((q) => q.roundNumber));
    const totalRounds = roundSet.size;
    const totalQuestions = questions.length;
    
    // Create config
    const config = await prisma.triviaConfig.create({
      data: {
        name,
        description,
        questionsJson: JSON.stringify(questions),
        totalRounds,
        totalQuestions,
      },
    });
    
    return {
      success: true,
      configId: config.id,
    };
  } catch (error) {
    console.error('createTriviaConfig error:', error);
    return {
      success: false,
      error: 'Failed to create config',
    };
  }
}

/**
 * Get all trivia configs (optionally include archived)
 */
export async function getTriviaConfigs(includeArchived: boolean = false) {
  try {
    const configs = await prisma.triviaConfig.findMany({
      where: includeArchived ? {} : { isArchived: false },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        isArchived: true,
        totalRounds: true,
        totalQuestions: true,
        createdAt: true,
        _count: {
          select: { gameSessions: true },
        },
      },
    });
    
    return configs.map((config) => ({
      ...config,
      gameCount: config._count.gameSessions,
    }));
  } catch (error) {
    console.error('getTriviaConfigs error:', error);
    return [];
  }
}

/**
 * Get a single trivia config with questions
 */
export async function getTriviaConfig(configId: string) {
  try {
    const config = await prisma.triviaConfig.findUnique({
      where: { id: configId },
    });
    
    if (!config) return null;
    
    return {
      ...config,
      questions: JSON.parse(config.questionsJson) as Question[],
    };
  } catch (error) {
    console.error('getTriviaConfig error:', error);
    return null;
  }
}

/**
 * Delete a trivia config
 */
export async function deleteTriviaConfig(configId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if there are any game sessions using this config
    const sessions = await prisma.gameSession.findFirst({
      where: { triviaConfigId: configId },
    });
    
    if (sessions) {
      return {
        success: false,
        error: 'Cannot delete config that has been used in games',
      };
    }
    
    await prisma.triviaConfig.delete({
      where: { id: configId },
    });
    
    return { success: true };
  } catch (error) {
    console.error('deleteTriviaConfig error:', error);
    return {
      success: false,
      error: 'Failed to delete config',
    };
  }
}

/**
 * Archive or unarchive a trivia config
 */
export async function archiveTriviaConfig(configId: string, archive: boolean = true): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.triviaConfig.update({
      where: { id: configId },
      data: { isArchived: archive },
    });
    
    return { success: true };
  } catch (error) {
    console.error('archiveTriviaConfig error:', error);
    return {
      success: false,
      error: archive ? 'Failed to archive config' : 'Failed to restore config',
    };
  }
}
