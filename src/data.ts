import { Difficulty } from "./types";

export interface DifficultyInfo {
  id: Difficulty;
  name: string;
  description: string;
  badgeColor: string;
  multiplier: string;
  features: string[];
  recommendedRating: string;
}

export const DIFFICULTY_MODES: DifficultyInfo[] = [
  {
    id: "easy",
    name: "Squire",
    description: "Gentle practice division. Perfect for learning draw mechanics.",
    badgeColor: "border-brand-dim/30 text-brand-dim bg-brand-surface",
    multiplier: "1.0x",
    features: ["Slow moving targets", "Full target board size", "No crosswinds", "Very low arrow gravity drop"],
    recommendedRating: "Perfect for Novice Archers"
  },
  {
    id: "medium",
    name: "Huntsman",
    description: "Standard forest hunt. Wind is introduced, and targets speed up.",
    badgeColor: "border-brand-accent/30 text-brand-accent bg-brand-accent/5",
    multiplier: "1.5x",
    features: ["Medium target speeds", "Standard target size", "Occasional mild crosswinds", "Noticeable arrow gravity drop"],
    recommendedRating: "Recommended Division"
  },
  {
    id: "hard",
    name: "Ranger",
    description: "Elite scouting division. Double targets, high speeds, and strong drafts.",
    badgeColor: "border-brand-accent/50 text-brand-accent bg-brand-accent/10",
    multiplier: "2.5x",
    features: ["Multiple active targets", "Smaller targets & faster speeds", "Strong persistent winds", "Significant gravity pull"],
    recommendedRating: "For Experienced Archers"
  },
  {
    id: "champion",
    name: "Sherwood Legend",
    description: "Legendary archer tier. Tiny moving targets protected by rotating barriers.",
    badgeColor: "border-brand-danger/30 text-brand-danger bg-brand-danger/5",
    multiplier: "4.0x",
    features: ["Orbiting laser shields", "High speed complex sine paths", "Violent sudden drafts", "Heavy vertical pull & tight ammo"],
    recommendedRating: "Only for Archery Masters"
  }
];

export const GAME_TIPS = [
  "Aim higher when drawing slowly! Weak shots drop very quickly under gravity.",
  "Consecutive hits build a multiplier. Take an extra half-second to align your shot and preserve your streak!",
  "Speed counts! Hitting a target within 1 second of spawning grants a huge speed bonus score.",
  "Hold down Space or your Mouse Click to tense the bow string. Full draw means a straighter, faster arrow!"
];
