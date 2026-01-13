/**
 * Zod Validation Schemas
 */

import { z } from 'zod';

// Valid answer letters
export const AnswerLetter = z.enum(['A', 'B', 'C', 'D']);
export type AnswerLetter = z.infer<typeof AnswerLetter>;

// CSV Row Schema
export const CSVRowSchema = z.object({
  roundNumber: z.coerce.number().int().positive('Round number must be a positive integer'),
  questionNumber: z.coerce.number().int().positive('Question number must be a positive integer'),
  question: z.string().min(1, 'Question text is required'),
  answerA: z.string().min(1, 'Answer A is required'),
  answerB: z.string().min(1, 'Answer B is required'),
  answerC: z.string().min(1, 'Answer C is required'),
  answerD: z.string().min(1, 'Answer D is required'),
  correctAnswer: z.string().toUpperCase().pipe(
    AnswerLetter.refine((val) => ['A', 'B', 'C', 'D'].includes(val), {
      message: 'Correct answer must be A, B, C, or D',
    })
  ),
  points: z.coerce.number().int().positive().optional().default(1),
});

export type CSVRow = z.infer<typeof CSVRowSchema>;

// Required CSV columns
export const REQUIRED_CSV_COLUMNS = [
  'roundNumber',
  'questionNumber', 
  'question',
  'answerA',
  'answerB',
  'answerC',
  'answerD',
  'correctAnswer',
] as const;

// Optional CSV columns
export const OPTIONAL_CSV_COLUMNS = ['points'] as const;

// Game Code Schema (6 alphanumeric, excluding ambiguous chars)
const UNAMBIGUOUS_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const GameCodeSchema = z
  .string()
  .length(6, 'Game code must be exactly 6 characters')
  .regex(
    new RegExp(`^[${UNAMBIGUOUS_CHARS}]+$`),
    'Game code contains invalid characters'
  )
  .transform((val) => val.toUpperCase());

// Host PIN Schema (4-8 digits)
export const HostPinSchema = z
  .string()
  .min(4, 'PIN must be at least 4 digits')
  .max(8, 'PIN must be at most 8 digits')
  .regex(/^\d+$/, 'PIN must contain only digits');

// Team Name Schema
export const TeamNameSchema = z
  .string()
  .min(1, 'Team name is required')
  .max(30, 'Team name must be 30 characters or less')
  .regex(/^[a-zA-Z0-9\s\-_'!]+$/, 'Team name contains invalid characters');

// Create Config Schema
export const CreateConfigSchema = z.object({
  name: z.string().min(1, 'Config name is required').max(100),
  description: z.string().max(500).optional(),
  questions: z.array(CSVRowSchema).min(1, 'At least one question is required'),
});

// Start Game Schema
export const StartGameSchema = z.object({
  triviaConfigId: z.string().cuid(),
  gameCode: GameCodeSchema,
  hostPin: HostPinSchema,
  readingDelayMs: z.number().int().min(5000).max(60000).optional().default(15000),
  answeringTimeMs: z.number().int().min(10000).max(120000).optional().default(30000),
});

// Join Game Schema
export const JoinGameSchema = z.object({
  gameCode: GameCodeSchema,
});

// Rename Team Schema
export const RenameTeamSchema = z.object({
  teamId: z.string().cuid(),
  newName: TeamNameSchema,
});

// Submit Answer Schema
export const SubmitAnswerSchema = z.object({
  teamId: z.string().cuid(),
  gameSessionId: z.string().cuid(),
  roundNumber: z.number().int().positive(),
  questionNumber: z.number().int().positive(),
  selectedAnswer: AnswerLetter,
  responseTimeMs: z.number().int().nonnegative(),
});

// Verify Host Schema
export const VerifyHostSchema = z.object({
  gameSessionId: z.string().cuid(),
  hostPin: HostPinSchema,
});

// Score Round Schema
export const ScoreRoundSchema = z.object({
  gameSessionId: z.string().cuid(),
  roundNumber: z.number().int().positive(),
});

/**
 * Generate a random game code
 */
export function generateGameCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += UNAMBIGUOUS_CHARS[Math.floor(Math.random() * UNAMBIGUOUS_CHARS.length)];
  }
  return code;
}

/**
 * Validate that game code is unique (to be called with database check)
 */
export function isValidGameCodeFormat(code: string): boolean {
  return GameCodeSchema.safeParse(code).success;
}
