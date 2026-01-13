/**
 * CSV Parsing and Validation Utilities
 */

import Papa from 'papaparse';
import { CSVRowSchema, REQUIRED_CSV_COLUMNS } from '@/lib/validation/schemas';
import { Question, CSVValidationError, CSVValidationResult } from '@/types';

interface ParsedCSVRow {
  [key: string]: string | undefined;
}

/**
 * Parse and validate a CSV file for trivia questions
 */
export function parseAndValidateCSV(csvContent: string): CSVValidationResult {
  const errors: CSVValidationError[] = [];
  const questions: Question[] = [];
  
  // Parse CSV
  const parseResult = Papa.parse<ParsedCSVRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });
  
  // Check for parse errors
  if (parseResult.errors.length > 0) {
    parseResult.errors.forEach((error) => {
      errors.push({
        row: error.row ?? 0,
        column: 'CSV',
        value: '',
        message: error.message,
      });
    });
  }
  
  const rows = parseResult.data;
  
  if (rows.length === 0) {
    errors.push({
      row: 0,
      column: 'CSV',
      value: '',
      message: 'CSV file is empty or has no data rows',
    });
    return { valid: false, errors, questions: [], totalRounds: 0, totalQuestions: 0 };
  }
  
  // Check for required columns
  const headers = parseResult.meta.fields || [];
  const normalizedHeaders = headers.map((h) => h.toLowerCase());
  
  for (const requiredCol of REQUIRED_CSV_COLUMNS) {
    if (!normalizedHeaders.includes(requiredCol.toLowerCase())) {
      errors.push({
        row: 0,
        column: requiredCol,
        value: '',
        message: `Missing required column: ${requiredCol}`,
      });
    }
  }
  
  if (errors.length > 0) {
    return { valid: false, errors, questions: [], totalRounds: 0, totalQuestions: 0 };
  }
  
  // Create a mapping from lowercase to actual header names
  const headerMap: Record<string, string> = {};
  headers.forEach((h) => {
    headerMap[h.toLowerCase()] = h;
  });
  
  // Validate each row
  const roundQuestionTracker = new Map<string, number>(); // Track round-question combinations
  
  rows.forEach((row, index) => {
    const rowNumber = index + 2; // +2 because of 0-indexing and header row
    
    // Normalize row keys to match expected schema
    const normalizedRow: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const lowerKey = key.toLowerCase();
      // Map to expected camelCase keys
      if (lowerKey === 'roundnumber') normalizedRow.roundNumber = value;
      else if (lowerKey === 'questionnumber') normalizedRow.questionNumber = value;
      else if (lowerKey === 'question') normalizedRow.question = value;
      else if (lowerKey === 'answera') normalizedRow.answerA = value;
      else if (lowerKey === 'answerb') normalizedRow.answerB = value;
      else if (lowerKey === 'answerc') normalizedRow.answerC = value;
      else if (lowerKey === 'answerd') normalizedRow.answerD = value;
      else if (lowerKey === 'correctanswer') normalizedRow.correctAnswer = value;
      else if (lowerKey === 'points') normalizedRow.points = value || 1;
    }
    
    // Validate with Zod
    const result = CSVRowSchema.safeParse(normalizedRow);
    
    if (!result.success) {
      result.error.errors.forEach((zodError) => {
        const path = zodError.path.join('.');
        errors.push({
          row: rowNumber,
          column: path || 'unknown',
          value: String(normalizedRow[path] ?? ''),
          message: zodError.message,
        });
      });
    } else {
      const question = result.data;
      
      // Check for duplicate round-question combinations
      const key = `${question.roundNumber}-${question.questionNumber}`;
      if (roundQuestionTracker.has(key)) {
        errors.push({
          row: rowNumber,
          column: 'roundNumber/questionNumber',
          value: key,
          message: `Duplicate: Round ${question.roundNumber}, Question ${question.questionNumber} appears on rows ${roundQuestionTracker.get(key)} and ${rowNumber}`,
        });
      } else {
        roundQuestionTracker.set(key, rowNumber);
        questions.push({
          round: question.roundNumber,
          roundNumber: question.roundNumber,
          questionNumber: question.questionNumber,
          question: question.question,
          optionA: question.answerA,
          optionB: question.answerB,
          optionC: question.answerC,
          optionD: question.answerD,
          answerA: question.answerA,
          answerB: question.answerB,
          answerC: question.answerC,
          answerD: question.answerD,
          correctAnswer: question.correctAnswer as 'A' | 'B' | 'C' | 'D',
          points: question.points ?? 10,
          timeSeconds: 30,
        });
      }
    }
  });
  
  // Sort questions by round and question number
  questions.sort((a, b) => {
    if (a.round !== b.round) {
      return a.round - b.round;
    }
    return a.questionNumber - b.questionNumber;
  });
  
  // Validate question numbering within rounds
  const roundMap = new Map<number, number[]>();
  questions.forEach((q) => {
    if (!roundMap.has(q.round)) {
      roundMap.set(q.round, []);
    }
    roundMap.get(q.round)!.push(q.questionNumber);
  });
  
  roundMap.forEach((questionNumbers, roundNumber) => {
    const sorted = [...questionNumbers].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== i + 1) {
        errors.push({
          row: 0,
          column: 'questionNumber',
          value: String(sorted[i]),
          message: `Round ${roundNumber}: Question numbers must be sequential starting from 1. Found gap or missing number.`,
        });
        break;
      }
    }
  });
  
  // Check round numbering
  const rounds = Array.from(roundMap.keys()).sort((a, b) => a - b);
  for (let i = 0; i < rounds.length; i++) {
    if (rounds[i] !== i + 1) {
      errors.push({
        row: 0,
        column: 'roundNumber',
        value: String(rounds[i]),
        message: `Round numbers must be sequential starting from 1. Found gap or missing round.`,
      });
      break;
    }
  }
  
  const totalRounds = rounds.length;
  const totalQuestions = questions.length;
  
  return {
    valid: errors.length === 0,
    errors,
    questions,
    totalRounds,
    totalQuestions,
  };
}

/**
 * Get questions for a specific round
 */
export function getQuestionsForRound(questions: Question[], roundNumber: number): Question[] {
  return questions.filter((q) => q.round === roundNumber);
}

/**
 * Get a specific question
 */
export function getQuestion(
  questions: Question[],
  roundNumber: number,
  questionNumber: number
): Question | undefined {
  return questions.find(
    (q) => q.round === roundNumber && q.questionNumber === questionNumber
  );
}

/**
 * Count questions per round
 */
export function countQuestionsPerRound(questions: Question[]): Map<number, number> {
  const counts = new Map<number, number>();
  questions.forEach((q) => {
    counts.set(q.round, (counts.get(q.round) || 0) + 1);
  });
  return counts;
}
