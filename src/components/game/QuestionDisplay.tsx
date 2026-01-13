'use client';

import { cn } from '@/lib/utils';
import { Question } from '@/types';

interface QuestionDisplayProps {
  question: Question;
  roundNumber: number;
  questionNumber: number;
  showAnswer?: boolean;
  className?: string;
}

export function QuestionDisplay({
  question,
  roundNumber,
  questionNumber,
  showAnswer = false,
  className,
}: QuestionDisplayProps) {
  return (
    <div className={cn('question-card', className)}>
      <div className="flex items-center gap-3 mb-4">
        <span className="px-3 py-1 bg-purple-500/30 rounded-full text-sm font-medium">
          Round {roundNumber}
        </span>
        <span className="px-3 py-1 bg-blue-500/30 rounded-full text-sm font-medium">
          Question {questionNumber}
        </span>
        {question.points > 1 && (
          <span className="px-3 py-1 bg-yellow-500/30 rounded-full text-sm font-medium">
            {question.points} points
          </span>
        )}
      </div>
      
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-8">
        {question.question}
      </h2>
      
      <div className="grid grid-cols-2 gap-4">
        {(['A', 'B', 'C', 'D'] as const).map((letter) => {
          const answerKey = `answer${letter}` as keyof Question;
          const isCorrect = showAnswer && question.correctAnswer === letter;
          
          return (
            <div
              key={letter}
              className={cn(
                'p-6 rounded-xl transition-all duration-300',
                letter === 'A' && 'bg-game-a',
                letter === 'B' && 'bg-game-b',
                letter === 'C' && 'bg-game-c',
                letter === 'D' && 'bg-game-d',
                isCorrect && 'ring-4 ring-white scale-105',
              )}
            >
              <div className="flex items-start gap-4">
                <span className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">
                  {letter}
                </span>
                <span className="text-xl font-medium">
                  {question[answerKey] as string}
                </span>
                {isCorrect && (
                  <span className="ml-auto text-2xl">✓</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Smaller question card for team view
interface QuestionCardProps {
  question: Question;
  className?: string;
}

export function QuestionCard({ question, className }: QuestionCardProps) {
  return (
    <div className={cn('bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white', className)}>
      <p className="text-xl md:text-2xl font-semibold leading-relaxed">
        {question.question}
      </p>
      {question.points > 1 && (
        <div className="mt-4">
          <span className="px-3 py-1 bg-yellow-500/30 rounded-full text-sm font-medium">
            Worth {question.points} points
          </span>
        </div>
      )}
    </div>
  );
}
