export type Difficulty = "easy" | "medium" | "hard" | "champion";

export type TargetType = "standard" | "zigzag" | "fast" | "shielded" | "balloon";

export type ArrowStatus = "idle" | "drawing" | "flying" | "hit" | "missed";

export interface Arrow {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  status: ArrowStatus;
  power: number; // 0 to 1 representing draw tension
  angle: number; // in radians
  drawStart: number; // timestamp
}

export interface Target {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  type: TargetType;
  speed: number;
  health: number;
  maxHealth: number;
  spawnTime: number;
  phase: number; // For wave motions
  shieldAngle?: number; // For shielded targets
  shieldSpeed?: number;
  points: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
}

export interface TextPopup {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  scale: number;
  createdAt: number;
}

export interface GameStats {
  score: number;
  arrowsShot: number;
  targetsHit: number;
  bullseyes: number;
  accuracy: number; // Hit ratio
  difficulty: Difficulty;
  speedBonusTotal: number;
  timeRemaining: number; // In seconds
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  difficulty: Difficulty;
  accuracy: number;
  speedBonus: number;
  date: string;
}
