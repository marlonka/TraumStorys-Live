import { useRef, useEffect } from "react";

const SIZE = 512;
const HALF = SIZE / 2;

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** 2D value noise with smoothstep interpolation */
class Noise2D {
  private table: Float32Array;
  private N: number;

  constructor(seed: number, size = 256) {
    this.N = size;
    const rand = seededRandom(seed);
    this.table = new Float32Array(size * size);
    for (let i = 0; i < this.table.length; i++) this.table[i] = rand();
  }

  sample(x: number, y: number): number {
    const N = this.N;
    const fx = ((x % N) + N) % N;
    const fy = ((y % N) + N) % N;
    const xi = fx | 0;
    const yi = fy | 0;
    const xf = fx - xi;
    const yf = fy - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const xi1 = (xi + 1) % N;
    const yi1 = (yi + 1) % N;
    const a = this.table[yi * N + xi];
    const b = this.table[yi * N + xi1];
    const c = this.table[yi1 * N + xi];
    const d = this.table[yi1 * N + xi1];
    return a + u * (b - a) + v * (c - a) + u * v * (a - b - c + d);
  }

  fbm(x: number, y: number, octaves: number): number {
    let val = 0, amp = 1, freq = 1, sum = 0;
    for (let i = 0; i < octaves; i++) {
      val += this.sample(x * freq, y * freq) * amp;
      sum += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return val / sum;
  }
}

export default function MoonCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const R = HALF;
    const invR = 1 / R;
    const R2 = R * R;
    const imageData = ctx.createImageData(SIZE, SIZE);
    const pix = imageData.data;

    // Independent noise layers
    const nTex = new Noise2D(42);
    const nFine = new Noise2D(137);
    const nBump = new Noise2D(99);

    // Normalized light direction — near-frontal, slight upper-left bias for full moon
    const rawLx = -0.12, rawLy = -0.14, rawLz = 0.98;
    const lMag = Math.sqrt(rawLx * rawLx + rawLy * rawLy + rawLz * rawLz);
    const lightX = rawLx / lMag, lightY = rawLy / lMag, lightZ = rawLz / lMag;

    // ── Lunar maria (dark basaltic plains) ──
    // [cx, cy, rx, ry, depth, rotation]
    const maria: readonly (readonly [number, number, number, number, number, number])[] = [
      [0.30, 0.47, 0.18, 0.26, 0.48, -0.15],   // Oceanus Procellarum
      [0.36, 0.28, 0.14, 0.12, 0.44, 0.10],     // Mare Imbrium
      [0.56, 0.29, 0.09, 0.09, 0.42, 0],         // Mare Serenitatis
      [0.60, 0.42, 0.12, 0.10, 0.44, 0.20],     // Mare Tranquillitatis
      [0.73, 0.31, 0.055, 0.048, 0.40, 0],       // Mare Crisium
      [0.64, 0.55, 0.08, 0.07, 0.34, 0.10],     // Mare Fecunditatis
      [0.38, 0.63, 0.09, 0.07, 0.32, -0.10],    // Mare Nubium
      [0.28, 0.69, 0.06, 0.05, 0.30, 0],         // Mare Humorum
      [0.56, 0.60, 0.05, 0.044, 0.27, 0],        // Mare Nectaris
      [0.45, 0.17, 0.17, 0.025, 0.20, 0.05],    // Mare Frigoris
      [0.46, 0.39, 0.05, 0.04, 0.27, 0],         // Mare Vaporum
      [0.56, 0.36, 0.04, 0.06, 0.27, 0.3],      // Serenitatis–Tranquillitatis link
      [0.32, 0.39, 0.06, 0.05, 0.30, -0.1],     // Imbrium–Procellarum link
    ];

