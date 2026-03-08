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

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export default function StarryBackground({ dimmed = false }: { dimmed?: boolean }) {
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

  // JS-driven shooting star — random position each time
  const [shootingStar, setShootingStar] = useState<ShootingStar | null>(null);
  const removeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const spawnStar = useCallback(() => {
    setShootingStar({
      id: Date.now(),
      x: 10 + Math.random() * 75,   // anywhere across the screen
      y: 3 + Math.random() * 35,     // upper 38%
      angle: 28 + Math.random() * 18, // 28-46 deg — natural falling angle
    });

    // Clear previous removal timer if overlapping
    if (removeTimer.current) clearTimeout(removeTimer.current);
    removeTimer.current = setTimeout(() => setShootingStar(null), 450);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    function scheduleNext() {
      const delay = 18000 + Math.random() * 30000; // 18-48s between appearances
      timeout = setTimeout(() => {
        if (cancelled) return;
        spawnStar();
        scheduleNext();
      }, delay);
    }

    // First appearance after 10-25s
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

  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none transition-opacity duration-[3000ms]"
      style={{ opacity: dimmed ? 0.4 : 1 }}
    >
      {/* Very dark sky — near black at top, dark navy at bottom */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, #030508 0%, #060a14 30%, #0a1020 70%, #0e1528 100%)`,
        }}
      />

      {/* Subtle aurora — very faint */}
      <div
        className="absolute -top-10 -left-20 w-[140%] h-[30%] rounded-full blur-3xl"
        style={{
          background: "linear-gradient(135deg, rgba(140, 120, 200, 0.04) 0%, rgba(100, 160, 200, 0.02) 40%, transparent 100%)",
          animation: "auroraSway 25s ease-in-out infinite",
        }}
      />

      {/* Stars — all white, varying brightness */}
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

      {/* Shooting star — JS-spawned, random position each time, very fast */}
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
