import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Leaderboard file path
const LEADERBOARD_FILE = path.join(__dirname, "leaderboard.json");

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  difficulty: "easy" | "medium" | "hard" | "champion";
  accuracy: number; // percentage
  speedBonus: number;
  date: string;
}

// Initial leaderboard data if file doesn't exist
const DEFAULT_LEADERBOARD: LeaderboardEntry[] = [
  { id: "1", name: "RobinHood", score: 8500, difficulty: "champion", accuracy: 96, speedBonus: 1200, date: "2026-07-10T12:00:00Z" },
  { id: "2", name: "ArrowMaster", score: 7200, difficulty: "hard", accuracy: 92, speedBonus: 950, date: "2026-07-11T14:30:00Z" },
  { id: "3", name: "SwiftArcher", score: 6100, difficulty: "medium", accuracy: 88, speedBonus: 780, date: "2026-07-11T18:45:00Z" },
  { id: "4", name: "FeatherTip", score: 5400, difficulty: "champion", accuracy: 85, speedBonus: 1100, date: "2026-07-12T09:15:00Z" },
  { id: "5", name: "GreenHood", score: 4800, difficulty: "medium", accuracy: 90, speedBonus: 540, date: "2026-07-12T10:05:00Z" },
  { id: "6", name: "BowNovice", score: 1800, difficulty: "easy", accuracy: 75, speedBonus: 200, date: "2026-07-12T11:20:00Z" }
];

// Helper to read leaderboard
function readLeaderboard(): LeaderboardEntry[] {
  try {
    if (fs.existsSync(LEADERBOARD_FILE)) {
      const data = fs.readFileSync(LEADERBOARD_FILE, "utf-8");
      return JSON.parse(data);
    } else {
      fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(DEFAULT_LEADERBOARD, null, 2));
      return DEFAULT_LEADERBOARD;
    }
  } catch (err) {
    console.error("Error reading leaderboard file:", err);
    return DEFAULT_LEADERBOARD;
  }
}

// Helper to write leaderboard
function writeLeaderboard(data: LeaderboardEntry[]) {
  try {
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing leaderboard file:", err);
  }
}

// API Routes
app.get("/api/leaderboard", (req, res) => {
  const data = readLeaderboard();
  res.json(data);
});

app.post("/api/leaderboard", (req, res) => {
  try {
    const { name, score, difficulty, accuracy, speedBonus } = req.body;
    
    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Player name is required" });
    }
    if (typeof score !== "number" || score < 0) {
      return res.status(400).json({ error: "Valid score is required" });
    }

    const newEntry: LeaderboardEntry = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      name: name.substring(0, 16).trim(), // limit name to 16 chars
      score,
      difficulty: difficulty || "medium",
      accuracy: accuracy || 0,
      speedBonus: speedBonus || 0,
      date: new Date().toISOString()
    };

    const data = readLeaderboard();
    data.push(newEntry);
    
    // Sort descending by score, and limit to top 50
    data.sort((a, b) => b.score - a.score);
    const topFifty = data.slice(0, 50);
    
    writeLeaderboard(topFifty);
    res.status(201).json(newEntry);
  } catch (err) {
    console.error("Error saving leaderboard score:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Serve assets and Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