    // ── Craters: [cx, cy, radius, rimBrightness, floorDarkness] ──
    const craters: [number, number, number, number, number][] = [
      [0.40, 0.82, 0.028, 0.55, 0.12],  // Tycho
      [0.32, 0.52, 0.024, 0.45, 0.15],  // Copernicus
      [0.18, 0.36, 0.018, 0.50, 0.10],  // Aristarchus
      [0.22, 0.44, 0.015, 0.35, 0.12],  // Kepler
      [0.38, 0.19, 0.022, 0.28, 0.22],  // Plato
      [0.10, 0.48, 0.020, 0.22, 0.20],  // Grimaldi
      [0.44, 0.54, 0.020, 0.18, 0.16],  // Ptolemaeus
      [0.38, 0.88, 0.026, 0.22, 0.14],  // Clavius
      [0.50, 0.14, 0.016, 0.28, 0.10],  // Aristoteles
      [0.65, 0.20, 0.013, 0.22, 0.08],  // Eudoxus
    ];

    // Generate random small craters (enough for visible surface texture)
    const cRand = seededRandom(7777);
    for (let i = 0; i < 90; i++) {
      craters.push([
        0.08 + cRand() * 0.84,
        0.08 + cRand() * 0.84,
        0.002 + cRand() * 0.012,
        0.08 + cRand() * 0.22,
        0.03 + cRand() * 0.10,
      ]);
    }

    // ── Tycho ray system ──
    const rRand = seededRandom(42);
    const tychoRays: [number, number, number][] = [];
    for (let i = 0; i < 8; i++) {
      tychoRays.push([
        (i / 8) * Math.PI * 2 + 0.2 + rRand() * 0.35,  // angle
        0.12 + rRand() * 0.28,                            // length
        0.006 + rRand() * 0.010,                           // width
      ]);
    }

    const grainRng = seededRandom(13);

