import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Difficulty, GameStats, LeaderboardEntry } from "./types";
import { GameCanvas } from "./components/GameCanvas";
import { Leaderboard } from "./components/Leaderboard";
import { DIFFICULTY_MODES, GAME_TIPS } from "./data";
import { audio } from "./components/AudioEngine";
import { 
  Trophy, 
  Target, 
  Zap, 
  Eye, 
  ChevronRight, 
  Award, 
  User, 
  RefreshCw, 
  ArrowRight, 
  Shield, 
  Compass,
  AlertCircle
} from "lucide-react";

export default function App() {
  // Game state router
  const [gameState, setGameState] = useState<"menu" | "playing" | "gameover" | "leaderboard">("menu");
  
  // Game settings
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("arrow_muted") === "true";
    }
    return false;
  });

  // Player stats from completed run
  const [finalStats, setFinalStats] = useState<GameStats | null>(null);
  
  // High score submission state
  const [playerName, setPlayerName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("arrow_player_name") || "";
    }
    return "";
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Tips cycler state
  const [tipIndex, setTipIndex] = useState(0);

  // Cycle tips every 6 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % GAME_TIPS.length);
    }, 6500);
    return () => clearInterval(interval);
  }, []);

  // Save mute preference
  const toggleMute = () => {
    setIsMuted((prev) => {
      const newVal = !prev;
      localStorage.setItem("arrow_muted", String(newVal));
      audio.toggle(!newVal);
      return newVal;
    });
  };

  // Setup initial audio on interaction
  useEffect(() => {
    audio.toggle(!isMuted);
  }, [isMuted]);

  // Handle Game Over transition from Canvas
  const handleGameOver = (stats: GameStats) => {
    setFinalStats(stats);
    setSubmitSuccess(false);
    setSubmitError(null);
    setGameState("gameover");
  };

  // Submit Score to full-stack Express API
  const handleSubmitScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setSubmitError("Please enter your name.");
      return;
    }
    if (!finalStats) return;

    setIsSubmitting(true);
    setSubmitError(null);

    // Save player name preference locally
    localStorage.setItem("arrow_player_name", playerName.trim());

    const payload = {
      name: playerName.trim(),
      score: finalStats.score,
      difficulty: finalStats.difficulty,
      accuracy: finalStats.accuracy,
      speedBonus: finalStats.speedBonusTotal
    };

    try {
      // 1. Submit to Live Global Server
      const res = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error("Server refused record ledger entry.");
      }

      // 2. Also register in local backup list in case server is down later
      const localBackup = localStorage.getItem("arrow_local_scores");
      let localScores: LeaderboardEntry[] = [];
      if (localBackup) {
        try {
          localScores = JSON.parse(localBackup);
        } catch {
          localScores = [];
        }
      }
      
      const newLocalEntry: LeaderboardEntry = {
        id: Date.now().toString(),
        name: playerName.trim(),
        score: finalStats.score,
        difficulty: finalStats.difficulty,
        accuracy: finalStats.accuracy,
        speedBonus: finalStats.speedBonusTotal,
        date: new Date().toISOString()
      };
      
      localScores.push(newLocalEntry);
      localScores.sort((a, b) => b.score - a.score);
      localStorage.setItem("arrow_local_scores", JSON.stringify(localScores.slice(0, 50)));

      setSubmitSuccess(true);
      // Wait slightly, then transition to leaderboard view
      setTimeout(() => {
        setGameState("leaderboard");
      }, 800);

    } catch (err) {
      console.error("Score submission failed:", err);
      setSubmitError("Unable to post to global board. Saving score locally instead.");
      
      // Fallback save only
      const localBackup = localStorage.getItem("arrow_local_scores");
      let localScores: LeaderboardEntry[] = [];
      if (localBackup) {
        try {
          localScores = JSON.parse(localBackup);
        } catch {
          localScores = [];
        }
      }
      const newLocalEntry = {
        id: Date.now().toString(),
        name: playerName.trim(),
        score: finalStats.score,
        difficulty: finalStats.difficulty,
        accuracy: finalStats.accuracy,
        speedBonus: finalStats.speedBonusTotal,
        date: new Date().toISOString()
      };
      localScores.push(newLocalEntry);
      localScores.sort((a, b) => b.score - a.score);
      localStorage.setItem("arrow_local_scores", JSON.stringify(localScores.slice(0, 50)));
      
      setSubmitSuccess(true);
      setTimeout(() => {
        setGameState("leaderboard");
      }, 1500);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col justify-between selection:bg-brand-accent selection:text-brand-bg">
      {/* Decorative Top Accent Light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-36 bg-brand-accent/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Modern High-contrast Header */}
      <header className="relative border-b border-white/10 bg-brand-surface/80 backdrop-blur-md px-6 py-4 shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-accent/10 border border-brand-accent/20 text-brand-accent">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-widest font-serif text-brand-accent uppercase">
                HOODIE
              </h1>
              <p className="text-[10px] text-brand-dim tracking-wider font-mono">
                PRECISION & TIMING SIMULATOR
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {gameState !== "menu" && (
              <button
                onClick={() => setGameState("menu")}
                className="text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors"
                id="btn-return-menu"
              >
                ← Return to Base
              </button>
            )}
            
            <span className="text-[10px] font-mono text-slate-500 hidden md:inline">
              REAL-TIME CONTAINER ACTIVE
            </span>
          </div>
        </div>
      </header>

      {/* Main Responsive Canvas & Card Area */}
      <main className="flex-grow max-w-6xl w-full mx-auto p-4 flex flex-col justify-center items-center relative z-10">
        <AnimatePresence mode="wait">
          
          {/* MENU DIVISION */}
          {gameState === "menu" && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-md bg-brand-surface border border-white/5 rounded-2xl p-8 flex flex-col items-center justify-between space-y-8 relative overflow-hidden shadow-2xl text-center"
            >
              {/* Visual Glow */}
              <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-brand-accent/5 blur-[80px] rounded-full pointer-events-none" />
              <div className="absolute -top-10 -right-10 w-44 h-44 bg-brand-accent/5 blur-[80px] rounded-full pointer-events-none" />

              <div className="space-y-4 flex flex-col items-center">
                {/* Hoodie Logo Avatar */}
                <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-brand-accent bg-brand-surface shadow-lg shadow-brand-accent/10">
                  <img 
                    src={audio.isEnabled() ? "/src/assets/images/shooter_wojak_1783886403762.jpg" : ""} 
                    alt="Hoodie" 
                    className="object-cover w-full h-full scale-105"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-tr from-amber-600 to-amber-500 flex items-center justify-center font-bold text-xl text-slate-950 tracking-wider">🏹</div>
                </div>

                <div className="space-y-1 mt-2">
                  <h2 className="text-4xl font-black tracking-tight text-brand-accent font-serif uppercase">
                    HOODIE
                  </h2>
                  <p className="text-xs font-mono text-brand-dim uppercase tracking-widest">
                    Precision timing game
                  </p>
                </div>

                <p className="text-sm text-brand-dim leading-relaxed font-sans max-w-sm">
                  Draw your bowstring, lock your gaze, and release to strike target concentric rings. Simple controls, infinite precision.
                </p>
              </div>

              {/* Action hub */}
              <div className="flex flex-col gap-3 w-full pt-2">
                <button
                  onClick={() => {
                    audio.playLevelUp();
                    setGameState("playing");
                  }}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-brand-accent hover:bg-amber-500 text-brand-bg font-bold tracking-wide rounded-xl shadow-lg hover:shadow-brand-accent/20 active:scale-95 transition-all cursor-pointer"
                  id="btn-enter-game"
                >
                  <span className="font-serif text-sm tracking-widest uppercase">ENTER ARROW ARENA</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    audio.playBowDraw();
                    setGameState("leaderboard");
                  }}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-transparent hover:bg-white/5 text-brand-text border border-white/10 rounded-xl transition-all cursor-pointer"
                  id="btn-view-board"
                >
                  <Trophy className="w-4 h-4 text-brand-accent" />
                  <span className="font-serif text-sm tracking-widest uppercase">Hall of Fame</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* PLAYING DIVISION */}
          {gameState === "playing" && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-4xl"
            >
              <GameCanvas
                difficulty={difficulty}
                isMuted={isMuted}
                onToggleMute={toggleMute}
                onGameOver={handleGameOver}
                isPlaying={true}
                onGameStart={() => {}}
              />
            </motion.div>
          )}

          {/* GAME OVER DIVISION */}
          {gameState === "gameover" && finalStats && (
            <motion.div
              key="gameover"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 25 }}
              className="w-full max-w-lg bg-brand-surface border border-white/5 rounded-2xl overflow-hidden shadow-2xl relative"
            >
              {/* Highlight Light */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-brand-accent/10 blur-[80px] rounded-full pointer-events-none" />

              <div className="p-6 text-center space-y-6">
                <div className="mx-auto w-12 h-12 rounded-full bg-brand-accent/10 border border-brand-accent/30 text-brand-accent flex items-center justify-center animate-pulse">
                  <Award className="w-6 h-6" />
                </div>

                <div className="space-y-1">
                  <h2 className="text-3xl font-black tracking-tight font-serif text-brand-accent">
                    TIME'S UP!
                  </h2>
                </div>

                {/* Score Big Display */}
                <div className="py-5 bg-black/60 border border-white/5 rounded-xl space-y-1 relative overflow-hidden">
                  <span className="text-xs text-brand-dim font-mono uppercase tracking-widest block">
                    TOTAL MARK
                  </span>
                  <span className="text-4xl font-black text-brand-accent tracking-tight font-mono">
                    {finalStats.score.toLocaleString()}
                  </span>
                </div>

                {/* Detailed Stats Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-black/20 border border-white/5 rounded-xl text-center space-y-1">
                    <span className="text-[9px] text-brand-dim font-mono block">ACCURACY</span>
                    <span className="text-base font-bold font-mono text-brand-success">{finalStats.accuracy}%</span>
                  </div>
                  <div className="p-3 bg-black/20 border border-white/5 rounded-xl text-center space-y-1">
                    <span className="text-[9px] text-brand-dim font-mono block">BULLSEYES</span>
                    <span className="text-base font-bold font-mono text-brand-accent">{finalStats.bullseyes}</span>
                  </div>
                  <div className="p-3 bg-black/20 border border-white/5 rounded-xl text-center space-y-1">
                    <span className="text-[9px] text-brand-dim font-mono block">SPEED BONUS</span>
                    <span className="text-base font-bold font-mono text-brand-accent">+{finalStats.speedBonusTotal}</span>
                  </div>
                </div>

                {/* Achievements block */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {finalStats.accuracy >= 85 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-brand-success/10 text-brand-success border border-brand-success/20 font-bold">
                      <Eye className="w-3 h-3" /> EAGLE EYE
                    </span>
                  )}
                  {finalStats.bullseyes >= 4 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-brand-accent/10 text-brand-accent border border-brand-accent/20 font-bold">
                      <Trophy className="w-3 h-3" /> GOLD DRIFT
                    </span>
                  )}
                  {finalStats.score >= 5000 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-brand-accent/10 text-brand-accent border border-brand-accent/20 font-bold">
                      <Zap className="w-3 h-3" /> HIGH FLIER
                    </span>
                  )}
                </div>

                <div className="border-t border-white/5 pt-6 space-y-4">
                  {submitSuccess ? (
                    <div className="p-4 bg-brand-success/15 border border-brand-success/30 rounded-xl flex items-center justify-center gap-2.5 text-brand-success">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-success animate-ping" />
                      <span className="text-sm font-sans font-semibold">Ledger updated successfully! Loading leaderboard...</span>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitScore} className="space-y-4 text-left">
                      <div className="space-y-1.5">
                        <label className="text-xs font-mono font-bold text-brand-dim uppercase tracking-wide block">
                          RECORD YOUR LEGACY NAME
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-dim">
                            <User className="w-4 h-4" />
                          </div>
                          <input
                            type="text"
                            required
                            maxLength={16}
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            placeholder="Enter Archer Alias"
                            className="w-full bg-black/40 border border-white/10 focus:border-brand-accent rounded-xl py-3 pl-10 pr-4 text-sm text-brand-text placeholder-brand-dim focus:outline-none transition-all font-sans"
                            id="input-player-name"
                          />
                        </div>
                      </div>

                      {submitError && (
                        <p className="text-xs font-sans text-brand-danger bg-brand-danger/5 border border-brand-danger/10 p-2.5 rounded-lg flex items-center gap-2">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {submitError}
                        </p>
                      )}

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            audio.playLevelUp();
                            setGameState("playing");
                          }}
                          className="flex-grow sm:flex-grow-0 px-4 py-3 bg-black/40 hover:bg-brand-surface border border-white/10 hover:border-white/20 text-brand-text font-semibold text-xs rounded-xl transition-all cursor-pointer text-center"
                          id="btn-play-again"
                        >
                          Play Again
                        </button>

                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex-grow flex items-center justify-center gap-1 px-6 py-3 bg-brand-accent hover:bg-amber-500 text-brand-bg font-bold text-xs rounded-xl shadow-lg hover:shadow-brand-accent/10 disabled:opacity-50 active:scale-95 transition-all cursor-pointer"
                          id="btn-submit-score"
                        >
                          {isSubmitting ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                          ) : null}
                          <span className="font-serif">REGISTER MARK</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* LEADERBOARD DIVISION */}
          {gameState === "leaderboard" && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-2xl"
            >
              <Leaderboard 
                currentDifficulty={difficulty}
                onPlayAgain={() => {
                  audio.playLevelUp();
                  setGameState("playing");
                }}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Modern minimal footer */}
      {gameState !== "playing" && (
        <footer className="border-t border-white/5 py-6 px-6 bg-black/60 text-center shrink-0">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[10px] font-mono text-brand-dim">
              © 2026 HOODIE LABS. LICENSED FOR INTERACTIVE ENGINES.
            </p>

            <div className="flex gap-4">
              <span className="text-[10px] font-mono text-brand-dim">
                FPS: 60 (HW ACCEL)
              </span>
              <span className="text-[10px] font-mono text-brand-dim">|</span>
              <span className="text-[10px] font-mono text-brand-dim">
                AUDIO: WEB SYNTH SYNCHRONIZED
              </span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
