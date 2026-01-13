'use client';

import { cn } from '@/lib/utils';

interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
  colorClass?: string;
  className?: string;
}

export function ProgressBar({ 
  current, 
  total, 
  label, 
  colorClass = 'from-primary-400 to-primary-600',
  className 
}: ProgressBarProps) {
  const progress = total > 0 ? (current / total) * 100 : 0;
  
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="text-sm text-gray-500">{current} / {total}</span>
        </div>
      )}
      <div className="progress-bar">
        <div 
          className={cn('progress-fill bg-gradient-to-r', colorClass)}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

interface RoundProgressProps {
  currentRound: number;
  totalRounds: number;
  currentQuestion: number;
  questionsInRound: number;
  className?: string;
}

export function RoundProgress({
  currentRound,
  totalRounds,
  currentQuestion,
  questionsInRound,
  className,
}: RoundProgressProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <ProgressBar
        current={currentRound}
        total={totalRounds}
        label={`Round ${currentRound} of ${totalRounds}`}
        colorClass="from-purple-400 to-purple-600"
      />
      <ProgressBar
        current={currentQuestion}
        total={questionsInRound}
        label={`Question ${currentQuestion} of ${questionsInRound}`}
        colorClass="from-blue-400 to-blue-600"
      />
    </div>
  );
}
