import { useState, useCallback, useRef } from "react";
import StarryBackground from "./components/StarryBackground";
import MicButton from "./components/MicButton";
import StoryCanvas from "./components/StoryCanvas";
import Waveform from "./components/Waveform";
import TranscriptOverlay from "./components/TranscriptOverlay";
import { useWebSocket, type JsonMessage } from "./hooks/useWebSocket";
import { useAudioCapture } from "./hooks/useAudioCapture";
import { useAudioPlayback } from "./hooks/useAudioPlayback";

type AppState = "idle" | "connecting" | "active" | "finished";
type StoryPhase = "greeting" | "discovery" | "narrating" | "decision_point" | "ending";

interface Illustration {
  image: string;
  mime: string;
  title: string;
}

interface TranscriptLine {
  text: string;
  type: "in" | "out";
}

/** Phase-specific display config */
const PHASE_CONFIG: Record<StoryPhase, { label: string; sublabel: string }> = {
  greeting:       { label: "Welcome, little dreamer", sublabel: "Traumi is saying hello" },
  discovery:      { label: "Getting to know you", sublabel: "Tell Traumi about yourself" },
  narrating:      { label: "Once upon a time\u2026", sublabel: "Your story is unfolding" },
  decision_point: { label: "What happens next?", sublabel: "You decide the adventure" },
  ending:         { label: "Sweet dreams", sublabel: "The stars are watching over you" },
};

export default function App() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [phase, setPhase] = useState<StoryPhase>("greeting");
  const [illustration, setIllustration] = useState<Illustration | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const playback = useAudioPlayback();
  const speakingTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const handleMessage = useCallback(
    (msg: JsonMessage) => {
      switch (msg.type) {
        case "session_started":
          setAppState("active");
          break;
        case "session_stopped":
          setAppState("finished");
          break;
        case "transcript_in":
          setTranscripts((prev) => [...prev, { text: msg.text, type: "in" }]);
          break;
        case "transcript_out":
          setTranscripts((prev) => [...prev, { text: msg.text, type: "out" }]);
          break;
        case "phase":
          setPhase(msg.phase as StoryPhase);
          break;
        case "illustration":
          setIllustration({ image: msg.image, mime: msg.mime, title: msg.title });
          break;
        case "interrupted":
          // Child spoke while Gemini was talking — flush queued audio immediately
          playback.flush();
          setIsSpeaking(false);
          break;
      }
    },
    [playback]
  );

  const handleAudioOut = useCallback(
    (data: ArrayBuffer) => {
      playback.enqueue(data);
      setIsSpeaking(true);
      if (speakingTimer.current) clearTimeout(speakingTimer.current);
      speakingTimer.current = setTimeout(() => setIsSpeaking(false), 300);
    },
    [playback]
  );

  const ws = useWebSocket({
    onAudio: handleAudioOut,
    onMessage: handleMessage,
    onOpen: () => {
      ws.sendJson({ type: "start_session" });
    },
    onClose: () => {
      if (appState === "active") {
        setAppState("finished");
      }
    },
  });

  const capture = useAudioCapture({
    onChunk: (buf) => ws.sendBinary(buf),
  });

  const handleMicClick = useCallback(async () => {
    if (appState === "idle") {
      setAppState("connecting");
      setTranscripts([]);
      setIllustration(null);
      setPhase("greeting");
      playback.init();
      await capture.start();
      ws.connect();
    } else if (appState === "active") {
      ws.sendJson({ type: "stop_session" });
      capture.stop();
      playback.stop();
      ws.disconnect();
      setAppState("finished");
    } else if (appState === "finished") {
      setAppState("idle");
    }
  }, [appState, ws, capture, playback]);

  const micState =
    appState === "idle" || appState === "finished"
      ? "idle"
      : appState === "connecting"
      ? "connecting"
      : isSpeaking
      ? "speaking"
      : "listening";

  const isEnding = phase === "ending" && appState === "active";
  const hasIllustration = appState === "active" && illustration;
  const phaseInfo = PHASE_CONFIG[phase];

  return (
    <div className="relative h-full w-full flex flex-col items-center overflow-hidden">
      <StarryBackground dimmed={isEnding} />

      {/* ====== IDLE / FINISHED SCREEN ====== */}
      {(appState === "idle" || appState === "finished") && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-8 px-6">
          {/* Logo / Title area */}
          <div className="text-center title-float">
            <h1
              className="text-4xl font-bold tracking-wide mb-2"
              style={{
                background: "linear-gradient(to bottom, var(--color-moon-bright), var(--color-moon-warm))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 2px 8px rgba(254, 243, 199, 0.3))",
              }}
            >
              TraumStorys
            </h1>
            <p className="text-moon/40 text-sm font-medium tracking-widest uppercase">
              {appState === "finished"
                ? "What a beautiful adventure"
                : "Bedtime stories, told just for you"}
            </p>
          </div>

          {/* The Moon Button — centerstage */}
          <MicButton state={micState} onClick={handleMicClick} />

          {/* Bottom tagline */}
          <p className="text-moon/20 text-xs tracking-wider mt-4">
            {appState === "finished"
              ? "Touch the moon for another story"
              : "Powered by a little bit of magic"}
          </p>
        </div>
      )}

      {/* ====== CONNECTING SCREEN ====== */}
      {appState === "connecting" && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-8 px-6">
          <MicButton state="connecting" onClick={handleMicClick} />
        </div>
      )}

      {/* ====== ACTIVE STORY SCREEN ====== */}
      {appState === "active" && (
        <div className="relative z-10 flex-1 flex flex-col items-center w-full pt-6 pb-6 px-4">
          {/* Phase indicator — top */}
          <div className="text-center mb-4 min-h-[3rem]">
            <p
              className={`
                text-xs font-semibold uppercase tracking-[0.2em] mb-1 transition-all duration-700
                ${phase === "decision_point" ? "decision-sparkle text-moon-warm" : "phase-label text-dreamy/50"}
              `}
            >
              {phaseInfo.label}
            </p>
            <p className="text-moon/25 text-[0.65rem] tracking-wider">
              {phaseInfo.sublabel}
            </p>
          </div>

          {/* Center content — illustration or waveform */}
          <div className="flex-1 flex items-center justify-center w-full min-h-0">
            {hasIllustration ? (
              <StoryCanvas
                image={illustration.image}
                mime={illustration.mime}
                title={illustration.title}
              />
            ) : (
              <Waveform getAnalyser={playback.getAnalyser} active={isSpeaking} />
            )}
          </div>

          {/* Bottom area — transcripts + mic */}
          <div className="flex flex-col items-center gap-4 mt-auto w-full">
            <TranscriptOverlay lines={transcripts} />

            <div className="shrink-0">
              <MicButton state={micState} onClick={handleMicClick} />
            </div>
          </div>
        </div>
      )}

      {/* ====== ENDING OVERLAY ====== */}
      {isEnding && (
        <div className="fixed inset-0 z-20 pointer-events-none">
          {/* Soft dimming */}
          <div className="absolute inset-0 bg-night-950/50 sleepy-overlay" />

          {/* Floating sleep particles */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`zzz-${i}`}
              className="absolute text-moon/20 text-lg font-bold"
              style={{
                left: `${20 + Math.random() * 60}%`,
                bottom: `${10 + Math.random() * 30}%`,
                animation: `floatGentle ${3 + Math.random() * 2}s ease-in-out ${i * 0.5}s infinite`,
                animationDelay: `${i * 0.8}s`,
              }}
            >
              z
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
