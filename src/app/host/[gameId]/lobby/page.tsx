'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play, Users, CheckCircle, Clock } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { getGameSession } from '@/actions/game';
import { QRCodeDisplay } from '@/components/ui/QRCodeDisplay';
import { GameState } from '@/types';

export default function HostLobbyPage() {
  const router = useRouter();
  const params = useParams();
  const gameSessionId = params.gameId as string;
  
  const [hostPin, setHostPin] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Get stored PIN
  useEffect(() => {
    const storedPin = sessionStorage.getItem(`hostPin_${gameSessionId}`);
    if (storedPin) {
      setHostPin(storedPin);
    }
  }, [gameSessionId]);
  
  // Socket handlers
  const socketHandlers = {
    onHostJoinSuccess: (data: { gameState: GameState }) => {
      setGameState(data.gameState);
      setIsConnected(true);
      setError('');
    },
    onHostJoinError: (data: { message: string }) => {
      setError(data.message);
    },
    onTeamJoined: (data: { teamId: string; teamName: string; joinOrder: number }) => {
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          teams: [...prev.teams, {
            id: data.teamId,
            name: data.teamName,
            totalScore: 0,
            rank: prev.teams.length + 1,
            roundScores: {},
            isConnected: true,
          }],
        };
      });
    },
    onTeamReady: (data: { teamId: string }) => {
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          teams: prev.teams.map((t) =>
            t.id === data.teamId ? { ...t, isReady: true } : t
          ) as typeof prev.teams,
        };
      });
    },
    onTeamRenamed: (data: { teamId: string; newName: string }) => {
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          teams: prev.teams.map((t) =>
            t.id === data.teamId ? { ...t, name: data.newName } : t
          ),
        };
      });
    },
    onTeamLeft: (data: { teamId: string }) => {
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          teams: prev.teams.map((t) =>
            t.id === data.teamId ? { ...t, isConnected: false } : t
          ),
        };
      });
    },
    onGameStarted: (data: { gameState: GameState }) => {
      router.push(`/host/${gameSessionId}/presenter`);
    },
    onError: (data: { message: string }) => {
      setError(data.message);
    },
  };
  
  const { hostJoin, startGame, isConnected: socketConnected } = useSocket(socketHandlers);
  
  // Load game session and connect
  useEffect(() => {
    const load = async () => {
      const session = await getGameSession(gameSessionId);
      if (!session) {
        setError('Game session not found');
        setIsLoading(false);
        return;
      }
      
      if (session.status !== 'LOBBY') {
        router.push(`/host/${gameSessionId}/presenter`);
        return;
      }
      
      setIsLoading(false);
    };
    
    load();
  }, [gameSessionId, router]);
  
  // Connect as host when socket is ready
  useEffect(() => {
    if (socketConnected && hostPin && !isConnected) {
      hostJoin(gameSessionId, hostPin);
    }
  }, [socketConnected, hostPin, isConnected, gameSessionId, hostJoin]);
  
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (socketConnected && hostPin) {
      hostJoin(gameSessionId, hostPin);
    }
  };
  
  const handleStartGame = () => {
    if (!gameState) return;
    
    const readyTeams = (gameState.teams as Array<{ id: string; isReady?: boolean }>).filter((t) => t.isReady);
    if (readyTeams.length === 0) {
      setError('At least one team must be ready');
      return;
    }
    
    startGame(gameSessionId);
  };
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const readyCount = gameState 
    ? (gameState.teams as Array<{ id: string; isReady?: boolean }>).filter((t) => t.isReady).length 
    : 0;
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  // PIN entry if not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Host Authentication</h1>
          
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <label htmlFor="pin" className="label">Enter Host PIN</label>
              <input
                type="password"
                id="pin"
                value={hostPin}
                onChange={(e) => setHostPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="••••"
                className="input-field text-center text-2xl tracking-widest"
                inputMode="numeric"
              />
            </div>
            
            {error && <p className="text-red-500 text-sm">{error}</p>}
            
            <button type="submit" className="btn-primary w-full" disabled={!socketConnected}>
              {socketConnected ? 'Connect as Host' : 'Connecting...'}
            </button>
          </form>
          
          <Link href="/" className="block text-center mt-4 text-gray-500 hover:text-gray-700">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6 text-white" />
            </Link>
            <div className="text-white">
              <h1 className="text-3xl font-bold">Game Lobby</h1>
              <p className="text-white/80">Waiting for teams to join...</p>
            </div>
          </div>
          
          <button
            onClick={handleStartGame}
            disabled={readyCount === 0}
            className="btn-primary bg-white text-primary-600 hover:bg-gray-100 disabled:bg-white/50 disabled:text-primary-400"
          >
            <Play className="w-5 h-5 mr-2 inline" />
            Start Game ({readyCount} ready)
          </button>
        </div>
        
        {error && (
          <div className="bg-red-500/20 border border-red-300 text-white px-4 py-2 rounded-lg mb-6">
            {error}
          </div>
        )}
        
        <div className="grid lg:grid-cols-3 gap-8">
          {/* QR Code */}
          <div className="card flex flex-col items-center justify-center">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Join the Game
            </h2>
            
            {gameState && (
              <QRCodeDisplay
                url={appUrl}
                gameCode={gameState.gameCode}
                size={200}
              />
            )}
          </div>
          
          {/* Teams List */}
          <div className="lg:col-span-2 card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Teams ({gameState?.teams.length || 0})
              </h2>
              <span className="text-sm text-gray-500">
                {readyCount} of {gameState?.teams.length || 0} ready
              </span>
            </div>
            
            {gameState?.teams.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4 animate-pulse" />
                <p className="text-gray-500">Waiting for teams to join...</p>
                <p className="text-sm text-gray-400 mt-2">
                  Teams can scan the QR code or enter the game code
                </p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {gameState?.teams.map((team, index) => {
                  const teamWithReady = team as typeof team & { isReady?: boolean };
                  return (
                    <div
                      key={team.id}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        teamWithReady.isReady
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 bg-white'
                      } ${!team.isConnected ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                            ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500'][index % 6]
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">{team.name}</p>
                            <p className="text-xs text-gray-500">
                              {!team.isConnected ? 'Disconnected' : teamWithReady.isReady ? 'Ready!' : 'Choosing name...'}
                            </p>
                          </div>
                        </div>
                        
                        {teamWithReady.isReady && (
                          <CheckCircle className="w-6 h-6 text-green-500" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
