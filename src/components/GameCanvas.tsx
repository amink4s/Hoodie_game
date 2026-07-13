import React, { useEffect, useRef, useState } from "react";
import { Arrow, Target, Difficulty, Particle, TextPopup, GameStats, TargetType } from "../types";
import { audio } from "./AudioEngine";
import archerImage from "../assets/images/shooter_wojak_1783886403762.jpg";
import { HelpCircle, RefreshCw, Volume2, VolumeX, Wind } from "lucide-react";

interface GameCanvasProps {
  difficulty: Difficulty;
  isMuted: boolean;
  onToggleMute: () => void;
  onGameOver: (stats: GameStats) => void;
  isPlaying: boolean;
  onGameStart: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  difficulty,
  isMuted,
  onToggleMute,
  onGameOver,
  isPlaying,
  onGameStart,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Game Engine state refs to prevent React re-renders from killing 60fps performance
  const stateRef = useRef({
    score: 0,
    arrowsShot: 0,
    targetsHit: 0,
    bullseyes: 0,
    consecutiveHits: 0,
    maxCombo: 0,
    speedBonusTotal: 0,
    
    // Timer properties
    timeLeft: 30,
    gameStartTime: 0,
    isGameOverTriggered: false,
    
    // Archer position
    archer: { x: 90, y: 300, radius: 45, angle: 0 },
    
    // Arrow states
    arrow: null as Arrow | null,
    
    // Active targets
    targets: [] as Target[],
    
    // Visuals
    particles: [] as Particle[],
    popups: [] as TextPopup[],
    
    // Controls
    isDrawing: false,
    drawPower: 0,
    drawStartTime: 0,
    mousePos: { x: 400, y: 300 },
    
    // Wind mechanics
    windSpeed: 0, // Vertical wind: negative is up, positive is down
    windNextChange: 0, // Time when wind changes
    
    // Environment
    width: 800,
    height: 500,
    
    // Performance
    lastFrameTime: 0,
  });

