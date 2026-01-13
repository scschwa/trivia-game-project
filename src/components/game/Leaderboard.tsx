'use client';

import { cn, formatRank } from '@/lib/utils';
import { LeaderboardEntry } from '@/types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  highlightTeamId?: string;
  showChart?: boolean;
  className?: string;
}

const CHART_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

export function Leaderboard({ 
  entries, 
  highlightTeamId, 
  showChart = true,
  className 
}: LeaderboardProps) {
  // Sort entries by rank
  const sortedEntries = [...entries].sort((a, b) => a.rank - b.rank);
  
  // Prepare chart data
  const chartData = sortedEntries.map((entry, index) => ({
    name: entry.name,
    score: entry.totalScore,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));
  
  const getRankClass = (rank: number) => {
    if (rank === 1) return 'leaderboard-rank-1';
    if (rank === 2) return 'leaderboard-rank-2';
    if (rank === 3) return 'leaderboard-rank-3';
    return 'leaderboard-rank-other';
  };
  
  return (
    <div className={cn('space-y-6', className)}>
      {/* Horizontal Bar Chart */}
      {showChart && sortedEntries.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Score Comparison</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, sortedEntries.length * 50)}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <XAxis type="number" />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={90}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                formatter={(value: number) => [`${value} points`, 'Score']}
                contentStyle={{ 
                  borderRadius: '8px', 
                  border: 'none', 
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)' 
                }}
              />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      
      {/* Leaderboard List */}
      <div className="space-y-2">
        {sortedEntries.map((entry, index) => (
          <div
            key={entry.id}
            className={cn(
              'leaderboard-row',
              highlightTeamId === entry.id 
                ? 'bg-primary-50 border-2 border-primary-300' 
                : 'bg-gray-50',
              'hover:bg-gray-100 transition-colors'
            )}
          >
            <div className={cn('leaderboard-rank', getRankClass(entry.rank))}>
              {entry.rank}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900 truncate">
                {entry.name}
              </div>
              <div className="text-sm text-gray-500">
                {formatRank(entry.rank)} place
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                {entry.totalScore}
              </div>
              <div className="text-sm text-gray-500">points</div>
            </div>
          </div>
        ))}
        
        {sortedEntries.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No teams have scored yet
          </div>
        )}
      </div>
    </div>
  );
}

// Compact leaderboard for sidebar/small displays
interface CompactLeaderboardProps {
  entries: LeaderboardEntry[];
  maxEntries?: number;
  className?: string;
}

export function CompactLeaderboard({ 
  entries, 
  maxEntries = 5,
  className 
}: CompactLeaderboardProps) {
  const sortedEntries = [...entries]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, maxEntries);
  
  return (
    <div className={cn('space-y-2', className)}>
      {sortedEntries.map((entry, index) => (
        <div
          key={entry.teamId}
          className="flex items-center gap-3 text-sm"
        >
          <span className={cn(
            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
            entry.rank === 1 && 'bg-yellow-400 text-yellow-900',
            entry.rank === 2 && 'bg-gray-300 text-gray-700',
            entry.rank === 3 && 'bg-amber-600 text-white',
            entry.rank > 3 && 'bg-gray-200 text-gray-600',
          )}>
            {entry.rank}
          </span>
          <span className="flex-1 truncate font-medium">{entry.teamName}</span>
          <span className="font-bold">{entry.totalScore}</span>
        </div>
      ))}
    </div>
  );
}
