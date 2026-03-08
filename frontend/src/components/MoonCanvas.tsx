import { useRef, useEffect } from "react";

const SIZE = 512;
const SIZE_MASK = SIZE - 1; // 511 for bitwise modulo
const SIZE_SHIFT = 9;       // log2(512) for bitwise divide

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Draw a soft radial spot at a position (cx%, cy%) with given color and alpha. */
function drawSpot(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  rgb: string,
  alpha: number,
  stops: [number, number][],
) {
  const x = cx * SIZE, y = cy * SIZE;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [pos, alphaScale] of stops) {
    grad.addColorStop(pos, alphaScale === 0 ? "transparent" : `rgba(${rgb}, ${alpha * alphaScale})`);
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}

export default function MoonCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const R = SIZE / 2;

    ctx.clearRect(0, 0, SIZE, SIZE);

    // ═══════════════════════════════════════════════
    // STEP 1: Paint flat albedo map (no lighting yet)
    // ═══════════════════════════════════════════════

    // Flat warm ivory base — uniform color, lighting comes later
    ctx.beginPath();
    ctx.arc(R, R, R - 1, 0, Math.PI * 2);
    ctx.fillStyle = "#e2dac8";
    ctx.fill();

    // Maria — smooth dark regions, soft gradient edges
    // Each mare: [cx%, cy%, rx%, ry%, opacity, rotation]
    const maria: [number, number, number, number, number, number][] = [
      [0.30, 0.47, 0.18, 0.26, 0.50, -0.15],  // Oceanus Procellarum
      [0.36, 0.30, 0.14, 0.11, 0.48, 0.10],    // Mare Imbrium
      [0.55, 0.30, 0.09, 0.085, 0.44, 0],       // Mare Serenitatis
      [0.58, 0.44, 0.11, 0.09, 0.46, 0.20],     // Mare Tranquillitatis
      [0.72, 0.32, 0.05, 0.044, 0.40, 0],        // Mare Crisium
      [0.63, 0.57, 0.08, 0.065, 0.36, 0.10],    // Mare Fecunditatis
      [0.38, 0.64, 0.09, 0.065, 0.34, -0.10],   // Mare Nubium
      [0.28, 0.70, 0.06, 0.05, 0.30, 0],         // Mare Humorum
      [0.55, 0.62, 0.044, 0.040, 0.28, 0],       // Mare Nectaris
      [0.45, 0.18, 0.16, 0.03, 0.22, 0.05],      // Mare Frigoris
      [0.45, 0.40, 0.05, 0.04, 0.28, 0],          // Mare Vaporum
      [0.56, 0.37, 0.04, 0.06, 0.30, 0.3],       // Serenitatis-Tranquillitatis link
      [0.32, 0.40, 0.06, 0.05, 0.32, -0.1],      // Imbrium-Procellarum link
    ];

    for (const [cx, cy, rx, ry, opacity, rot] of maria) {
      ctx.save();
      ctx.translate(cx * SIZE, cy * SIZE);
      ctx.rotate(rot);
      const maxR = Math.max(rx, ry) * SIZE;
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, maxR);
      grad.addColorStop(0, `rgba(85, 78, 65, ${opacity})`);
      grad.addColorStop(0.55, `rgba(90, 82, 68, ${opacity * 0.65})`);
      grad.addColorStop(0.85, `rgba(95, 86, 72, ${opacity * 0.2})`);
      grad.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * SIZE, ry * SIZE, 0, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }

    // Bright crater spots — via shared drawSpot helper
    const brightStops: [number, number][] = [[0, 1], [0.4, 0.5], [1, 0]];
    for (const [cx, cy, r, a] of [
      [0.40, 0.82, 8, 0.35],   // Tycho
      [0.32, 0.52, 10, 0.25],  // Copernicus
      [0.18, 0.36, 6, 0.30],   // Aristarchus
      [0.22, 0.44, 6, 0.15],   // Kepler
    ] as [number, number, number, number][]) {
      drawSpot(ctx, cx, cy, r, "245, 240, 228", a, brightStops);
    }

    // Subtle Tycho rays
    ctx.save();
    ctx.globalAlpha = 0.04;
    const tX = 0.40 * SIZE, tY = 0.82 * SIZE;
    const rand = seededRandom(42);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.2;
      const len = 35 + rand() * 55;
      ctx.beginPath();
      ctx.moveTo(tX, tY);
      ctx.lineTo(tX + Math.cos(a) * len, tY + Math.sin(a) * len);
      ctx.strokeStyle = "#ede5d5";
      ctx.lineWidth = 1.5 + rand() * 1.5;
      ctx.stroke();
    }
    ctx.restore();

    // Dark-floored craters — via shared drawSpot helper
    const darkStops: [number, number][] = [[0, 1], [0.7, 0.4], [1, 0]];
    for (const [cx, cy, r, a] of [
      [0.38, 0.20, 8, 0.15],  // Plato
      [0.10, 0.48, 7, 0.10],  // Grimaldi
      [0.44, 0.55, 8, 0.08],  // Ptolemaeus
      [0.38, 0.88, 10, 0.08], // Clavius
    ] as [number, number, number, number][]) {
      drawSpot(ctx, cx, cy, r, "70, 64, 54", a, darkStops);
    }

    // ═══════════════════════════════════════════════
    // STEP 2: Per-pixel sphere lighting
    // ═══════════════════════════════════════════════

    const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
    const pixels = imageData.data;

    // Near-frontal light for full moon, tiny upper-left bias
    const lx = -0.10, ly = -0.12, lz = 0.99;
    const lLen = Math.sqrt(lx * lx + ly * ly + lz * lz);
    const grain = seededRandom(7);
    const invR = 1 / R;
    const outerThresh2 = (R - 0.5) * (R - 0.5);
    const edgeThresh2 = (R - 1.5) * (R - 1.5);

    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] === 0) continue; // skip transparent

      const pi = i >> 2;
      const x = pi & SIZE_MASK;
      const y = pi >> SIZE_SHIFT;
      const dx = x - R;
      const dy = y - R;
      const dist2 = dx * dx + dy * dy;

      if (dist2 >= outerThresh2) continue;

      // Sphere normal
      const nx = dx * invR;
      const ny = dy * invR;
      const nz = Math.sqrt(Math.max(0.001, 1 - nx * nx - ny * ny));

      // Lambert diffuse
      const diffuse = Math.max(0, (nx * lx + ny * ly + nz * lz) / lLen);
      const lighting = 0.22 + diffuse * 0.78;

      // Gentle limb darkening
      const limb = Math.pow(nz, 0.15);

      // Very subtle grain — barely perceptible, just breaks digital smoothness
      const g = (grain() - 0.5) * 3;

      const brightness = lighting * limb;
      pixels[i] = Math.max(0, Math.min(255, pixels[i] * brightness + g));
      pixels[i + 1] = Math.max(0, Math.min(255, pixels[i + 1] * brightness + g));
      pixels[i + 2] = Math.max(0, Math.min(255, pixels[i + 2] * brightness + g));

      // Anti-aliased edge — only compute sqrt for the ~1,600 edge pixels
      if (dist2 > edgeThresh2) {
        const dist = Math.sqrt(dist2);
        pixels[i + 3] = Math.max(0, Math.min(255, (R - 0.5 - dist) * 170 + 85));
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      className="absolute inset-0 w-full h-full rounded-full moon-crater-drift"
    />
  );
}
