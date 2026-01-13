import Link from 'next/link';
import { Trophy, Calendar, Users, ArrowRight } from 'lucide-react';
import { getCompletedGames } from '@/actions/game';

export const dynamic = 'force-dynamic';

export default async function ScoreboardPage() {
  const games = await getCompletedGames();
  
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4 flex items-center justify-center gap-3">
            <Trophy className="w-10 h-10 text-yellow-500" />
            Past Games
          </h1>
          <p className="text-gray-600">View results from completed trivia games</p>
        </div>
        
        {games.length === 0 ? (
          <div className="card text-center py-12">
            <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No completed games yet</h3>
            <p className="text-gray-500 mb-6">
              Games will appear here once they're finished
            </p>
            <Link href="/host/start" className="btn-primary inline-block">
              Start a New Game
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {games.map((game) => (
              <Link
                key={game.id}
                href={`/scoreboard/${game.id}`}
                className="card block hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      {game.configName}
                    </h3>
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(game.endedAt!).toLocaleDateString(undefined, {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {game.teamCount} teams
                      </span>
                      <span className="font-mono text-gray-400">
                        Code: {game.gameCode}
                      </span>
                    </div>
                  </div>
                  
                  {game.winner && (
                    <div className="text-right mr-4">
                      <p className="text-sm text-gray-500">Winner</p>
                      <p className="text-lg font-bold text-yellow-600 flex items-center gap-2">
                        🏆 {game.winner.name}
                      </p>
                      <p className="text-sm text-gray-500">{game.winner.score} pts</p>
                    </div>
                  )}
                  
                  <ArrowRight className="w-6 h-6 text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
        
        <div className="mt-8 text-center">
          <Link href="/" className="text-primary-600 hover:text-primary-700">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