  // Load the Wojak archer image
  const archerImageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = archerImage;
    img.onload = () => {
      archerImageRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => {
      console.warn("Failed to load custom archer wojak, using beautiful fallback");
    };
  }, []);

  // UI States for the HUD (synced periodically or on change)
  const [hudScore, setHudScore] = useState(0);
  const [hudTimeLeft, setHudTimeLeft] = useState(30);
  const [hudCombo, setHudCombo] = useState(0);
  const [hudWind, setHudWind] = useState(0);

  // Difficulty settings
  const getDifficultySettings = (diff: Difficulty) => {
    switch (diff) {
      case "easy":
        return {
          gravity: 0.05,
          windChance: 0.0,
          targetSpeedMin: 1.5,
          targetSpeedMax: 2.5,
          targetRadius: 25,
          maxActiveTargets: 1,
          arrowsLimit: 12,
          windMultiplier: 0,
        };
      case "medium":
        return {
          gravity: 0.12,
          windChance: 0.4,
          targetSpeedMin: 2.2,
          targetSpeedMax: 4.0,
          targetRadius: 20,
          maxActiveTargets: 1,
          arrowsLimit: 10,
          windMultiplier: 0.04,
        };
      case "hard":
        return {
          gravity: 0.22,
          windChance: 0.8,
          targetSpeedMin: 3.5,
          targetSpeedMax: 5.5,
          targetRadius: 15,
          maxActiveTargets: 2,
          arrowsLimit: 8,
          windMultiplier: 0.08,
        };
      case "champion":
        return {
          gravity: 0.32,
          windChance: 1.0,
          targetSpeedMin: 5.0,
          targetSpeedMax: 7.5,
          targetRadius: 11,
          maxActiveTargets: 2,
          arrowsLimit: 6,
          windMultiplier: 0.15,
        };
    }
  };

  const settings = getDifficultySettings(difficulty);

  // Resize handler
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const updateSize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const rect = container.getBoundingClientRect();
      // Keep widescreen proportion
      const width = rect.width;
      const height = Math.min(600, width * 0.58);

      canvas.width = width;
      canvas.height = height;

      stateRef.current.width = width;
      stateRef.current.height = height;
      stateRef.current.archer.y = height / 2;
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      // Small debounce simulation through animation frame
      requestAnimationFrame(updateSize);
    });
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  // Sync mute state to audio manager
  useEffect(() => {
    audio.toggle(!isMuted);
  }, [isMuted]);

  // Restart / Initializing the game
  const initGame = () => {
    const s = stateRef.current;
    s.score = 0;
    s.arrowsShot = 0;
    s.targetsHit = 0;
    s.bullseyes = 0;
    s.consecutiveHits = 0;
    s.maxCombo = 0;
    s.speedBonusTotal = 0;
    s.targets = [];
    s.particles = [];
    s.popups = [];
    s.arrow = null;
    s.isDrawing = false;
    s.drawPower = 0;
    s.windSpeed = 0;
    s.windNextChange = Date.now() + 5000;
    
    // Timer properties initialization
    s.gameStartTime = Date.now();
    s.timeLeft = 30;
    s.isGameOverTriggered = false;

    setHudScore(0);
    setHudTimeLeft(30);
    setHudCombo(0);
    setHudWind(0);

    // Spawn first target
    spawnTarget();
    audio.playLevelUp();
  };

  // Run game initialization when transitioning to isPlaying
  useEffect(() => {
    if (isPlaying) {
      initGame();
    }
  }, [isPlaying, difficulty]);

  // Spawn a target
  const spawnTarget = () => {
    const s = stateRef.current;
    
    // Choose target type based on probability and difficulty
    let type: TargetType = "standard";
    const rand = Math.random();

    if (difficulty === "easy") {
      type = rand > 0.8 ? "zigzag" : "standard";
    } else if (difficulty === "medium") {
      if (rand > 0.85) type = "fast";
      else if (rand > 0.7) type = "zigzag";
      else if (rand > 0.6) type = "balloon";
    } else if (difficulty === "hard") {
      if (rand > 0.8) type = "shielded";
      else if (rand > 0.65) type = "fast";
      else if (rand > 0.45) type = "zigzag";
      else if (rand > 0.3) type = "balloon";
    } else if (difficulty === "champion") {
      if (rand > 0.75) type = "shielded";
      else if (rand > 0.5) type = "fast";
      else if (rand > 0.3) type = "zigzag";
      else type = "balloon";
    }

    // Positions: right side, moving up and down
    const margin = 50;
    const spawnX = s.width - (80 + Math.random() * 120);
    const spawnY = margin + Math.random() * (s.height - margin * 2);
    
    // Target specs
    const targetRadius = settings.targetRadius;
    const speed = settings.targetSpeedMin + Math.random() * (settings.targetSpeedMax - settings.targetSpeedMin);
    
    const targetHealth = type === "shielded" ? 2 : 1;
    
    const newTarget: Target = {
      id: Date.now().toString() + Math.random().toString(),
      x: spawnX,
      y: spawnY,
      width: targetRadius * 2,
      height: targetRadius * 2,
      vx: type === "balloon" ? -0.5 : 0,
      vy: Math.random() > 0.5 ? speed : -speed,
      type,
      speed,
      health: targetHealth,
      maxHealth: targetHealth,
      spawnTime: Date.now(),
      phase: Math.random() * Math.PI * 2,
      shieldAngle: type === "shielded" ? 0 : undefined,
      shieldSpeed: type === "shielded" ? 0.05 + Math.random() * 0.05 : undefined,
      points: type === "fast" ? 150 : type === "shielded" ? 200 : type === "balloon" ? 120 : 100
    };

    s.targets.push(newTarget);
  };

  // Spawn visual particles
  const spawnParticles = (x: number, y: number, color: string, count = 12) => {
    const s = stateRef.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      s.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 2 + Math.random() * 3,
        alpha: 1,
        decay: 0.015 + Math.random() * 0.02
      });
    }
  };

  // Add floating text popup
  const addPopup = (x: number, y: number, text: string, color = "#10B981") => {
    stateRef.current.popups.push({
      id: Date.now().toString() + Math.random().toString(),
      x,
      y,
      text,
      color,
      alpha: 1.3,
      scale: 1,
      createdAt: Date.now()
    });
  };

  // Trigger game over after small delay so final animations resolve
  const triggerGameOver = () => {
    const s = stateRef.current;
    if (s.isGameOverTriggered) return;
    s.isGameOverTriggered = true;

    setTimeout(() => {
      const accuracyRate = s.arrowsShot > 0 ? Math.round((s.targetsHit / s.arrowsShot) * 100) : 0;
      
      const finalStats: GameStats = {
        score: s.score,
        arrowsShot: s.arrowsShot,
        targetsHit: s.targetsHit,
        bullseyes: s.bullseyes,
        accuracy: accuracyRate,
        difficulty,
        speedBonusTotal: s.speedBonusTotal,
        timeRemaining: 0
      };

      audio.playGameOver();
      onGameOver(finalStats);
    }, 1000);
  };

  // Main Game Loop
  useEffect(() => {
    let animId = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gameLoop = (timestamp: number) => {
      const s = stateRef.current;
      
      // Clear canvas
      ctx.clearRect(0, 0, s.width, s.height);

      // Handle wind updates
      if (Date.now() > s.windNextChange) {
        if (difficulty !== "easy" && Math.random() < settings.windChance) {
          // Wind gets randomized: -10 to 10 knots
          s.windSpeed = (Math.random() * 20 - 10) * settings.windMultiplier;
          setHudWind(Math.round(s.windSpeed * 100));
        } else {
          s.windSpeed = 0;
          setHudWind(0);
        }
        s.windNextChange = Date.now() + 6000 + Math.random() * 5000;
      }

      // Draw aesthetic environment
      drawEnvironment(ctx, s.width, s.height);

      // 1. UPDATE & DRAW ARCHER WOJAK
      // Calculate archer aim angle based on mouse position relative to archer
      if (isPlaying) {
        const archerX = s.archer.x;
        const archerY = s.archer.y;
        const dx = s.mousePos.x - archerX;
        const dy = s.mousePos.y - archerY;
        
        // Cap the aim angle to forward-right arcs
        let angle = Math.atan2(dy, dx);
        const maxAngle = Math.PI / 3; // 60 deg
        if (angle < -maxAngle) angle = -maxAngle;
        if (angle > maxAngle) angle = maxAngle;
        s.archer.angle = angle;
      }

      drawArcher(ctx, s.archer.x, s.archer.y, s.archer.angle, s.isDrawing, s.drawPower);

      // Draw trajectory preview line if drawing
      if (s.isDrawing && isPlaying) {
        drawTrajectory(ctx, s.archer.x, s.archer.y, s.archer.angle, s.drawPower);
      }

      if (isPlaying) {
        // 2. UPDATE & DRAW TARGETS
        updateAndDrawTargets(ctx, s);

        // 3. UPDATE & DRAW ACTIVE ARROW
        updateAndDrawArrow(ctx, s);
        
        // Update remaining time
        const elapsed = (Date.now() - s.gameStartTime) / 1000;
        s.timeLeft = Math.max(0, 30 - elapsed);
        setHudTimeLeft(Math.ceil(s.timeLeft));

        if (s.timeLeft <= 0 && !s.arrow) {
          triggerGameOver();
        }
      }

      // 4. UPDATE & DRAW VISUAL EFFECTS (particles, popups)
      updateAndDrawParticles(ctx, s);
      updateAndDrawPopups(ctx, s);

      // Continuous loop
      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, difficulty, imageLoaded]);

  // DRAW background assets and environment
  const drawEnvironment = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Sky gradient (Sophisticated Dark radial gradient matching the theme's aesthetic)
    const skyGrad = ctx.createRadialGradient(width / 2, height, 10, width / 2, height, width);
    skyGrad.addColorStop(0, "#1c1c1c"); // Elegant dark center at bottom
    skyGrad.addColorStop(0.5, "#0d0d0d");
    skyGrad.addColorStop(1, "#050505"); // Deep rich black outer
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtly draw beautiful trees in background (silhouette layers)
    ctx.save();
    ctx.fillStyle = "#121212"; // Deep graphite
    ctx.globalAlpha = 0.4;
    
    // Draw far forest ridge
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let i = 0; i <= width; i += 40) {
      const treeHeight = 70 + Math.sin(i * 0.05) * 20;
      ctx.lineTo(i, height - treeHeight);
      ctx.lineTo(i + 20, height - treeHeight - 15);
      ctx.lineTo(i + 40, height - treeHeight);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Draw close forest ridge (graphite silhouette matching Sophisticated Dark)
    ctx.fillStyle = "#181818"; // Dark coal
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let i = 0; i <= width; i += 60) {
      const treeHeight = 40 + Math.sin(i * 0.02) * 15;
      ctx.lineTo(i, height - treeHeight);
      ctx.lineTo(i + 30, height - treeHeight - 25);
      ctx.lineTo(i + 60, height - treeHeight);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Draw bottom ground line
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, height - 10, width, 10);

    // Elegant luxury gold highlight line on top of ground
    ctx.fillStyle = "#D4AF37";
    ctx.fillRect(0, height - 10, width, 1.5);

    // Render wind effect vectors
    const s = stateRef.current;
    if (Math.abs(s.windSpeed) > 0.01) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([10, 15]);
      
      const windDir = s.windSpeed > 0 ? 1 : -1;
      const waveOffset = (Date.now() / 15) % 100;
      
      // Draw 3 horizontal wind drift streams
      for (let row = 0; row < 3; row++) {
        const yPos = 80 + row * 120;
        ctx.beginPath();
        ctx.moveTo(windDir > 0 ? waveOffset : width - waveOffset, yPos);
        ctx.lineTo(windDir > 0 ? width : 0, yPos);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  // DRAW Archer Wojak
  const drawArcher = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    isDrawing: boolean,
    drawPower: number
  ) => {
    ctx.save();
    ctx.translate(x, y);

    // Hover floating animation for the archer
    const floatOffset = Math.sin(Date.now() / 300) * 4;
    ctx.translate(0, floatOffset);

    // Rotation angle
    ctx.rotate(angle);

    // 1. Draw Bow string and arms
    ctx.strokeStyle = "#D4AF37"; // Elegant Classic Gold bow
    ctx.lineWidth = 5;
    ctx.lineCap = "round";

    // Curve of the bow
    ctx.beginPath();
    ctx.arc(0, 0, 42, -Math.PI / 1.7, Math.PI / 1.7);
    ctx.stroke();

    // Bow string
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    
    // Draw string tension displacement depending on power
    const stringPull = isDrawing ? -22 * drawPower : 0;
    ctx.moveTo(12, -36);
    ctx.lineTo(stringPull, 0);
    ctx.lineTo(12, 36);
    ctx.stroke();

    // 2. Draw Archer Character (Wojak circular token or image)
    ctx.restore();

    ctx.save();
    ctx.translate(x, y);
    ctx.translate(0, floatOffset);

    // Shadow glow for archer (gold glow)
    ctx.shadowColor = "rgba(212, 175, 55, 0.35)";
    ctx.shadowBlur = 15;

    // Draw background outer ring (gold circle)
    ctx.fillStyle = "#D4AF37"; // Classic gold
    ctx.beginPath();
    ctx.arc(-25, 0, 36, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#AA8417"; // Metallic bronze/dark gold
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Render original image or avatar representation inside the circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(-25, 0, 34, 0, Math.PI * 2);
    ctx.clip();

    if (imageLoaded && archerImageRef.current) {
      // Draw custom RobinHood Wojak image!
      ctx.drawImage(archerImageRef.current, -25 - 34, -34, 68, 68);
    } else {
      // High-quality abstract vector archer face placeholder (Wojak hood style)
      // Green Hood outline
      ctx.fillStyle = "#D4AF37"; // Gold hood
      ctx.beginPath();
      ctx.arc(-25, 0, 34, 0, Math.PI * 2);
      ctx.fill();

      // White face block inside hood
      ctx.fillStyle = "#F8FAFC";
      ctx.beginPath();
      ctx.arc(-20, 5, 18, 0, Math.PI * 2);
      ctx.fill();

      // Black eyes (sideways look)
      ctx.fillStyle = "#0F172A";
      ctx.beginPath();
      ctx.arc(-14, 2, 3, 0, Math.PI * 2);
      ctx.arc(-24, 2, 3, 0, Math.PI * 2);
      ctx.fill();

      // Brow frown
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-17, -2);
      ctx.lineTo(-11, 2);
      ctx.moveTo(-21, -2);
      ctx.lineTo(-27, 2);
      ctx.stroke();

      // Black feather stick out
      ctx.fillStyle = "#1E293B";
      ctx.beginPath();
      ctx.moveTo(-45, -20);
      ctx.lineTo(-58, -35);
      ctx.lineTo(-42, -28);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 3. Draw tension loading meter if drawing
    if (isDrawing) {
      ctx.save();
      ctx.translate(-25, 0);
      ctx.strokeStyle = "rgba(15, 23, 42, 0.4)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, 42, 0, Math.PI * 2);
      ctx.stroke();

      // Radial progress bar (gold to ruby crimson)
      const grad = ctx.createLinearGradient(-42, 0, 42, 0);
      grad.addColorStop(0, "#AA8417"); // Dark gold
      grad.addColorStop(0.5, "#D4AF37"); // Classic gold
      grad.addColorStop(1, "#CF6679"); // Ruby crimson warning
      
      ctx.strokeStyle = grad;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, 0, 42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * drawPower);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  };

  // DRAW Trajectory helper line
  const drawTrajectory = (
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    angle: number,
    power: number
  ) => {
    ctx.save();
    ctx.strokeStyle = "rgba(212, 175, 55, 0.45)"; // Gold preview trajectory
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 8]);
    
    // Project projectile points
    // Velocity scales with power: power 0 is min, 1 is max velocity
    const baseSpeed = 12;
    const finalSpeed = baseSpeed + power * 18;
    
    let currentX = startX + Math.cos(angle) * 30;
    let currentY = startY + Math.sin(angle) * 30;
    let currentVx = Math.cos(angle) * finalSpeed;
    let currentVy = Math.sin(angle) * finalSpeed;
    
    ctx.beginPath();
    ctx.moveTo(currentX, currentY);
    
    // Plot up to 40 step steps
    for (let i = 0; i < 35; i++) {
      currentX += currentVx;
      currentY += currentVy;
      
      // Apply environment physics forces (gravity and vertical wind)
      currentVy += settings.gravity;
      currentVy += stateRef.current.windSpeed;

      ctx.lineTo(currentX, currentY);
      
      if (currentX > stateRef.current.width || currentY > stateRef.current.height || currentY < 0) {
        break;
      }
    }
    ctx.stroke();
    ctx.restore();
  };

  // UPDATE & DRAW Targets
  const updateAndDrawTargets = (ctx: CanvasRenderingContext2D, s: any) => {
    s.targets.forEach((target: Target) => {
      // 1. Move target based on standard speeds
      target.y += target.vy;
      target.x += target.vx;

      // Bounce on edges
      const margin = 20;
      if (target.y - target.height / 2 < margin && target.vy < 0) {
        target.vy = -target.vy;
      }
      if (target.y + target.height / 2 > s.height - margin && target.vy > 0) {
        target.vy = -target.vy;
      }

      // Sine wave behavior for "zigzag" targets
      if (target.type === "zigzag") {
        target.phase += 0.08;
        target.x += Math.sin(target.phase) * 2;
      }

      // Fast float behavior for balloon targets
      if (target.type === "balloon") {
        target.phase += 0.04;
        target.y += Math.sin(target.phase) * 1.5;
      }

      // Rotation angle for shields
      if (target.type === "shielded" && target.shieldAngle !== undefined && target.shieldSpeed !== undefined) {
        target.shieldAngle += target.shieldSpeed;
      }

      // 2. Draw Target Board
      ctx.save();
      ctx.translate(target.x, target.y);

      // Shadow glow around targets
      ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;

      const r = target.width / 2;

      // Draw standard bullseye target ring layers
      // Outer Wood Board (sophisticated coal graphite)
      ctx.fillStyle = "#111111";
      ctx.beginPath();
      ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
      ctx.fill();

      // Outer Ring: White/Grey (radius r)
      ctx.fillStyle = "#E0E0E0";
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      // Middle Ring: Blue/Black (radius r * 0.66)
      ctx.fillStyle = "#1e3a8a"; // Deep royal navy
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.66, 0, Math.PI * 2);
      ctx.fill();

      // Inner Ring: Red (radius r * 0.33)
      ctx.fillStyle = "#991b1b"; // Deep ruby red
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.33, 0, Math.PI * 2);
      ctx.fill();

      // Bullseye Center: Gold/Yellow (radius r * 0.12)
      ctx.fillStyle = "#D4AF37"; // Classic gold!
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
      ctx.fill();

      // Clean concentric strokes
      ctx.strokeStyle = "#050505";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.66, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.33, 0, Math.PI * 2);
      ctx.stroke();

      // Armor indicator for shielded target
      if (target.type === "shielded") {
        ctx.strokeStyle = "#94A3B8";
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, r + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw floating shield or orbit barrier
      if (target.type === "shielded" && target.shieldAngle !== undefined) {
        ctx.restore(); // Exit target translation to draw orbit properly
        ctx.save();
        ctx.translate(target.x, target.y);
        ctx.rotate(target.shieldAngle);

        ctx.strokeStyle = "#38BDF8"; // Sky Blue laser shield
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.shadowColor = "#0EA5E9";
        ctx.shadowBlur = 8;
        
        // Draw 2 shield arcs opposite to each other
        ctx.beginPath();
        ctx.arc(0, 0, r + 12, -Math.PI / 4, Math.PI / 4);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, r + 12, Math.PI - Math.PI / 4, Math.PI + Math.PI / 4);
        ctx.stroke();
      }

      // Specialized target icons inside
      ctx.restore();

      // Floating indicator label for target types
      ctx.save();
      ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
      ctx.font = "bold 9px 'JetBrains Mono'";
      ctx.textAlign = "center";
      
      let labelText = "";
      let labelColor = "#94A3B8";
      if (target.type === "fast") { labelText = "SPEEDY"; labelColor = "#F59E0B"; }
      else if (target.type === "shielded") { labelText = "ARMORED"; labelColor = "#38BDF8"; }
      else if (target.type === "zigzag") { labelText = "WAVE"; labelColor = "#A855F7"; }
      else if (target.type === "balloon") { labelText = "DRIFTER"; labelColor = "#F43F5E"; }

      if (labelText) {
        ctx.fillStyle = labelColor;
        ctx.fillText(labelText, target.x, target.y - (r + 16));
      }
      ctx.restore();
    });

    // Check if any target moved too far left and needs removal/respawn (e.g. Balloon/Drifter)
    s.targets = s.targets.filter((target: Target) => {
      if (target.x < 180) {
        // Target escaped! Count as miss / remove it
        addPopup(target.x, target.y, "ESCAPED!", "#EF4444");
        audio.playMiss();
        
        // Reset combo if a target escapes
        s.consecutiveHits = 0;
        setHudCombo(0);
        
        // Spawn replacement
        setTimeout(() => spawnTarget(), 800);
        return false;
      }
      return true;
    });

    // Respawn targets if all are cleared
    if (isPlaying && s.targets.length === 0) {
      spawnTarget();
    }
  };

  // UPDATE & DRAW Arrows
  const updateAndDrawArrow = (ctx: CanvasRenderingContext2D, s: any) => {
    const arrow = s.arrow;
    if (!arrow || arrow.status !== "flying") return;

    // Apply physics: continuous displacement
    arrow.x += arrow.vx;
    arrow.y += arrow.vy;

    // Apply environment factors: Gravity pull and Wind gust
    arrow.vy += settings.gravity;
    arrow.vy += s.windSpeed;

    // Calculate flight angle from velocity vector
    arrow.angle = Math.atan2(arrow.vy, arrow.vx);

    // Draw Arrow
    ctx.save();
    ctx.translate(arrow.x, arrow.y);
    ctx.rotate(arrow.angle);

    // Arrow wooden body
    ctx.strokeStyle = "#D1A377"; // Wood brown
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(12, 0);
    ctx.stroke();

    // Arrow tip (obsidian arrowhead)
    ctx.fillStyle = "#1E293B";
    ctx.beginPath();
    ctx.moveTo(12, -4);
    ctx.lineTo(22, 0);
    ctx.lineTo(12, 4);
    ctx.closePath();
    ctx.fill();

    // Feather fletching (elegant gold/bronze matching theme)
    ctx.fillStyle = "#D4AF37";
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(-28, -6);
    ctx.lineTo(-20, -6);
    ctx.lineTo(-14, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#AA8417";
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(-28, 6);
    ctx.lineTo(-20, 6);
    ctx.lineTo(-14, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Collision check against targets
    let isHit = false;

    for (let i = 0; i < s.targets.length; i++) {
      const target = s.targets[i];
      const radius = target.width / 2;

      // Distance between arrow head (tip of arrow is at +22px of x relative to coordinates)
      const tipX = arrow.x + Math.cos(arrow.angle) * 22;
      const tipY = arrow.y + Math.sin(arrow.angle) * 22;

      const dist = Math.sqrt(Math.pow(tipX - target.x, 2) + Math.pow(tipY - target.y, 2));

      // Shield defense interception
      if (target.type === "shielded" && target.shieldAngle !== undefined) {
        // Calculate collision against rotating shields
        // Distance matches orbital shield ring size (radius + 12)
        const shieldRadius = radius + 12;
        if (Math.abs(dist - shieldRadius) < 8) {
          // Check if arrow tip coincides with shield arcs
          const angleToArrow = Math.atan2(tipY - target.y, tipX - target.x);
          // Normalize both angles between -PI and PI
          const relativeAngle = Math.abs((angleToArrow - target.shieldAngle + Math.PI * 3) % (Math.PI * 2) - Math.PI);
          
          // Check if it hit inside either of the 45 degree shield arcs (approx 0.8 radians)
          if (relativeAngle < 0.45 || relativeAngle > Math.PI - 0.45) {
            // Shield hit! Arrow gets deflected
            arrow.status = "missed";
            arrow.vx = -arrow.vx * 0.3; // bounce back slightly
            arrow.vy = 2 + Math.random() * 4; // fall down
            
            spawnParticles(tipX, tipY, "#38BDF8", 14);
            addPopup(tipX, tipY - 20, "SHIELD BLOCK!", "#0EA5E9");
            audio.playMiss();
            isHit = true;
            
            // Spawn next arrow quickly
            s.arrow = null;
            break;
          }
        }
      }

      // Direct target board hit
      if (dist <= radius) {
        isHit = true;
        arrow.status = "hit";
        
        // Precise hit calculations (distance from center of target)
        const hitDistance = dist;
        const speedBonusTime = Math.max(0, 3000 - (Date.now() - target.spawnTime)); // 3 seconds window
        const speedMultiplier = speedBonusTime / 3000; // 0 to 1
        const speedBonus = Math.round(speedMultiplier * 50);

        // Proximity calculation: 1.0 at center, 0.0 at outer edge
        const proximityFactor = Math.max(0, 1 - (hitDistance / radius));
        // Continuous precision bonus up to 40 additional points for hitting closer to the center
        const precisionBonus = Math.round(proximityFactor * 40);

        let hitPoints = 0;
        let ringName = "";
        let ringColor = "";

        if (hitDistance <= radius * 0.15) {
          // Bullseye!
          hitPoints = (target.points + 50) + precisionBonus; 
          ringName = `BULLSEYE! +${hitPoints}`;
          ringColor = "#D4AF37"; // gold
          s.bullseyes += 1;
          audio.playHitBullseye();
          spawnParticles(tipX, tipY, "#D4AF37", 20);
        } else if (hitDistance <= radius * 0.45) {
          // Inner ring
          hitPoints = Math.round(target.points * 0.75) + precisionBonus;
          ringName = `GREAT! +${hitPoints}`;
          ringColor = "#F43F5E"; // rose red
          audio.playHitNormal();
          spawnParticles(tipX, tipY, "#EF4444", 12);
        } else {
          // Outer ring
          hitPoints = Math.round(target.points * 0.4) + precisionBonus;
          ringName = `GOOD! +${hitPoints}`;
          ringColor = "#3B82F6"; // blue
          audio.playHitNormal();
          spawnParticles(tipX, tipY, "#60A5FA", 8);
        }

        // Apply Combo Multiplier
        s.consecutiveHits += 1;
        if (s.consecutiveHits > s.maxCombo) {
          s.maxCombo = s.consecutiveHits;
        }
        
        const comboMultiplier = 1 + Math.floor(s.consecutiveHits / 3) * 0.2; // +20% every 3 hits
        const finalScoreChange = Math.round((hitPoints + speedBonus) * comboMultiplier);

        s.score += finalScoreChange;
        s.targetsHit += 1;
        s.speedBonusTotal += speedBonus;

        // Apply health decay for armored targets
        target.health -= 1;

        setHudScore(s.score);
        setHudCombo(s.consecutiveHits);

        // Populate visual popups
        addPopup(target.x, target.y - 25, ringName, ringColor);
        if (speedBonus > 15) {
          setTimeout(() => addPopup(target.x, target.y - 5, `SPEED BONUS +${speedBonus}`, "#10B981"), 200);
        }
        if (s.consecutiveHits >= 3) {
          setTimeout(() => addPopup(target.x, target.y + 15, `COMBO x${comboMultiplier.toFixed(1)}!`, "#A855F7"), 350);
        }

        // Remove target if health drops to 0
        if (target.health <= 0) {
          s.targets = s.targets.filter((t: Target) => t.id !== target.id);
          // Spawn another target immediately
          setTimeout(() => spawnTarget(), 600);
        } else {
          // Reset target spawn time for speed multiplier calculation of subsequent hit
          target.spawnTime = Date.now();
        }

        // Terminate arrow flight
        s.arrow = null;
        break;
      }
    }

    // Check if arrow missed completely and flew off-bounds
    if (!isHit && (arrow.x > s.width || arrow.y > s.height + 100 || arrow.y < -100)) {
      arrow.status = "missed";
      s.consecutiveHits = 0; // Break combo
      setHudCombo(0);
      
      addPopup(s.width - 100, Math.min(Math.max(arrow.y, 40), s.height - 40), "MISS!", "#EF4444");
      audio.playMiss();
      
      // Spawn helper
      s.arrow = null;
    }
  };

  // Update and Draw Particles
  const updateAndDrawParticles = (ctx: CanvasRenderingContext2D, s: any) => {
    s.particles.forEach((p: Particle) => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Remove expired particles
    s.particles = s.particles.filter((p: Particle) => p.alpha > 0);
  };

  // UPDATE & DRAW Popups
  const updateAndDrawPopups = (ctx: CanvasRenderingContext2D, s: any) => {
    s.popups.forEach((popup: TextPopup) => {
      popup.y -= 0.8; // Float upwards
      popup.alpha -= 0.015; // Slow fade out
      popup.scale += 0.005; // Gentle scale grow

      ctx.save();
      ctx.fillStyle = popup.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, popup.alpha));
      ctx.font = `bold ${Math.round(14 * popup.scale)}px 'Space Grotesk', system-ui, sans-serif`;
      ctx.textAlign = "center";
      
      // Dark drop shadow behind floating texts
      ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;

      ctx.fillText(popup.text, popup.x, popup.y);
      ctx.restore();
    });

    s.popups = s.popups.filter((p: TextPopup) => p.alpha > 0);
  };

  // MOUSE CONTROLS
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    stateRef.current.mousePos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = () => {
    if (!isPlaying) return;
    const s = stateRef.current;
    if (s.timeLeft <= 0 || s.arrow) return;

    // Start drawing the bow
    s.isDrawing = true;
    s.drawPower = 0;
    s.drawStartTime = Date.now();
    audio.playBowDraw();
  };

  // Drawing tension animation frame helper
  useEffect(() => {
    let animId = 0;
    const updateDrawPower = () => {
      const s = stateRef.current;
      if (s.isDrawing) {
        const elapsed = Date.now() - s.drawStartTime;
        // Reaches full power in 1.1 seconds
        s.drawPower = Math.min(1.0, elapsed / 1100);
      }
      animId = requestAnimationFrame(updateDrawPower);
    };
    updateDrawPower();
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleMouseUp = () => {
    if (!isPlaying) return;
    const s = stateRef.current;
    if (!s.isDrawing) return;

    s.isDrawing = false;
    
    // Shoot! Minimum power is 0.15 to fire
    if (s.drawPower >= 0.1) {
      const baseSpeed = 11;
      const arrowSpeed = baseSpeed + s.drawPower * 19; // Power increases final speed

      s.arrow = {
        id: Date.now().toString(),
        x: s.archer.x + Math.cos(s.archer.angle) * 30,
        y: s.archer.y + Math.sin(s.archer.angle) * 30,
        vx: Math.cos(s.archer.angle) * arrowSpeed,
        vy: Math.sin(s.archer.angle) * arrowSpeed,
        status: "flying",
        power: s.drawPower,
        angle: s.archer.angle,
        drawStart: s.drawStartTime
      };

      s.arrowsShot += 1;
      
      audio.playArrowRelease();
    }
    s.drawPower = 0;
  };

  return (
    <div id="game-canvas-container" className="flex flex-col w-full h-full bg-brand-surface overflow-hidden select-none">
      {/* Dynamic HUD header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-black/80 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-4">
          {/* Wind Sock Status */}
          {difficulty !== "easy" && (
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-brand-accent animate-pulse" />
              <div className="flex flex-col">
                <span className="text-xs text-brand-dim font-mono">CROSSWIND</span>
                <span className="text-xs font-bold font-mono text-brand-accent">
                  {hudWind === 0 ? "CALM" : `${hudWind > 0 ? "↓" : "↑"} ${Math.abs(hudWind)} m/s`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Core HUD Counters */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-xs text-brand-dim font-mono">COMBO</span>
            <span className="text-xl font-black font-mono text-brand-accent tracking-tight transition-all">
              {hudCombo > 1 ? `x${hudCombo}` : "—"}
            </span>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-xs text-brand-dim font-mono">TIME LEFT</span>
            <span className="text-xl font-black font-mono text-brand-success tracking-tight">
              {hudTimeLeft}s
            </span>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-xs text-brand-dim font-mono">SCORE</span>
            <span className="text-xl font-black font-mono text-brand-accent tracking-tight">
              {hudScore.toLocaleString()}
            </span>
          </div>

          <button
            onClick={onToggleMute}
            className="p-1.5 rounded-lg border border-white/10 text-brand-dim hover:text-brand-text hover:bg-white/5 transition-colors cursor-pointer"
            title={isMuted ? "Unmute" : "Mute"}
            id="btn-mute"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div ref={containerRef} className="relative flex-grow flex items-center justify-center bg-black/20 p-2 overflow-hidden min-h-[250px]">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={(e) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            stateRef.current.mousePos = {
              x: touch.clientX - rect.left,
              y: touch.clientY - rect.top,
            };
            handleMouseDown();
          }}
          onTouchMove={(e) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            stateRef.current.mousePos = {
              x: touch.clientX - rect.left,
              y: touch.clientY - rect.top,
            };
          }}
          onTouchEnd={handleMouseUp}
          className={`bg-brand-bg border border-white/10 rounded-xl shadow-2xl shadow-black/60 touch-none max-w-full block ${
            isPlaying ? "cursor-crosshair" : "cursor-default"
          }`}
          id="canvas-game"
        />

        {/* Start Game overlay if not playing */}
        {!isPlaying && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm p-6 text-center">
            <div className="max-w-md space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-brand-accent tracking-tight font-serif">
                  Time Your Arrow, Pierce the Target
                </h2>
                <p className="text-sm text-brand-dim leading-relaxed font-sans">
                  A high-accuracy archery simulator. Draw power controls trajectory, angle adjusts aim. Watch out for gravity and hit consecutive targets to build combos!
                </p>
              </div>

              {/* Instructions Panel */}
              <div className="grid grid-cols-2 gap-4 text-left border border-white/5 rounded-lg p-3 bg-black/60 font-sans text-xs">
                <div className="flex items-start gap-2 text-brand-text">
                  <div className="w-5 h-5 rounded bg-brand-accent/10 border border-brand-accent/30 text-brand-accent flex items-center justify-center font-bold shrink-0 font-serif">1</div>
                  <span>Click / Hold mouse or touch to draw bow. Release to shoot!</span>
                </div>
                <div className="flex items-start gap-2 text-brand-text">
                  <div className="w-5 h-5 rounded bg-brand-success/10 border border-brand-success/30 text-brand-success flex items-center justify-center font-bold shrink-0 font-serif">2</div>
                  <span>Aim higher to compensate for gravity and vertical wind!</span>
                </div>
                <div className="flex items-start gap-2 text-brand-text">
                  <div className="w-5 h-5 rounded bg-brand-accent/10 border border-brand-accent/30 text-brand-accent flex items-center justify-center font-bold shrink-0 font-serif">3</div>
                  <span>Consecutive hits build Combos and multiply final points.</span>
                </div>
                <div className="flex items-start gap-2 text-brand-text">
                  <div className="w-5 h-5 rounded bg-brand-accent/10 border border-brand-accent/30 text-brand-accent flex items-center justify-center font-bold shrink-0 font-serif">4</div>
                  <span>Shoot faster after target spawns to earn Speed Bonuses!</span>
                </div>
              </div>

              <button
                onClick={onGameStart}
                className="w-full sm:w-auto px-8 py-3.5 bg-brand-accent hover:bg-amber-500 text-brand-bg font-serif font-bold text-sm tracking-wide rounded-lg shadow-lg hover:shadow-brand-accent/20 active:scale-95 transition-all cursor-pointer"
                id="btn-play"
              >
                START GAME
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default GameCanvas;
