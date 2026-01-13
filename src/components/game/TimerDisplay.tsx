'use client';

import { cn } from '@/lib/utils';
import { useTimer } from '@/hooks/useTimer';
import { TimerState } from '@/types';

interface TimerDisplayProps {
  timerState: TimerState | null;
  size?: 'sm' | 'md' | 'lg';
  showPhase?: boolean;
  className?: string;
}

export function TimerDisplay({ 
  timerState, 
  size = 'lg', 
  showPhase = true,
  className 
}: TimerDisplayProps) {
  const { remainingSeconds, progress, phase, formattedTime } = useTimer(timerState);
  
  const sizeClasses = {
    sm: 'w-16 h-16 text-xl',
    md: 'w-20 h-20 text-2xl',
    lg: 'w-24 h-24 text-3xl',
  };
  
  const getBackgroundColor = () => {
    if (phase === 'paused') return 'from-yellow-500 to-yellow-600';
    if (phase === 'reading') return 'from-purple-500 to-purple-600';
    if (remainingSeconds <= 5) return 'from-red-500 to-red-600';
    if (remainingSeconds <= 10) return 'from-orange-500 to-orange-600';
    return 'from-green-500 to-green-600';
  };
  
  const phaseLabels = {
    waiting: 'Waiting',
    reading: 'Get Ready',
    answering: 'Answer Now',
    paused: 'Paused',
    ended: 'Time Up',
  };
  
  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div 
        className={cn(
          'relative rounded-full flex items-center justify-center shadow-2xl transition-all duration-300',
          'bg-gradient-to-br',
          sizeClasses[size],
          getBackgroundColor(),
          remainingSeconds <= 5 && phase === 'answering' && 'animate-timer-pulse'
        )}
      >
        {/* Progress ring */}
        <svg 
          className="absolute inset-0 w-full h-full -rotate-90"
          viewBox="0 0 100 100"
        >
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="4"
          />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="rgba(255,255,255,0.8)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${progress * 289} 289`}
            className="transition-all duration-100"
          />
        </svg>
        
        <span className="font-bold text-white z-10">
          {phase === 'paused' ? '⏸' : formattedTime}
        </span>
      </div>
      
      {showPhase && (
        <span className={cn(
          'text-sm font-medium px-3 py-1 rounded-full',
          phase === 'paused' && 'bg-yellow-100 text-yellow-800',
          phase === 'reading' && 'bg-purple-100 text-purple-800',
          phase === 'answering' && 'bg-green-100 text-green-800',
          phase === 'ended' && 'bg-red-100 text-red-800',
          phase === 'waiting' && 'bg-gray-100 text-gray-800',
        )}>
          {phaseLabels[phase]}
        </span>
      )}
    </div>
  );
}
