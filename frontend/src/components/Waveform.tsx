import { useRef, useEffect } from "react";

interface WaveformProps {
  getAnalyser: () => AnalyserNode | null;
  active: boolean;
}

/**
 * Organic aurora-style waveform — flowing silk ribbons of sound
 * rather than rigid bars. Feels like the northern lights dancing.
 */
export default function Waveform({ getAnalyser, active }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const smoothedRef = useRef<Float32Array | null>(null);

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(rafRef.current);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Fade out rather than hard clear
          const fadeOut = () => {
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = "rgba(5, 8, 16, 1)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          };
          fadeOut();
        }
      }
      return;
    }

    const draw = () => {
      const analyser = getAnalyser();
      const canvas = canvasRef.current;
      if (!analyser || !canvas) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext("2d")!;
      const W = canvas.width;
      const H = canvas.height;
      const bufLen = analyser.frequencyBinCount;
      const raw = new Uint8Array(bufLen);
      analyser.getByteFrequencyData(raw);

      // Smooth the data for organic motion
      if (!smoothedRef.current || smoothedRef.current.length !== bufLen) {
        smoothedRef.current = new Float32Array(bufLen);
      }
      const smoothed = smoothedRef.current;
      for (let i = 0; i < bufLen; i++) {
        smoothed[i] += (raw[i] / 255 - smoothed[i]) * 0.15;
      }

      // Clear with slight trail
      ctx.fillStyle = "rgba(5, 8, 16, 0.25)";
      ctx.fillRect(0, 0, W, H);

      const time = performance.now() * 0.001;
      const centerY = H / 2;
      const points = 64;

      // Draw three layered aurora ribbons
      const ribbons = [
        { color1: "rgba(167, 139, 250, 0.6)", color2: "rgba(125, 211, 252, 0.3)", offset: 0, amp: 1.0, speed: 1 },
        { color1: "rgba(125, 211, 252, 0.4)", color2: "rgba(94, 234, 212, 0.2)", offset: 0.3, amp: 0.7, speed: 1.3 },
        { color1: "rgba(249, 168, 212, 0.3)", color2: "rgba(196, 181, 253, 0.15)", offset: 0.6, amp: 0.5, speed: 0.8 },
      ];

      for (const ribbon of ribbons) {
        ctx.beginPath();
        ctx.moveTo(0, centerY);

        for (let i = 0; i <= points; i++) {
          const t = i / points;
          const x = t * W;
          const dataIdx = Math.floor(t * bufLen * 0.6);
          const energy = smoothed[dataIdx] || 0;

          const wave = Math.sin(t * Math.PI * 3 + time * ribbon.speed + ribbon.offset) * 0.5 + 0.5;
          const height = (energy * ribbon.amp * 0.6 + wave * 0.15) * centerY;

          const y = centerY - height;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            // Smooth curve between points
            const prevX = ((i - 1) / points) * W;
            const cpX = (prevX + x) / 2;
            ctx.quadraticCurveTo(cpX, y, x, y);
          }
        }

        // Mirror bottom
        for (let i = points; i >= 0; i--) {
          const t = i / points;
          const x = t * W;
          const dataIdx = Math.floor(t * bufLen * 0.6);
          const energy = smoothed[dataIdx] || 0;

          const wave = Math.sin(t * Math.PI * 3 + time * ribbon.speed + ribbon.offset) * 0.5 + 0.5;
          const height = (energy * ribbon.amp * 0.6 + wave * 0.15) * centerY;

          const y = centerY + height * 0.6; // Asymmetric — more up, less down
          if (i === points) {
            ctx.lineTo(x, y);
          } else {
            const nextX = ((i + 1) / points) * W;
            const cpX = (nextX + x) / 2;
            ctx.quadraticCurveTo(cpX, y, x, y);
          }
        }

        ctx.closePath();

        // Gradient fill
        const grad = ctx.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, "transparent");
        grad.addColorStop(0.2, ribbon.color1);
        grad.addColorStop(0.5, ribbon.color2);
        grad.addColorStop(0.8, ribbon.color1);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Center glow dot
      const avgEnergy = smoothed.reduce((a, b) => a + b, 0) / bufLen;
      const glowSize = 2 + avgEnergy * 6;
      const grd = ctx.createRadialGradient(W / 2, centerY, 0, W / 2, centerY, glowSize * 3);
      grd.addColorStop(0, `rgba(254, 243, 199, ${0.3 + avgEnergy * 0.4})`);
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(W / 2, centerY, glowSize * 3, 0, Math.PI * 2);
      ctx.fill();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, getAnalyser]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={100}
      className={`w-full max-w-sm h-24 rounded-2xl transition-opacity duration-700 ${
        active ? "opacity-100" : "opacity-0"
      }`}
      style={{ filter: "blur(0.3px)" }} // Slight softness for dreamy quality
    />
  );
}