    // ═══════════════════════════════════════════════
    //  PER-PIXEL RENDERING — single pass
    // ═══════════════════════════════════════════════
    for (let py = 0; py < SIZE; py++) {
      for (let px = 0; px < SIZE; px++) {
        const dx = px - R, dy = py - R;
        const dist2 = dx * dx + dy * dy;
        if (dist2 >= R2) continue;

        const idx = (py * SIZE + px) << 2;
        const u = px / SIZE;   // normalized 0–1
        const v = py / SIZE;

        // Sphere normal
        const snx = dx * invR;
        const sny = dy * invR;
        const snzSq = 1 - snx * snx - sny * sny;
        if (snzSq <= 0) continue;
        const snz = Math.sqrt(snzSq);

        // ─── ALBEDO ───

        // Base highland color — silvery gray, moderate brightness
        let colR = 178, colG = 174, colB = 168;

        // Multi-frequency surface texture (visible at display size)
        const tex = nTex.fbm(u * 18, v * 18, 4);
        const fine = nFine.sample(u * 55, v * 55);
        const texShift = (tex - 0.5) * 32 + (fine - 0.5) * 10;
        colR += texShift;
        colG += texShift;
        colB += texShift * 0.85;

        // Maria — noise-modulated organic edges
        let mareStrength = 0;
        for (const [mcx, mcy, mrx, mry, mdepth, mrot] of maria) {
          const mdx = u - mcx, mdy = v - mcy;
          const cosR = Math.cos(-mrot), sinR = Math.sin(-mrot);
          const ex = (mdx * cosR - mdy * sinR) / mrx;
          const ey = (mdx * sinR + mdy * cosR) / mry;
          const eDist = Math.sqrt(ex * ex + ey * ey);
          if (eDist < 1.4) {
            // Noise modulates the boundary for organic shapes
            const edgeNoise = nTex.sample(u * 9 + mcx * 80, v * 9 + mcy * 80) * 0.2;
            const falloff = 1 - Math.min(1, Math.max(0, (eDist - 0.55 + edgeNoise) / 0.55));
            const strength = falloff * mdepth;
            if (strength > mareStrength) mareStrength = strength;
          }
        }
        if (mareStrength > 0) {
          // Maria: darker, cooler gray (basaltic)
          colR = colR * (1 - mareStrength) + 98 * mareStrength;
          colG = colG * (1 - mareStrength) + 95 * mareStrength;
          colB = colB * (1 - mareStrength) + 92 * mareStrength;
        }

        // Craters — bowl depression + bright rim ring
        // Rim uses MAX (physically correct: overlapping raised rims don't stack)
        let bestRim = 0;
        for (const [ccx, ccy, cRadius, cRim, cFloor] of craters) {
          const cdx = u - ccx, cdy = v - ccy;
          const cd2 = cdx * cdx + cdy * cdy;
          const rimOuter = cRadius * 1.8;
          if (cd2 >= rimOuter * rimOuter) continue;
          const cDist = Math.sqrt(cd2);
          const normDist = cDist / cRadius;

          if (normDist < 0.75) {
            // Inside crater bowl — darker floor (cumulative)
            const bowlFactor = (1 - normDist / 0.75) * cFloor;
            colR *= 1 - bowlFactor;
            colG *= 1 - bowlFactor;
            colB *= 1 - bowlFactor;
          } else if (normDist < 1.2) {
            // Rim — bright raised ring (take brightest only)
            const rimStr = Math.max(0, 1 - Math.abs(normDist - 0.95) / 0.25) * cRim;
            if (rimStr > bestRim) bestRim = rimStr;
          }
        }
        if (bestRim > 0) {
          const rimAdd = bestRim * 40;
          colR += rimAdd;
          colG += rimAdd * 0.96;
          colB += rimAdd * 0.90;
        }

        // Tycho ray system — bright ejecta streaks
        const tDx = u - 0.40, tDy = v - 0.82;
        const tDist = Math.sqrt(tDx * tDx + tDy * tDy);
        if (tDist > 0.03 && tDist < 0.45) {
          const tAngle = Math.atan2(tDy, tDx);
          for (const [rayAngle, rayLen, rayWidth] of tychoRays) {
            let angleDiff = Math.abs(tAngle - rayAngle);
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
            if (angleDiff < rayWidth && tDist < rayLen) {
              const rayIntensity = (1 - tDist / rayLen) * (1 - angleDiff / rayWidth) * 0.14;
              colR += rayIntensity * 180;
              colG += rayIntensity * 175;
              colB += rayIntensity * 165;
            }
          }
        }

        // Clamp albedo to realistic range before lighting
        colR = Math.min(colR, 215);
        colG = Math.min(colG, 210);
        colB = Math.min(colB, 205);

        // ─── LIGHTING ───

        // Bump-mapped normals — noise gradient creates micro-terrain feel
        const bScale = 25;
        const bEps = 2 / SIZE;
        const bH = nBump.sample(u * bScale, v * bScale);
        const bHx = nBump.sample((u + bEps) * bScale, v * bScale);
        const bHy = nBump.sample(u * bScale, (v + bEps) * bScale);
        const bumpStr = 0.35;
        const bnx = snx + (bH - bHx) * bumpStr;
        const bny = sny + (bH - bHy) * bumpStr;
        const bnLen = Math.sqrt(bnx * bnx + bny * bny + snz * snz);

        // Lambert diffuse with perturbed normal
        const diffuse = Math.max(0, (bnx / bnLen) * lightX + (bny / bnLen) * lightY + (snz / bnLen) * lightZ);
        const lighting = 0.16 + diffuse * 0.84;

        // Limb darkening — subtle falloff at sphere edges
        const limb = Math.pow(snz, 0.13);

        // Film grain — breaks digital smoothness
        const grain = (grainRng() - 0.5) * 3;

        const brightness = lighting * limb;
        pix[idx]     = Math.max(0, Math.min(255, colR * brightness + grain));
        pix[idx + 1] = Math.max(0, Math.min(255, colG * brightness + grain));
        pix[idx + 2] = Math.max(0, Math.min(255, colB * brightness + grain));

        // Anti-aliased edge
        const dist = Math.sqrt(dist2);
        pix[idx + 3] = dist > R - 1.5
          ? Math.max(0, Math.min(255, (R - 0.5 - dist) * 170 + 85))
          : 255;
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
