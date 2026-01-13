'use client';

/**
 * Timer Hook - Calculates remaining time from server timestamp
 */

import { useState, useEffect, useCallback } from 'react';
import { TimerState } from '@/types';

interface UseTimerReturn {
  remainingMs: number;
  remainingSeconds: number;
  remainingTime: number; // Alias for remainingSeconds (for backwards compatibility)
  progress: number; // 0 to 1
  phase: TimerState['phase'];
  isExpired: boolean;
  isRunning: boolean; // True if timer is actively counting down
  formattedTime: string;
}

export function useTimer(timerState: TimerState | null): UseTimerReturn {
  const [remainingMs, setRemainingMs] = useState(0);
  
  useEffect(() => {
    if (!timerState) {
      setRemainingMs(0);
      return;
    }
    
    if (timerState.phase === 'paused' || timerState.phase === 'waiting' || timerState.phase === 'ended') {
      setRemainingMs(timerState.remainingMs);
      return;
    }
    
    // For active timers, calculate from endsAt
    const updateRemaining = () => {
      if (timerState.endsAt) {
        const remaining = Math.max(0, timerState.endsAt - Date.now());
        setRemainingMs(remaining);
      } else {
        setRemainingMs(timerState.remainingMs);
      }
    };
    
    updateRemaining();
    const interval = setInterval(updateRemaining, 100);
    
    return () => clearInterval(interval);
  }, [timerState]);
  
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const totalMs = timerState?.totalMs || 1;
  const progress = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const phase = timerState?.phase || 'waiting';
  const isExpired = remainingMs <= 0 && phase !== 'waiting';
  const isRunning = phase === 'reading' || phase === 'answering';
  
  // Format time as seconds or MM:SS
  const formatTime = useCallback((ms: number): string => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}`;
  }, []);
  
  return {
    remainingMs,
    remainingSeconds,
    remainingTime: remainingSeconds, // Alias
    progress,
    phase,
    isExpired,
    isRunning,
    formattedTime: formatTime(remainingMs),
  };
}
