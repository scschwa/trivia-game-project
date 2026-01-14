/**
 * Socket.IO Server for Trivia Game
 * Handles real-time communication between host and teams
 */

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import prisma from './db';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  GameStatus,
  Question,
} from './types';
import {
  startGameTimers,
  stopGameTimers,
  scheduleAutoAdvance,
  scheduleAnsweringStart,
  cancelScheduledEvents,
  calculateTimerState,
  buildGameState,
  buildLeaderboard,
} from './timer-manager';

const app = express();
const httpServer = createServer(app);

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
const port = process.env.PORT || 3001;

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize Socket.IO
const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Rate limiting per socket
const socketRateLimits = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 1000; // 1 second
const RATE_LIMIT_MAX = 10; // 10 events per second

function checkRateLimit(socketId: string): boolean {
  const now = Date.now();
  const timestamps = socketRateLimits.get(socketId) || [];
  
  // Remove old timestamps
  const recentTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
  
  if (recentTimestamps.length >= RATE_LIMIT_MAX) {
    return false;
  }
  
  recentTimestamps.push(now);
  socketRateLimits.set(socketId, recentTimestamps);
  return true;
}

// Socket connection handler
io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.emit('CONNECTED', { socketId: socket.id });
  
  // ==================== Team Events ====================
  
  socket.on('JOIN_GAME', async ({ gameCode, reconnectToken }) => {
    if (!checkRateLimit(socket.id)) {
      socket.emit('ERROR', { message: 'Rate limit exceeded', code: 'RATE_LIMIT' });
      return;
    }
    
    try {
      const normalizedCode = gameCode.toUpperCase();
      
      // Find game session
      const session = await prisma.gameSession.findUnique({
        where: { gameCode: normalizedCode },
        include: { teams: { orderBy: { joinOrder: 'asc' } } },
      });
      
      if (!session) {
        socket.emit('JOIN_ERROR', { message: 'Game not found' });
        return;
      }
      
      if (session.status !== 'LOBBY') {
        socket.emit('JOIN_ERROR', { message: 'Game has already started' });
        return;
      }
      
      // Check for reconnection
      if (reconnectToken) {
        const existingTeam = await prisma.team.findUnique({
          where: { reconnectToken },
        });
        
        if (existingTeam && existingTeam.gameSessionId === session.id) {
          // Reconnect existing team
          await prisma.team.update({
            where: { id: existingTeam.id },
            data: { isConnected: true, lastSeenAt: new Date() },
          });
          
          socket.data.teamId = existingTeam.id;
          socket.data.gameSessionId = session.id;
          socket.data.reconnectToken = reconnectToken;
          
          socket.join(`game:${normalizedCode}`);
          socket.join(`team:${existingTeam.id}`);
          
          const gameState = await buildGameState(session.id);
          
          socket.emit('RECONNECT_SUCCESS', {
            teamId: existingTeam.id,
            teamName: existingTeam.name,
            isReady: existingTeam.isReady,
            gameState: gameState!,
          });
          
          io.to(`game:${normalizedCode}`).emit('TEAM_JOINED', {
            teamId: existingTeam.id,
            teamName: existingTeam.name,
            joinOrder: existingTeam.joinOrder,
          });
          
          return;
        }
      }
      
      // Create new team
      const joinOrder = session.teams.length + 1;
      const teamName = `Team ${joinOrder}`;
      const newReconnectToken = randomBytes(32).toString('base64url');
      
      const team = await prisma.team.create({
        data: {
          gameSessionId: session.id,
          name: teamName,
          joinOrder,
          reconnectToken: newReconnectToken,
          isConnected: true,
        },
      });
      
      socket.data.teamId = team.id;
      socket.data.gameSessionId = session.id;
      socket.data.reconnectToken = newReconnectToken;
      
      socket.join(`game:${normalizedCode}`);
      socket.join(`team:${team.id}`);
      
      const gameState = await buildGameState(session.id);
      
      socket.emit('JOIN_SUCCESS', {
        teamId: team.id,
        teamName: team.name,
        reconnectToken: newReconnectToken,
        gameState: gameState!,
      });
      
      // Notify others
      socket.to(`game:${normalizedCode}`).emit('TEAM_JOINED', {
        teamId: team.id,
        teamName: team.name,
        joinOrder: team.joinOrder,
      });
      
    } catch (error) {
      console.error('JOIN_GAME error:', error);
      socket.emit('JOIN_ERROR', { message: 'Failed to join game' });
    }
  });
  
  socket.on('TEAM_RENAME', async ({ teamId, newName }) => {
    if (!checkRateLimit(socket.id)) return;
    
    try {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { gameSession: true },
      });
      
      if (!team) {
        socket.emit('ERROR', { message: 'Team not found' });
        return;
      }
      
      if (team.isReady) {
        socket.emit('ERROR', { message: 'Cannot rename after marking ready' });
        return;
      }
      
      // Check for duplicate names
      const existingTeam = await prisma.team.findFirst({
        where: {
          gameSessionId: team.gameSessionId,
          name: newName,
          NOT: { id: teamId },
        },
      });
      
      if (existingTeam) {
        socket.emit('ERROR', { message: 'Team name already taken' });
        return;
      }
      
      await prisma.team.update({
        where: { id: teamId },
        data: { name: newName },
      });
      
      io.to(`game:${team.gameSession.gameCode}`).emit('TEAM_RENAMED', {
        teamId,
        newName,
      });
      
    } catch (error) {
      console.error('TEAM_RENAME error:', error);
      socket.emit('ERROR', { message: 'Failed to rename team' });
    }
  });
  
  socket.on('TEAM_READY', async ({ teamId }) => {
    if (!checkRateLimit(socket.id)) return;
    
    try {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { gameSession: true },
      });
      
      if (!team) {
        socket.emit('ERROR', { message: 'Team not found' });
        return;
      }
      
      await prisma.team.update({
        where: { id: teamId },
        data: { isReady: true },
      });
      
      io.to(`game:${team.gameSession.gameCode}`).emit('TEAM_READY', { teamId });
      
    } catch (error) {
      console.error('TEAM_READY error:', error);
      socket.emit('ERROR', { message: 'Failed to set ready status' });
    }
  });
  
  socket.on('SUBMIT_ANSWER', async ({ teamId, roundNumber, questionNumber, selectedAnswer, responseTimeMs }) => {
    if (!checkRateLimit(socket.id)) return;
    
    try {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { gameSession: true },
      });
      
      if (!team) {
        socket.emit('ANSWER_ERROR', { message: 'Team not found' });
        return;
      }
      
      const session = team.gameSession;
      
      // Validate game state
      if (session.status !== 'ANSWERING') {
        socket.emit('ANSWER_ERROR', { message: 'Not accepting answers right now' });
        return;
      }
      
      if (session.currentRound !== roundNumber || session.currentQuestion !== questionNumber) {
        socket.emit('ANSWER_ERROR', { message: 'Question has changed' });
        return;
      }
      
      // Check if already answered (immutability)
      const existingAnswer = await prisma.answer.findUnique({
        where: {
          teamId_gameSessionId_roundNumber_questionNumber: {
            teamId,
            gameSessionId: session.id,
            roundNumber,
            questionNumber,
          },
        },
      });
      
      if (existingAnswer) {
        socket.emit('ANSWER_ERROR', { message: 'Already submitted an answer' });
        return;
      }
      
      // Create answer
      await prisma.answer.create({
        data: {
          teamId,
          gameSessionId: session.id,
          roundNumber,
          questionNumber,
          selectedAnswer,
          responseTimeMs,
        },
      });
      
      socket.emit('ANSWER_CONFIRMED', {
        teamId,
        roundNumber,
        questionNumber,
        selectedAnswer,
      });
      
      // Notify host that team submitted
      io.to(`host:${session.id}`).emit('ANSWER_SUBMITTED', {
        teamId,
        roundNumber,
        questionNumber,
      });
      
    } catch (error) {
      console.error('SUBMIT_ANSWER error:', error);
      socket.emit('ANSWER_ERROR', { message: 'Failed to submit answer' });
    }
  });
  
  // ==================== Host Events ====================
  
  socket.on('HOST_JOIN', async ({ gameSessionId, hostPin }) => {
    if (!checkRateLimit(socket.id)) return;
    
    try {
      const session = await prisma.gameSession.findUnique({
        where: { id: gameSessionId },
      });
      
      if (!session) {
        socket.emit('HOST_JOIN_ERROR', { message: 'Game not found' });
        return;
      }
      
      // Verify host PIN
      const pinValid = await bcrypt.compare(hostPin, session.hostPinHash);
      if (!pinValid) {
        socket.emit('HOST_JOIN_ERROR', { message: 'Invalid host PIN' });
        return;
      }
      
      socket.data.gameSessionId = gameSessionId;
      socket.data.isHost = true;
      
      socket.join(`game:${session.gameCode}`);
      socket.join(`host:${session.id}`);
      
      const gameState = await buildGameState(session.id);
      socket.emit('HOST_JOIN_SUCCESS', { gameState: gameState! });
      
    } catch (error) {
      console.error('HOST_JOIN error:', error instanceof Error ? error.message : error);
      console.error('HOST_JOIN stack:', error instanceof Error ? error.stack : 'No stack');
      socket.emit('HOST_JOIN_ERROR', { message: 'Failed to join as host' });
    }
  });
  
  socket.on('HOST_START_GAME', async ({ gameSessionId }) => {
    if (!socket.data.isHost || socket.data.gameSessionId !== gameSessionId) {
      socket.emit('ERROR', { message: 'Not authorized' });
      return;
    }
    
    try {
      const session = await prisma.gameSession.findUnique({
        where: { id: gameSessionId },
        include: { teams: true, triviaConfig: true },
      });
      
      if (!session) {
        socket.emit('ERROR', { message: 'Game not found' });
        return;
      }
      
      if (session.status !== 'LOBBY') {
        socket.emit('ERROR', { message: 'Game has already started' });
        return;
      }
      
      const readyTeams = session.teams.filter((t) => t.isReady);
      if (readyTeams.length === 0) {
        socket.emit('ERROR', { message: 'At least one team must be ready' });
        return;
      }
      
      const questions: Question[] = JSON.parse(session.triviaConfig.questionsJson);
      const firstQuestion = questions.find((q) => q.roundNumber === 1 && q.questionNumber === 1);
      
      if (!firstQuestion) {
        socket.emit('ERROR', { message: 'No questions found' });
        return;
      }
      
      const now = Date.now();
      const readingDelayMs = session.readingDelayMs;
      const answeringTimeMs = session.answeringTimeMs;
      
      // Update session to start game
      await prisma.gameSession.update({
        where: { id: gameSessionId },
        data: {
          status: 'READING_DELAY',
          currentRound: 1,
          currentQuestion: 1,
          questionRevealedAt: BigInt(now),
          answeringStartsAt: BigInt(now + readingDelayMs),
          questionEndsAt: BigInt(now + readingDelayMs + answeringTimeMs),
        },
      });
      
      // Start timer management
      startGameTimers(io, gameSessionId, session.gameCode);
      
      // Schedule transition to answering
      scheduleAnsweringStart(io, gameSessionId, session.gameCode, readingDelayMs);
      
      // Schedule auto-advance
      scheduleAutoAdvance(
        io,
        gameSessionId,
        session.gameCode,
        readingDelayMs + answeringTimeMs,
        async () => {
          await handleQuestionEnd(gameSessionId, session.gameCode);
        }
      );
      
      const gameState = await buildGameState(gameSessionId);
      const timerState = calculateTimerState({
        status: 'READING_DELAY',
        questionRevealedAt: BigInt(now),
        answeringStartsAt: BigInt(now + readingDelayMs),
        questionEndsAt: BigInt(now + readingDelayMs + answeringTimeMs),
        pausedAt: null,
        remainingTimeOnPause: null,
        readingDelayMs,
        answeringTimeMs,
      });
      
      io.to(`game:${session.gameCode}`).emit('GAME_STARTED', { gameState: gameState! });
      io.to(`game:${session.gameCode}`).emit('QUESTION_REVEALED', {
        roundNumber: 1,
        questionNumber: 1,
        question: firstQuestion,
        timer: timerState,
      });
      
    } catch (error) {
      console.error('HOST_START_GAME error:', error);
      socket.emit('ERROR', { message: 'Failed to start game' });
    }
  });
  
  socket.on('HOST_NEXT_QUESTION', async ({ gameSessionId }) => {
    if (!socket.data.isHost || socket.data.gameSessionId !== gameSessionId) {
      socket.emit('ERROR', { message: 'Not authorized' });
      return;
    }
    
    try {
      await advanceToNextQuestion(gameSessionId);
    } catch (error) {
      console.error('HOST_NEXT_QUESTION error:', error);
      socket.emit('ERROR', { message: 'Failed to advance question' });
    }
  });
  
  socket.on('HOST_PAUSE', async ({ gameSessionId }) => {
    if (!socket.data.isHost || socket.data.gameSessionId !== gameSessionId) {
      socket.emit('ERROR', { message: 'Not authorized' });
      return;
    }
    
    try {
      const session = await prisma.gameSession.findUnique({
        where: { id: gameSessionId },
      });
      
      if (!session || session.pausedAt !== null) {
        socket.emit('ERROR', { message: 'Cannot pause' });
        return;
      }
      
      const now = Date.now();
      const questionEndsAt = session.questionEndsAt ? Number(session.questionEndsAt) : now;
      const remainingMs = Math.max(0, questionEndsAt - now);
      
      await prisma.gameSession.update({
        where: { id: gameSessionId },
        data: {
          status: 'PAUSED',
          pausedAt: BigInt(now),
          remainingTimeOnPause: remainingMs,
        },
      });
      
      // Cancel scheduled events
      cancelScheduledEvents(gameSessionId);
      
      io.to(`game:${session.gameCode}`).emit('GAME_PAUSED', {
        pausedAt: now,
        remainingMs,
      });
      
    } catch (error) {
      console.error('HOST_PAUSE error:', error);
      socket.emit('ERROR', { message: 'Failed to pause game' });
    }
  });
  
  socket.on('HOST_RESUME', async ({ gameSessionId }) => {
    if (!socket.data.isHost || socket.data.gameSessionId !== gameSessionId) {
      socket.emit('ERROR', { message: 'Not authorized' });
      return;
    }
    
    try {
      const session = await prisma.gameSession.findUnique({
        where: { id: gameSessionId },
      });
      
      if (!session || session.pausedAt === null) {
        socket.emit('ERROR', { message: 'Game is not paused' });
        return;
      }
      
      const now = Date.now();
      const pausedAt = Number(session.pausedAt);
      const pauseDuration = now - pausedAt;
      const remainingMs = session.remainingTimeOnPause || 0;
      
      // Determine if we were in reading or answering phase
      const answeringStartsAt = session.answeringStartsAt ? Number(session.answeringStartsAt) : null;
      const wasInReadingDelay = answeringStartsAt && pausedAt < answeringStartsAt;
      
      let newStatus: string;
      let newAnsweringStartsAt: bigint | null = null;
      let newQuestionEndsAt: bigint;
      
      if (wasInReadingDelay) {
        // Resume in reading delay
        newStatus = 'READING_DELAY';
        const readingRemaining = answeringStartsAt - pausedAt;
        newAnsweringStartsAt = BigInt(now + readingRemaining);
        newQuestionEndsAt = BigInt(now + readingRemaining + session.answeringTimeMs);
        
        // Reschedule answering start
        scheduleAnsweringStart(io, gameSessionId, session.gameCode, readingRemaining);
        scheduleAutoAdvance(
          io,
          gameSessionId,
          session.gameCode,
          readingRemaining + session.answeringTimeMs,
          async () => {
            await handleQuestionEnd(gameSessionId, session.gameCode);
          }
        );
      } else {
        // Resume in answering
        newStatus = 'ANSWERING';
        newQuestionEndsAt = BigInt(now + remainingMs);
        
        // Reschedule auto-advance
        scheduleAutoAdvance(
          io,
          gameSessionId,
          session.gameCode,
          remainingMs,
          async () => {
            await handleQuestionEnd(gameSessionId, session.gameCode);
          }
        );
      }
      
      const updateData: Record<string, unknown> = {
        status: newStatus,
        pausedAt: null,
        remainingTimeOnPause: null,
        questionEndsAt: newQuestionEndsAt,
      };
      
      if (newAnsweringStartsAt !== null) {
        updateData.answeringStartsAt = newAnsweringStartsAt;
      }
      
      const updatedSession = await prisma.gameSession.update({
        where: { id: gameSessionId },
        data: updateData,
      });
      
      const timerState = calculateTimerState({
        ...updatedSession,
        answeringStartsAt: newAnsweringStartsAt || session.answeringStartsAt,
      });
      
      io.to(`game:${session.gameCode}`).emit('GAME_RESUMED', { timer: timerState });
      
    } catch (error) {
      console.error('HOST_RESUME error:', error);
      socket.emit('ERROR', { message: 'Failed to resume game' });
    }
  });
  
  socket.on('HOST_SCORE_ROUND', async ({ gameSessionId, roundNumber }) => {
    if (!socket.data.isHost || socket.data.gameSessionId !== gameSessionId) {
      socket.emit('ERROR', { message: 'Not authorized' });
      return;
    }
    
    try {
      const session = await prisma.gameSession.findUnique({
        where: { id: gameSessionId },
        include: {
          teams: true,
          answers: { where: { roundNumber } },
          triviaConfig: true,
        },
      });
      
      if (!session) {
        socket.emit('ERROR', { message: 'Game not found' });
        return;
      }
      
      const questions: Question[] = JSON.parse(session.triviaConfig.questionsJson);
      const roundQuestions = questions.filter((q) => q.roundNumber === roundNumber);
      
      // Build correct answers map
      const correctAnswers: Record<number, { correct: 'A' | 'B' | 'C' | 'D'; points: number }> = {};
      roundQuestions.forEach((q) => {
        correctAnswers[q.questionNumber] = {
          correct: q.correctAnswer,
          points: q.points,
        };
      });
      
      // Score each team
      const teamScores: Array<{
        teamId: string;
        teamName: string;
        roundScore: number;
        totalScore: number;
        answersCorrect: number;
        answersTotal: number;
      }> = [];
      
      for (const team of session.teams) {
        const teamAnswers = session.answers.filter((a) => a.teamId === team.id);
        let roundScore = 0;
        let answersCorrect = 0;
        
        for (const answer of teamAnswers) {
          const correctData = correctAnswers[answer.questionNumber];
          const isCorrect = answer.selectedAnswer === correctData?.correct;
          const points = isCorrect ? correctData.points : 0;
          
          if (isCorrect) {
            answersCorrect++;
            roundScore += points;
          }
          
          // Update answer record
          await prisma.answer.update({
            where: { id: answer.id },
            data: { isCorrect, pointsAwarded: points },
          });
        }
        
        // Update team scores
        const currentRoundScores = JSON.parse(team.roundScoresJson || '{}');
        currentRoundScores[roundNumber] = roundScore;
        
        const newTotalScore = team.totalScore + roundScore;
        
        await prisma.team.update({
          where: { id: team.id },
          data: {
            totalScore: newTotalScore,
            roundScoresJson: JSON.stringify(currentRoundScores),
          },
        });
        
        teamScores.push({
          teamId: team.id,
          teamName: team.name,
          roundScore,
          totalScore: newTotalScore,
          answersCorrect,
          answersTotal: roundQuestions.length,
        });
      }
      
      // Update session status
      const totalRounds = session.triviaConfig.totalRounds;
      const isLastRound = roundNumber >= totalRounds;
      
      await prisma.gameSession.update({
        where: { id: gameSessionId },
        data: {
          status: isLastRound ? 'FINISHED' : 'ROUND_SCORED',
          completedAt: isLastRound ? new Date() : null,
        },
      });
      
      if (isLastRound) {
        stopGameTimers(gameSessionId);
      }
      
      // Get updated teams for leaderboard
      const updatedTeams = await prisma.team.findMany({
        where: { gameSessionId },
      });
      
      const leaderboard = buildLeaderboard(updatedTeams);
      const gameState = await buildGameState(gameSessionId);
      
      io.to(`game:${session.gameCode}`).emit('ROUND_SCORED', {
        roundNumber,
        roundIndex: roundNumber - 1,
        correctAnswers,
        teamScores,
        leaderboard,
        gameState: gameState ?? undefined,
      });
      
      if (isLastRound) {
        io.to(`game:${session.gameCode}`).emit('GAME_FINISHED', {
          finalLeaderboard: leaderboard,
          gameSessionId,
          gameState: gameState ?? undefined,
        });
      }
      
    } catch (error) {
      console.error('HOST_SCORE_ROUND error:', error);
      socket.emit('ERROR', { message: 'Failed to score round' });
    }
  });
  
  // ==================== Reconnection ====================
  
  socket.on('RECONNECT', async ({ reconnectToken }) => {
    if (!checkRateLimit(socket.id)) return;
    
    try {
      const team = await prisma.team.findUnique({
        where: { reconnectToken },
        include: { gameSession: true },
      });
      
      if (!team) {
        socket.emit('RECONNECT_ERROR', { message: 'Invalid reconnect token' });
        return;
      }
      
      await prisma.team.update({
        where: { id: team.id },
        data: { isConnected: true, lastSeenAt: new Date() },
      });
      
      socket.data.teamId = team.id;
      socket.data.gameSessionId = team.gameSessionId;
      socket.data.reconnectToken = reconnectToken;
      
      socket.join(`game:${team.gameSession.gameCode}`);
      socket.join(`team:${team.id}`);
      
      const gameState = await buildGameState(team.gameSessionId);
      
      socket.emit('RECONNECT_SUCCESS', {
        teamId: team.id,
        teamName: team.name,
        gameState: gameState!,
      });
      
    } catch (error) {
      console.error('RECONNECT error:', error);
      socket.emit('RECONNECT_ERROR', { message: 'Reconnection failed' });
    }
  });
  
  socket.on('REQUEST_STATE', async ({ gameCode }) => {
    if (!checkRateLimit(socket.id)) return;
    
    try {
      const session = await prisma.gameSession.findUnique({
        where: { gameCode: gameCode.toUpperCase() },
      });
      
      if (!session) {
        socket.emit('ERROR', { message: 'Game not found' });
        return;
      }
      
      const gameState = await buildGameState(session.id);
      socket.emit('GAME_STATE', gameState!);
      
    } catch (error) {
      console.error('REQUEST_STATE error:', error);
    }
  });
  
  // ==================== Disconnect ====================
  
  socket.on('disconnect', async () => {
    console.log(`Socket disconnected: ${socket.id}`);
    socketRateLimits.delete(socket.id);
    
    if (socket.data.teamId) {
      try {
        await prisma.team.update({
          where: { id: socket.data.teamId },
          data: { isConnected: false, lastSeenAt: new Date() },
        });
        
        if (socket.data.gameSessionId) {
          const session = await prisma.gameSession.findUnique({
            where: { id: socket.data.gameSessionId },
          });
          
          if (session) {
            io.to(`game:${session.gameCode}`).emit('TEAM_LEFT', {
              teamId: socket.data.teamId,
            });
          }
        }
      } catch (error) {
        console.error('Disconnect cleanup error:', error);
      }
    }
  });
});

