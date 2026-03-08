import { useRef, useCallback } from "react";

interface UseAudioCaptureOpts {
  onChunk: (pcmBuffer: ArrayBuffer) => void;
}

export function useAudioCapture({ onChunk }: UseAudioCaptureOpts) {
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
      },
    });
    streamRef.current = stream;

    const ctx = new AudioContext({ sampleRate: 48000 });
    ctxRef.current = ctx;

    await ctx.audioWorklet.addModule("/audio-capture-worklet.js");
    const source = ctx.createMediaStreamSource(stream);
    const worklet = new AudioWorkletNode(ctx, "audio-capture-processor");

    worklet.port.onmessage = (e) => {
      onChunk(e.data as ArrayBuffer);
    };

    source.connect(worklet);
    worklet.connect(ctx.destination); // needed to keep worklet alive
    nodeRef.current = worklet;
  }, [onChunk]);

  const stop = useCallback(() => {
    nodeRef.current?.disconnect();
    nodeRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close();
    ctxRef.current = null;
  }, []);

  return { start, stop };
}
