import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Trophy, ArrowLeft, Medal, Target, Clock, Users } from 'lucide-react';
import { getGameResult } from '@/actions/game';
import { Leaderboard } from '@/components/game/Leaderboard';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { gameId: string };
}

export default async function GameResultPage({ params }: PageProps) {
  const result = await getGameResult(params.gameId);
  
  if (!result) {
    notFound();
  }
  
  const { game, leaderboard, stats } = result;
  const winner = leaderboard[0];
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
      {/* Header */}
      <div className="bg-black/20 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/scoreboard"
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{game.configName}</h1>
            <p className="text-white/60 text-sm">
              Game code: <span className="font-mono">{game.gameCode}</span> •{' '}
              {new Date(game.endedAt!).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Winner Spotlight */}
        {winner && (
          <div className="text-center mb-12">
            <div className="inline-block">
              <div className="bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400 p-1 rounded-2xl">
                <div className="bg-gray-900 rounded-xl p-8">
                  <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                  <h2 className="text-4xl font-bold text-white mb-2">🏆 Winner 🏆</h2>
                  <p className="text-3xl font-bold text-yellow-400">{winner.name}</p>
                  <p className="text-2xl text-white/80 mt-2">{winner.totalScore} points</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 text-center">
            <Users className="w-8 h-8 text-primary-400 mx-auto mb-2" />
            <p className="text-3xl font-bold text-white">{stats.totalTeams}</p>
            <p className="text-white/60">Teams Played</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 text-center">
            <Target className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-3xl font-bold text-white">{stats.totalQuestions}</p>
            <p className="text-white/60">Questions</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 text-center">
            <Medal className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <p className="text-3xl font-bold text-white">{stats.totalCorrect}</p>
            <p className="text-white/60">Correct Answers</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 text-center">
            <Clock className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <p className="text-3xl font-bold text-white">{stats.avgResponseTime}s</p>
            <p className="text-white/60">Avg Response Time</p>
          </div>
        </div>
        
        {/* Full Leaderboard */}
        <div className="bg-white/10 backdrop-blur rounded-2xl p-6">
          <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            Final Standings
          </h3>
          
          <Leaderboard entries={leaderboard} showChart />
        </div>
        
        {/* Round-by-Round Breakdown */}
        {stats.roundBreakdown && stats.roundBreakdown.length > 0 && (
          <div className="mt-8 bg-white/10 backdrop-blur rounded-2xl p-6">
            <h3 className="text-2xl font-bold text-white mb-6">Round Breakdown</h3>
            
            <div className="space-y-4">
              {stats.roundBreakdown.map((round, index) => (
                <div key={index} className="bg-white/5 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-bold text-white">Round {index + 1}</h4>
                    <span className="text-white/60 text-sm">
                      {round.questions} questions
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-green-400">{round.correctRate}%</p>
                      <p className="text-xs text-white/60">Correct Rate</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary-400">{round.avgScore}</p>
                      <p className="text-xs text-white/60">Round Score</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-yellow-400">{round.topScorer}</p>
                      <p className="text-xs text-white/60">Top Scorer</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/scoreboard" className="btn-secondary text-center">
            ← View All Games
          </Link>
          <Link href="/host/start" className="btn-primary text-center">
            Start New Game
          </Link>
        </div>
      </div>
    </div>
  );
}
