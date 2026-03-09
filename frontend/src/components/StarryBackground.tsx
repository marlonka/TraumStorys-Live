import { useMemo, useState, useEffect, useCallback, useRef } from "react";

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  brightness: number;
}

interface ShootingStar {
  id: number;
  x: number;
  y: number;
  angle: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  driftX: number;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const PHASE_OVERLAY: Record<string, string> = {
  greeting: "rgba(252, 211, 77, 0.02)",
  discovery: "rgba(125, 211, 252, 0.02)",
  narrating: "rgba(167, 139, 250, 0.02)",
  decision_point: "rgba(252, 211, 77, 0.04)",
  ending: "rgba(252, 211, 77, 0.03)",
};

interface StarryBackgroundProps {
  dimmed?: boolean;
  phase?: string;
}

export default function StarryBackground({ dimmed = false, phase }: StarryBackgroundProps) {
  // Deterministic star field — stable across remounts and StrictMode
  const stars = useMemo<Star[]>(() => {
    const rand = seededRandom(12345);
    return Array.from({ length: 100 }, (_, i) => ({
      id: i,
      x: rand() * 100,
      y: rand() * 100,
      size: rand() < 0.08 ? rand() * 2.5 + 1.5 : rand() * 1.5 + 0.5,
      delay: rand() * 8,
      duration: rand() * 4 + 3,
      brightness: rand() * 0.5 + 0.15,
    }));
  }, []);

  // Stardust / firefly particles — warm golden motes drifting slowly
  const particles = useMemo<Particle[]>(() => {
    const rand = seededRandom(54321);
    return Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: rand() * 100,
      y: rand() * 100,
      size: rand() * 2 + 1.5,
      duration: 15 + rand() * 20,
      delay: rand() * 15,
      driftX: rand() * 40 - 20,
    }));
  }, []);

  // JS-driven shooting star — random position each time
  const [shootingStar, setShootingStar] = useState<ShootingStar | null>(null);
  const removeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const spawnStar = useCallback(() => {
    setShootingStar({
      id: Date.now(),
      x: 10 + Math.random() * 75,
      y: 3 + Math.random() * 35,
      angle: 28 + Math.random() * 18,
    });

    if (removeTimer.current) clearTimeout(removeTimer.current);
    removeTimer.current = setTimeout(() => setShootingStar(null), 450);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    function scheduleNext() {
      const delay = 18000 + Math.random() * 30000;
      timeout = setTimeout(() => {
        if (cancelled) return;
        spawnStar();
        scheduleNext();
      }, delay);
    }

    timeout = setTimeout(() => {
      if (cancelled) return;
      spawnStar();
      scheduleNext();
    }, 10000 + Math.random() * 15000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (removeTimer.current) clearTimeout(removeTimer.current);
    };
  }, [spawnStar]);

  const isEnding = phase === "ending";

  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none transition-opacity duration-[3000ms]"
      style={{ opacity: dimmed ? 0.4 : 1 }}
    >
      {/* Sky gradient — warm indigo tones */}
      <div
        className="absolute inset-0 transition-all duration-[5000ms]"
        style={{
          background: isEnding
            ? `linear-gradient(to bottom, #04030a 0%, #080714 30%, #0d0e22 70%, #1a1028 100%)`
            : `linear-gradient(to bottom, #04030a 0%, #080714 30%, #0d0e22 70%, #12142c 100%)`,
        }}
      />

      {/* Warm vignette — cozy lantern-lit edges */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 40%, transparent 40%, rgba(6, 7, 15, 0.5) 100%)",
        }}
      />

      {/* Subtle aurora */}
      <div
        className="absolute -top-10 -left-20 w-[140%] h-[30%] rounded-full blur-3xl"
        style={{
          background: "linear-gradient(135deg, rgba(140, 120, 200, 0.04) 0%, rgba(100, 160, 200, 0.02) 40%, transparent 100%)",
          animation: "auroraSway 25s ease-in-out infinite",
        }}
      />

      {/* Phase-specific color overlay — subconscious mood shift */}
      {phase && PHASE_OVERLAY[phase] && (
        <div
          className="absolute inset-0 transition-all duration-[2000ms] pointer-events-none"
          style={{ backgroundColor: PHASE_OVERLAY[phase] }}
        />
      )}

      {/* Stars */}
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            backgroundColor: "#ffffff",
            opacity: s.brightness,
            boxShadow: s.size > 2.5
              ? `0 0 ${s.size * 2}px rgba(255, 255, 255, 0.4)`
              : undefined,
            animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}

      {/* Stardust / firefly particles — warm golden motes */}
      {particles.map((p) => (
        <div
          key={`particle-${p.id}`}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: isEnding
              ? "rgba(251, 191, 36, 0.6)"
              : "rgba(254, 243, 199, 0.6)",
            boxShadow: isEnding
              ? "0 0 8px rgba(251, 191, 36, 0.4)"
              : "0 0 6px rgba(254, 243, 199, 0.4)",
            animation: `drift ${p.duration}s ease-in-out ${p.delay}s infinite`,
            "--drift-x": `${p.driftX}px`,
          } as React.CSSProperties}
        />
      ))}

      {/* Shooting star */}
      {shootingStar && (
        <div
          key={shootingStar.id}
          className="absolute pointer-events-none"
          style={{
            left: `${shootingStar.x}%`,
            top: `${shootingStar.y}%`,
            transform: `rotate(${shootingStar.angle}deg)`,
          }}
        >
          <div
            className="shooting-star-streak"
            style={{
              width: "90px",
              height: "1.5px",
              background: "linear-gradient(to left, transparent 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0.85) 85%, rgba(255,255,255,1) 100%)",
              borderRadius: "999px",
              boxShadow: "0 0 4px rgba(255, 255, 255, 0.4)",
            }}
          />
        </div>
      )}
    </div>
  );
}
