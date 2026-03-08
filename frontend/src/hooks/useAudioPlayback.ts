import { useRef, useCallback } from "react";

const SAMPLE_RATE = 24000; // Gemini Live outputs 24kHz PCM

export function useAudioPlayback() {
  const ctxRef = useRef<AudioContext | null>(null);
  const nextTimeRef = useRef(0);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const init = useCallback(() => {
    if (!ctxRef.current) {
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
      nextTimeRef.current = 0;
    }
  }, []);

  const enqueue = useCallback((pcmBuffer: ArrayBuffer) => {
    const ctx = ctxRef.current;
    const analyser = analyserRef.current;
    if (!ctx || !analyser) return;

    // Convert Int16 PCM to Float32
    const int16 = new Int16Array(pcmBuffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, SAMPLE_RATE);
    audioBuffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(analyser);

    // Schedule seamless playback chain
    const now = ctx.currentTime;
    const startAt = Math.max(now, nextTimeRef.current);
    source.start(startAt);
    nextTimeRef.current = startAt + audioBuffer.duration;
  }, []);

  const getAnalyser = useCallback(() => analyserRef.current, []);

  const stop = useCallback(() => {
    ctxRef.current?.close();
    ctxRef.current = null;
    analyserRef.current = null;
    nextTimeRef.current = 0;
  }, []);

  return { init, enqueue, stop, getAnalyser };
}
