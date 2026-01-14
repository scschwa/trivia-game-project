'use client';

/**
 * Socket.IO Client Hook
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@/lib/socket/events';
import { GameState, TimerState, Question, RoundScoringResult, LeaderboardEntry } from '@/types';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseSocketReturn {
  socket: TypedSocket | null;
  isConnected: boolean;
  // Team actions
  joinGame: (gameCode: string, reconnectToken?: string) => void;
  setTeamReady: (teamId: string) => void;
  renameTeam: (teamId: string, newName: string) => void;
  submitAnswer: (data: {
    teamId: string;
    roundNumber: number;
    questionNumber: number;
    selectedAnswer: 'A' | 'B' | 'C' | 'D';
    responseTimeMs: number;
  }) => void;
  reconnect: (reconnectToken: string) => void;
  // Host actions
  hostJoin: (gameSessionId: string, hostPin: string) => void;
  startGame: (gameSessionId: string) => void;
  nextQuestion: (gameSessionId: string) => void;
  pauseGame: (gameSessionId: string) => void;
  resumeGame: (gameSessionId: string) => void;
  scoreRound: (gameSessionId: string, roundNumber: number) => void;
  // State request
  requestState: (gameCode: string) => void;
}

interface SocketEventHandlers {
  onJoinSuccess?: (data: { teamId: string; teamName: string; reconnectToken: string; gameState: GameState }) => void;
  onJoinError?: (data: { message: string }) => void;
  onHostJoinSuccess?: (data: { gameState: GameState }) => void;
  onHostJoinError?: (data: { message: string }) => void;
  onReconnectSuccess?: (data: { teamId: string; teamName: string; gameState: GameState }) => void;
  onReconnectError?: (data: { message: string }) => void;
  onGameState?: (data: GameState) => void;
  onTeamJoined?: (data: { teamId: string; teamName: string; joinOrder: number }) => void;
  onTeamLeft?: (data: { teamId: string }) => void;
  onTeamReady?: (data: { teamId: string }) => void;
  onTeamRenamed?: (data: { teamId: string; newName: string }) => void;
  onGameStarted?: (data: { gameState: GameState }) => void;
  onQuestionRevealed?: (data: { roundNumber: number; questionNumber: number; question: Question; timer: TimerState }) => void;
  onTimerSync?: (data: TimerState) => void;
  onAnsweringStarted?: (data: { timer: TimerState }) => void;
  onQuestionEnded?: (data: { roundNumber: number; questionNumber: number }) => void;
  onAnswerConfirmed?: (data: { teamId: string; roundNumber: number; questionNumber: number; selectedAnswer: 'A' | 'B' | 'C' | 'D' }) => void;
  onAnswerError?: (data: { message: string }) => void;
  onAnswerReceived?: (data: { teamId: string }) => void;
  onGamePaused?: (data: { pausedAt: number; remainingMs: number }) => void;
  onGameResumed?: (data: { timer: TimerState }) => void;
  onRoundScored?: (data: RoundScoringResult) => void;
  onLeaderboardUpdate?: (data: { leaderboard: LeaderboardEntry[] }) => void;
  onGameFinished?: (data: { finalLeaderboard: LeaderboardEntry[]; gameSessionId: string; gameState?: GameState }) => void;
  onError?: (data: { message: string; code?: string }) => void;
}

export function useSocket(handlers: SocketEventHandlers = {}): UseSocketReturn {
  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const handlersRef = useRef(handlers);
  
  // Update handlers ref when they change
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);
  
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    
    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    }) as TypedSocket;
    
    socketInstance.on('connect', () => {
      console.log('Socket connected:', socketInstance.id);
      setIsConnected(true);
    });
    
    socketInstance.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });
    
    // Set up event listeners
    socketInstance.on('JOIN_SUCCESS', (data) => handlersRef.current.onJoinSuccess?.(data));
    socketInstance.on('JOIN_ERROR', (data) => handlersRef.current.onJoinError?.(data));
    socketInstance.on('HOST_JOIN_SUCCESS', (data) => handlersRef.current.onHostJoinSuccess?.(data));
    socketInstance.on('HOST_JOIN_ERROR', (data) => handlersRef.current.onHostJoinError?.(data));
    socketInstance.on('RECONNECT_SUCCESS', (data) => handlersRef.current.onReconnectSuccess?.(data));
    socketInstance.on('RECONNECT_ERROR', (data) => handlersRef.current.onReconnectError?.(data));
    socketInstance.on('GAME_STATE', (data) => handlersRef.current.onGameState?.(data));
    socketInstance.on('TEAM_JOINED', (data) => handlersRef.current.onTeamJoined?.(data));
    socketInstance.on('TEAM_LEFT', (data) => handlersRef.current.onTeamLeft?.(data));
    socketInstance.on('TEAM_READY', (data) => handlersRef.current.onTeamReady?.(data));
    socketInstance.on('TEAM_RENAMED', (data) => handlersRef.current.onTeamRenamed?.(data));
    socketInstance.on('GAME_STARTED', (data) => handlersRef.current.onGameStarted?.(data));
    socketInstance.on('QUESTION_REVEALED', (data) => handlersRef.current.onQuestionRevealed?.(data));
    socketInstance.on('TIMER_SYNC', (data) => handlersRef.current.onTimerSync?.(data));
    socketInstance.on('ANSWERING_STARTED', (data) => handlersRef.current.onAnsweringStarted?.(data));
    socketInstance.on('QUESTION_ENDED', (data) => handlersRef.current.onQuestionEnded?.(data));
    socketInstance.on('ANSWER_CONFIRMED', (data) => handlersRef.current.onAnswerConfirmed?.(data));
    socketInstance.on('ANSWER_ERROR', (data) => handlersRef.current.onAnswerError?.(data));
    socketInstance.on('ANSWER_SUBMITTED', (data) => handlersRef.current.onAnswerReceived?.(data));
    socketInstance.on('GAME_PAUSED', (data) => handlersRef.current.onGamePaused?.(data));
    socketInstance.on('GAME_RESUMED', (data) => handlersRef.current.onGameResumed?.(data));
    socketInstance.on('ROUND_SCORED', (data) => handlersRef.current.onRoundScored?.(data));
    socketInstance.on('LEADERBOARD_UPDATE', (data) => handlersRef.current.onLeaderboardUpdate?.(data));
    socketInstance.on('GAME_FINISHED', (data) => handlersRef.current.onGameFinished?.(data));
    socketInstance.on('ERROR', (data) => handlersRef.current.onError?.(data));
    
    setSocket(socketInstance);
    
    return () => {
      socketInstance.disconnect();
    };
  }, []);
  
  // Team actions
  const joinGame = useCallback((gameCode: string, reconnectToken?: string) => {
    socket?.emit('JOIN_GAME', { gameCode, reconnectToken });
  }, [socket]);
  
  const setTeamReady = useCallback((teamId: string) => {
    socket?.emit('TEAM_READY', { teamId });
  }, [socket]);
  
  const renameTeam = useCallback((teamId: string, newName: string) => {
    socket?.emit('TEAM_RENAME', { teamId, newName });
  }, [socket]);
  
  const submitAnswer = useCallback((data: {
    teamId: string;
    roundNumber: number;
    questionNumber: number;
    selectedAnswer: 'A' | 'B' | 'C' | 'D';
    responseTimeMs: number;
  }) => {
    socket?.emit('SUBMIT_ANSWER', data);
  }, [socket]);
  
  const reconnect = useCallback((reconnectToken: string) => {
    socket?.emit('RECONNECT', { reconnectToken });
  }, [socket]);
  
  // Host actions
  const hostJoin = useCallback((gameSessionId: string, hostPin: string) => {
    socket?.emit('HOST_JOIN', { gameSessionId, hostPin });
  }, [socket]);
  
  const startGame = useCallback((gameSessionId: string) => {
    socket?.emit('HOST_START_GAME', { gameSessionId });
  }, [socket]);
  
  const nextQuestion = useCallback((gameSessionId: string) => {
    socket?.emit('HOST_NEXT_QUESTION', { gameSessionId });
  }, [socket]);
  
  const pauseGame = useCallback((gameSessionId: string) => {
    socket?.emit('HOST_PAUSE', { gameSessionId });
  }, [socket]);
  
  const resumeGame = useCallback((gameSessionId: string) => {
    socket?.emit('HOST_RESUME', { gameSessionId });
  }, [socket]);
  
  const scoreRound = useCallback((gameSessionId: string, roundNumber: number) => {
    socket?.emit('HOST_SCORE_ROUND', { gameSessionId, roundNumber });
  }, [socket]);
  
  const requestState = useCallback((gameCode: string) => {
    socket?.emit('REQUEST_STATE', { gameCode });
  }, [socket]);
  
  return {
    socket,
    isConnected,
    joinGame,
    setTeamReady,
    renameTeam,
    submitAnswer,
    reconnect,
    hostJoin,
    startGame,
    nextQuestion,
    pauseGame,
    resumeGame,
    scoreRound,
    requestState,
  };
}
