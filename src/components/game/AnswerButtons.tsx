'use client';

import { cn } from '@/lib/utils';
import { Question } from '@/types';

interface AnswerButtonsProps {
  question: Question;
  selectedAnswer: 'A' | 'B' | 'C' | 'D' | null;
  onSelect: (answer: 'A' | 'B' | 'C' | 'D') => void;
  disabled?: boolean;
  submitted?: boolean;
  showCorrect?: boolean;
  className?: string;
}

const answerOptions = ['A', 'B', 'C', 'D'] as const;

const answerColors = {
  A: 'answer-btn-a',
  B: 'answer-btn-b',
  C: 'answer-btn-c',
  D: 'answer-btn-d',
};

const answerLabels = {
  A: 'answerA',
  B: 'answerB',
  C: 'answerC',
  D: 'answerD',
} as const;

export function AnswerButtons({
  question,
  selectedAnswer,
  onSelect,
  disabled = false,
  submitted = false,
  showCorrect = false,
  className,
}: AnswerButtonsProps) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-4', className)}>
      {answerOptions.map((option) => {
        const isSelected = selectedAnswer === option;
        const isCorrect = showCorrect && question.correctAnswer === option;
        const isWrong = showCorrect && isSelected && !isCorrect;
        
        return (
          <button
            key={option}
            onClick={() => onSelect(option)}
            disabled={disabled || submitted}
            className={cn(
              'answer-btn',
              answerColors[option],
              isSelected && 'answer-btn-selected',
              isCorrect && 'ring-4 ring-green-400',
              isWrong && 'ring-4 ring-red-400 opacity-70',
              submitted && !isSelected && 'opacity-50',
            )}
          >
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">
                {option}
              </span>
              <span className="text-lg font-medium leading-snug">
                {question[answerLabels[option]]}
              </span>
            </div>
            
            {isSelected && submitted && (
              <div className="absolute top-3 right-3">
                <span className="text-2xl">
                  {showCorrect ? (isCorrect ? '✓' : '✗') : '🔒'}
                </span>
              </div>
            )}
            
            {isCorrect && showCorrect && !isSelected && (
              <div className="absolute top-3 right-3">
                <span className="text-2xl">✓</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Simple answer display for presenter view
interface AnswerDisplayProps {
  question: Question;
  revealAnswer?: boolean;
  className?: string;
}

export function AnswerDisplay({ question, revealAnswer = false, className }: AnswerDisplayProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-4', className)}>
      {answerOptions.map((option) => {
        const isCorrect = revealAnswer && question.correctAnswer === option;
        
        return (
          <div
            key={option}
            className={cn(
              'p-4 rounded-xl',
              answerColors[option].replace('answer-btn-', 'bg-game-'),
              'bg-opacity-90 text-white',
              isCorrect && 'ring-4 ring-white'
            )}
          >
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
                {option}
              </span>
              <span className="font-medium">
                {question[answerLabels[option]]}
              </span>
              {isCorrect && (
                <span className="ml-auto text-xl">✓</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
