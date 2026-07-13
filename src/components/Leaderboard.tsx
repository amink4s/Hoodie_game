import React, { useEffect, useState } from "react";
import { LeaderboardEntry, Difficulty } from "../types";
import { Trophy, Calendar, Medal, RefreshCw, Star, Play } from "lucide-react";

interface LeaderboardProps {
  onPlayAgain: () => void;
  currentDifficulty: Difficulty;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ onPlayAgain, currentDifficulty }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [filter, setFilter] = useState<"all" | Difficulty>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/leaderboard");
      if (!response.ok) {
        throw new Error("Failed to fetch global scores.");
      }
      const data = await response.json();
      setEntries(data);
    } catch (err) {
      console.error("Leaderboard fetch error:", err);
      setError("Unable to connect to the global leaderboards. Showing local backup.");
      
      // Load fallback from localStorage if server is offline
      const localBackup = localStorage.getItem("arrow_local_scores");
      if (localBackup) {
        try {
          setEntries(JSON.parse(localBackup));
        } catch {
          setEntries([]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const getFilteredEntries = () => {
    if (filter === "all") return entries;
    return entries.filter((entry) => entry.difficulty === filter);
  };

  const filtered = getFilteredEntries();

  // Color mappings for difficulty badges
  const difficultyColors = {
    easy: "bg-brand-dim/10 text-brand-dim border-brand-dim/20",
    medium: "bg-brand-accent/10 text-brand-accent border-brand-accent/20",
    hard: "bg-brand-accent/20 text-brand-accent border-brand-accent/40",
    champion: "bg-brand-danger/10 text-brand-danger border-brand-danger/20",
  };

  return (
    <div className="w-full flex flex-col bg-brand-surface border border-white/10 rounded-xl overflow-hidden font-sans shadow-xl">
      {/* Leaderboard Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40">
        <div className="flex items-center gap-2.5">
          <Trophy className="w-5 h-5 text-brand-accent animate-bounce" />
          <h2 className="text-lg font-bold text-brand-accent font-serif tracking-tight">
            Hoodie Hall of Fame
          </h2>
        </div>
        
        <button
          onClick={fetchLeaderboard}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-brand-dim hover:text-brand-text border border-white/10 hover:border-white/20 bg-black/60 rounded-lg transition-all cursor-pointer"
          disabled={loading}
          id="btn-refresh-leaderboard"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-brand-accent" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Leaderboard Body */}
      <div className="flex-grow min-h-[300px] overflow-y-auto px-6 py-4 max-h-[450px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <RefreshCw className="w-8 h-8 text-brand-accent animate-spin" />
            <p className="text-sm text-brand-dim font-mono">Gathering marksmen scrolls...</p>
          </div>
        ) : error && filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 px-4">
            <div className="w-12 h-12 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-brand-dim">
              ?
            </div>
            <p className="text-sm text-brand-dim font-medium">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
            <Trophy className="w-8 h-8 text-brand-dim" />
            <p className="text-sm text-brand-dim">No marks registered yet.</p>
            <p className="text-xs text-brand-dim/80">Be the first to leave your legacy!</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[400px]">
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-mono tracking-wider text-brand-dim uppercase">
                  <th className="py-2.5 px-3 font-semibold text-center w-12">RANK</th>
                  <th className="py-2.5 px-4 font-semibold">MARKSMAN</th>
                  <th className="py-2.5 px-4 font-semibold text-right">ACCURACY</th>
                  <th className="py-2.5 px-4 font-semibold text-right">SCORE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {filtered.map((entry, index) => {
                  const rank = index + 1;
                  
                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-white/5 transition-colors group"
                    >
                      {/* Rank Indicator */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center">
                          {rank === 1 ? (
                            <Medal className="w-5 h-5 text-brand-accent" />
                          ) : rank === 2 ? (
                            <Medal className="w-5 h-5 text-slate-300" />
                          ) : rank === 3 ? (
                            <Medal className="w-5 h-5 text-amber-700" />
                          ) : (
                            <span className="text-xs font-mono font-medium text-brand-dim">
                              {rank}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Marksman Name */}
                      <td className="py-3 px-4 font-medium text-brand-text">
                        <span className="group-hover:text-brand-accent transition-colors">
                          {entry.name}
                        </span>
                      </td>

                      {/* Accuracy */}
                      <td className="py-3 px-4 text-right font-mono text-xs text-brand-dim">
                        {entry.accuracy}%
                      </td>

                      {/* Score */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-brand-accent group-hover:scale-105 origin-right transition-transform">
                        {entry.score.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Footer Button */}
      <div className="px-6 py-4 border-t border-white/10 bg-black/20 flex items-center justify-between shrink-0">
        <span className="text-xs text-brand-dim">
          * Shows top 50 recorded marksmen runs.
        </span>
        <button
          onClick={onPlayAgain}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-accent hover:bg-amber-500 text-brand-bg font-semibold text-xs rounded-lg shadow-lg shadow-brand-accent/5 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          id="btn-play-from-leaderboard"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          PLAY AGAIN
        </button>
      </div>
    </div>
  );
};
export default Leaderboard;
