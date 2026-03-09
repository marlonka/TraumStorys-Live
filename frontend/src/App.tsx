import { useState, useCallback, useRef, useMemo } from "react";
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

const SLEEP_SYMBOLS = ["\u2729", "\u263D", "\u2601", "\u2605", "\u2729", "\u263D", "\u2729", "\u2601", "\u2605", "\u263D"];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export default function App() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [phase, setPhase] = useState<StoryPhase>("greeting");
  const [illustration, setIllustration] = useState<Illustration | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const playback = useAudioPlayback();
  const speakingTimer = useRef<ReturnType<typeof setTimeout>>(null);
  // Ref breaks circular dependency: handleMessage/onClose → capture → ws → handleMessage
  const captureRef = useRef<{ stop: () => void }>({ stop: () => {} });

  // Sleep particles with deterministic positions
  const sleepParticles = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => {
      const rand = seededRandom(i * 37 + 7);
      return {
        x: 15 + rand() * 70,
        y: 5 + rand() * 40,
        size: 0.8 + rand() * 1.2,
        duration: 4 + rand() * 3,
      };
    });
  }, []);

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
          playback.flush();
          setIsSpeaking(false);
          break;
        case "error":
          console.error("Server error:", msg.message);
          setErrorMsg(msg.message);
          captureRef.current.stop();
          playback.stop();
          setAppState("idle");
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
      } else if (appState === "connecting") {
        // Connection failed before session started
        captureRef.current.stop();
        playback.stop();
        setAppState("idle");
        setErrorMsg((prev) => prev || "Connection lost. Please try again.");
      }
    },
  });

  const capture = useAudioCapture({
    onChunk: (buf) => ws.sendBinary(buf),
  });
  captureRef.current = capture;

  const handleMicClick = useCallback(async () => {
    if (appState === "idle") {
      setAppState("connecting");
      setErrorMsg(null);
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
      <StarryBackground dimmed={isEnding} phase={appState === "active" ? phase : undefined} />

      {/* ====== IDLE / FINISHED SCREEN ====== */}
      {(appState === "idle" || appState === "finished") && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-8 px-6">
          {/* Logo / Title area */}
          <div className="text-center title-float">
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2.5rem, 8vw, 4rem)",
                fontWeight: 700,
                lineHeight: 1.1,
                background: "linear-gradient(to bottom, #fefce8, #fcd34d)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 2px 12px rgba(254, 243, 199, 0.4)) drop-shadow(0 0 40px rgba(252, 211, 77, 0.15))",
                letterSpacing: "0.05em",
              }}
            >
              TraumStorys
            </h1>
            <p
              className="mt-1"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 400,
                fontSize: "0.7rem",
                letterSpacing: "0.3em",
                color: "rgba(254, 243, 199, 0.3)",
                textTransform: "uppercase",
              }}
            >
              L I V E
            </p>
          </div>

          {/* The Moon Button — centerstage */}
          <MicButton state={micState} onClick={handleMicClick} />

          {/* Whispered tagline */}
          <p
            className="whisper-text text-xs tracking-widest text-center max-w-[18rem]"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 400,
              color: "rgba(254, 243, 199, 0.35)",
            }}
          >
            {appState === "finished"
              ? "What a beautiful adventure..."
              : "Bedtime stories, told just for you..."}
          </p>

          {/* Dreamy mist at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none overflow-hidden">
            <div
              className="absolute bottom-0 left-[-10%] w-[60%] h-24 rounded-full blur-3xl"
              style={{
                background: "radial-gradient(ellipse, rgba(167, 139, 250, 0.06), transparent)",
                animation: "auroraSway 20s ease-in-out infinite",
              }}
            />
            <div
              className="absolute bottom-0 right-[-5%] w-[50%] h-20 rounded-full blur-3xl"
              style={{
                background: "radial-gradient(ellipse, rgba(125, 211, 252, 0.04), transparent)",
                animation: "auroraSway 25s ease-in-out 5s infinite",
              }}
            />
            <div
              className="absolute bottom-2 left-[30%] w-[40%] h-16 rounded-full blur-3xl"
              style={{
                background: "radial-gradient(ellipse, rgba(252, 211, 77, 0.03), transparent)",
                animation: "auroraSway 22s ease-in-out 3s infinite",
              }}
            />
          </div>
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
        <div
          className={`relative z-10 flex-1 flex flex-col items-center w-full pt-6 pb-6 px-4 ${
            phase === "decision_point" ? "decision-pulse" : ""
          }`}
        >
          {/* Phase indicator — top */}
          <div className="text-center mb-4 min-h-[3.5rem]">
            <p
              className={`
                font-semibold uppercase mb-1 transition-all duration-1000
                ${phase === "decision_point" ? "decision-sparkle text-moon-warm" : "phase-label text-dreamy/60"}
              `}
              style={{
                fontFamily: "var(--font-display)",
                fontSize: phase === "decision_point"
                  ? "clamp(0.85rem, 2.5vw, 1.1rem)"
                  : "clamp(0.7rem, 2vw, 0.85rem)",
                letterSpacing: "0.15em",
              }}
            >
              {phaseInfo.label}
            </p>
            <p className="text-moon/30 text-[0.65rem] tracking-wider">
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

      {/* ====== ERROR TOAST ====== */}
      {errorMsg && appState === "idle" && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 max-w-sm px-5 py-3 rounded-xl text-center"
          style={{
            background: "rgba(127, 29, 29, 0.85)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "rgba(254, 202, 202, 0.9)",
            fontFamily: "var(--font-sans)",
            fontSize: "0.8rem",
            animation: "goodnightFade 0.5s ease-out forwards",
          }}
          onClick={() => setErrorMsg(null)}
        >
          <p className="font-medium mb-0.5" style={{ color: "rgba(252, 165, 165, 1)" }}>
            Could not wake up Traumi
          </p>
          <p className="text-[0.7rem] opacity-75">{errorMsg}</p>
          <p className="text-[0.6rem] opacity-50 mt-1">Tap to dismiss</p>
        </div>
      )}

      {/* ====== ENDING OVERLAY ====== */}
      {isEnding && (
        <div className="fixed inset-0 z-20 pointer-events-none">
          {/* Soft dimming */}
          <div className="absolute inset-0 bg-night-950/50 sleepy-overlay" />

          {/* Floating sleep symbols — stars, crescents, clouds */}
          {sleepParticles.map((p, i) => (
            <div
              key={`sleep-${i}`}
              className="absolute"
              style={{
                left: `${p.x}%`,
                bottom: `${p.y}%`,
                fontSize: `${p.size}rem`,
                color: "rgba(254, 243, 199, 0.15)",
                animation: `sleepFloat ${p.duration}s ease-in-out ${i * 0.6}s infinite`,
              }}
            >
              {SLEEP_SYMBOLS[i]}
            </div>
          ))}

          {/* Goodnight message — fades in after 3s */}
          <div className="absolute inset-0 flex items-center justify-center">
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.5rem, 5vw, 2.5rem)",
                fontWeight: 500,
                color: "rgba(254, 243, 199, 0.5)",
                animation: "goodnightFade 4s ease-in 3s forwards",
                textShadow: "0 0 30px rgba(254, 243, 199, 0.2)",
                opacity: 0,
              }}
            >
              Goodnight, little dreamer...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
