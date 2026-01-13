/**
 * Utility functions
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calculate rankings with ties (1st, 1st, 3rd style)
 */
export function calculateRankings<T extends { score: number }>(
  items: T[]
): (T & { rank: number })[] {
  // Sort by score descending
  const sorted = [...items].sort((a, b) => b.score - a.score);
  
  let currentRank = 1;
  let previousScore: number | null = null;
  let skipCount = 0;
  
  return sorted.map((item, index) => {
    if (previousScore !== null && item.score < previousScore) {
      currentRank += skipCount + 1;
      skipCount = 0;
    } else if (previousScore !== null && item.score === previousScore) {
      skipCount++;
    }
    
    previousScore = item.score;
    
    return {
      ...item,
      rank: currentRank,
    };
  });
}

/**
 * Format rank with suffix (1st, 2nd, 3rd, 4th, etc.)
 */
export function formatRank(rank: number): string {
  const lastDigit = rank % 10;
  const lastTwoDigits = rank % 100;
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return `${rank}th`;
  }
  
  switch (lastDigit) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}

/**
 * Get answer text from letter
 */
export function getAnswerText(
  question: { answerA: string; answerB: string; answerC: string; answerD: string },
  letter: 'A' | 'B' | 'C' | 'D'
): string {
  const answers = {
    A: question.answerA,
    B: question.answerB,
    C: question.answerC,
    D: question.answerD,
  };
  return answers[letter];
}

/**
 * Format answer for display (e.g., "C. Paris")
 */
export function formatAnswer(
  question: { answerA: string; answerB: string; answerC: string; answerD: string },
  letter: 'A' | 'B' | 'C' | 'D'
): string {
  return `${letter}. ${getAnswerText(question, letter)}`;
}

/**
 * Delay utility for async operations
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Generate a random color for teams
 */
export function getTeamColor(index: number): string {
  const colors = [
    'bg-red-500',
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-cyan-500',
  ];
  return colors[index % colors.length];
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) {
    return diffDays === 1 ? 'yesterday' : `${diffDays} days ago`;
  }
  if (diffHours > 0) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }
  if (diffMins > 0) {
    return diffMins === 1 ? '1 minute ago' : `${diffMins} minutes ago`;
  }
  return 'just now';
}