// ==================== Helper Functions ====================

async function handleQuestionEnd(gameSessionId: string, gameCode: string) {
  const session = await prisma.gameSession.findUnique({
    where: { id: gameSessionId },
    include: { triviaConfig: true },
  });
  
  if (!session) return;
  
  const questions: Question[] = JSON.parse(session.triviaConfig.questionsJson);
  const roundQuestions = questions.filter((q) => q.roundNumber === session.currentRound);
  
  io.to(`game:${gameCode}`).emit('QUESTION_ENDED', {
    roundNumber: session.currentRound,
    questionNumber: session.currentQuestion,
  });
  
  // Check if this is the last question in the round
  if (session.currentQuestion >= roundQuestions.length) {
    // Don't auto-advance after last question - wait for host to score
    return;
  }
  
  // Auto-advance to next question
  await advanceToNextQuestion(gameSessionId);
}

async function advanceToNextQuestion(gameSessionId: string) {
  const session = await prisma.gameSession.findUnique({
    where: { id: gameSessionId },
    include: { triviaConfig: true },
  });
  
  if (!session) return;
  
  const questions: Question[] = JSON.parse(session.triviaConfig.questionsJson);
  const roundQuestions = questions.filter((q) => q.roundNumber === session.currentRound);
  
  let nextRound = session.currentRound;
  let nextQuestion = session.currentQuestion + 1;
  
  // If we've completed the round, move to next round
  if (nextQuestion > roundQuestions.length) {
    nextRound++;
    nextQuestion = 1;
  }
  
  // Check if game is complete
  if (nextRound > session.triviaConfig.totalRounds) {
    await prisma.gameSession.update({
      where: { id: gameSessionId },
      data: { status: 'FINISHED', completedAt: new Date() },
    });
    stopGameTimers(gameSessionId);
    return;
  }
  
  const nextQuestionData = questions.find(
    (q) => q.roundNumber === nextRound && q.questionNumber === nextQuestion
  );
  
  if (!nextQuestionData) return;
  
  const now = Date.now();
  const readingDelayMs = session.readingDelayMs;
  const answeringTimeMs = session.answeringTimeMs;
  
  await prisma.gameSession.update({
    where: { id: gameSessionId },
    data: {
      status: 'READING_DELAY',
      currentRound: nextRound,
      currentQuestion: nextQuestion,
      questionRevealedAt: BigInt(now),
      answeringStartsAt: BigInt(now + readingDelayMs),
      questionEndsAt: BigInt(now + readingDelayMs + answeringTimeMs),
      pausedAt: null,
      remainingTimeOnPause: null,
    },
  });
  
  // Schedule transitions
  scheduleAnsweringStart(io, gameSessionId, session.gameCode, readingDelayMs);
  scheduleAutoAdvance(
    io,
    gameSessionId,
    session.gameCode,
    readingDelayMs + answeringTimeMs,
    async () => {
      await handleQuestionEnd(gameSessionId, session.gameCode);
    }
  );
  
  const timerState = calculateTimerState({
    status: 'READING_DELAY',
    questionRevealedAt: BigInt(now),
    answeringStartsAt: BigInt(now + readingDelayMs),
    questionEndsAt: BigInt(now + readingDelayMs + answeringTimeMs),
    pausedAt: null,
    remainingTimeOnPause: null,
    readingDelayMs,
    answeringTimeMs,
  });
  
  io.to(`game:${session.gameCode}`).emit('QUESTION_REVEALED', {
    roundNumber: nextRound,
    questionNumber: nextQuestion,
    question: nextQuestionData,
    timer: timerState,
  });
}

// Start server
httpServer.listen(port, () => {
  console.log(`🚀 Socket.IO server running on port ${port}`);
  console.log(`   CORS origin: ${corsOrigin}`);
});
