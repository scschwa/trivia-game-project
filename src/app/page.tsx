'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Gamepad2, Users, Trophy, Settings } from 'lucide-react';

// Separate component that uses useSearchParams
function JoinGameForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [gameCode, setGameCode] = useState('');
  const [error, setError] = useState('');
  
  // Auto-fill from QR code
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      setGameCode(code.toUpperCase());
    }
  }, [searchParams]);
  
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const normalizedCode = gameCode.toUpperCase().trim();
    if (normalizedCode.length !== 6) {
      setError('Game code must be 6 characters');
      return;
    }
    
    router.push(`/play/${normalizedCode}`);
  };

  return (
    <form onSubmit={handleJoin} className="space-y-4">
      <div>
        <label htmlFor="gameCode" className="label">
          Enter Game Code
        </label>
        <input
          type="text"
          id="gameCode"
          value={gameCode}
          onChange={(e) => setGameCode(e.target.value.toUpperCase())}
          placeholder="ABCDEF"
          maxLength={6}
          className="input-field text-center text-2xl font-mono tracking-widest uppercase"
          autoComplete="off"
        />
        {error && (
          <p className="text-red-500 text-sm mt-1">{error}</p>
        )}
      </div>
      
      <button type="submit" className="btn-primary w-full">
        Join Game
      </button>
    </form>
  );
}

export default function HomePage() {
    <div className="min-h-screen bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <Gamepad2 className="w-12 h-12 text-white" />
            <h1 className="text-4xl md:text-5xl font-bold text-white">
              Trivia Game
            </h1>
          </div>
          <p className="text-xl text-white/80">
            Host and play live trivia games with friends!
          </p>
        </header>
        
        {/* Main Content */}
        <div className="max-w-md mx-auto">
          {/* Join Game Card */}
          <div className="card mb-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Users className="w-6 h-6 text-primary-500" />
              Join a Game
            </h2>
            
            <Suspense fallback={<div className="text-center py-4">Loading...</div>}>
              <JoinGameForm />
            </Suspense>
          </div>
          
          {/* Host Options */}
          <div className="card animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Settings className="w-6 h-6 text-purple-500" />
              Host a Game
            </h2>
            
            <div className="space-y-3">
              <Link 
                href="/host/create" 
                className="block btn-secondary text-center"
              >
                Create New Trivia Config
              </Link>
              
              <Link 
                href="/host/start" 
                className="block btn-primary text-center"
              >
                Start a Game Session
              </Link>
            </div>
          </div>
          
          {/* Scoreboard Link */}
          <div className="text-center mt-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <Link 
              href="/scoreboard" 
              className="inline-flex items-center gap-2 text-white hover:text-white/80 transition-colors"
            >
              <Trophy className="w-5 h-5" />
              <span>View Past Games & Scoreboard</span>
            </Link>
          </div>
        </div>
        
        {/* Features */}
        <div className="max-w-4xl mx-auto mt-16 grid md:grid-cols-3 gap-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-white text-center">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              🎯
            </div>
            <h3 className="font-bold mb-2">Real-time Play</h3>
            <p className="text-white/80 text-sm">
              Live timer synchronization and instant updates for all players
            </p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-white text-center">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              📊
            </div>
            <h3 className="font-bold mb-2">Live Leaderboards</h3>
            <p className="text-white/80 text-sm">
              Track scores round by round with beautiful visualizations
            </p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-white text-center">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              📱
            </div>
            <h3 className="font-bold mb-2">Easy to Join</h3>
            <p className="text-white/80 text-sm">
              Scan a QR code or enter a simple 6-character code
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
