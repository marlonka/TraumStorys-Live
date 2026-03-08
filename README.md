<p align="center">
  <img src="https://img.shields.io/badge/Gemini_Live_Agent_Challenge-Creative_Storyteller-8B5CF6?style=for-the-badge&logo=google&logoColor=white" alt="Gemini Live Agent Challenge" />
</p>

<h1 align="center">TraumStorys Live</h1>

<p align="center">
  <strong>A voice-first interactive bedtime story app powered by Gemini Live API.</strong><br/>
  Children speak to a magical storyteller who listens, responds in real-time, and paints the story as watercolor illustrations — all through voice.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Gemini_2.5_Flash-Live_Audio-4285F4?style=flat-square&logo=google&logoColor=white" alt="Gemini Live" />
  <img src="https://img.shields.io/badge/Image_Gen-Nano_Banana_2-34A853?style=flat-square&logo=google&logoColor=white" alt="Image Generation" />
  <img src="https://img.shields.io/badge/React_19-Vite_6-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Cloud_Run-FastAPI-FF6F00?style=flat-square&logo=googlecloud&logoColor=white" alt="Cloud Run" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License" />
</p>

---

## The Idea

Every child deserves a bedtime story that's *theirs* — starring characters they choose, unfolding in directions they decide, told in the language they speak.

**TraumStorys Live** replaces the screen-tap storybook with a voice conversation. A child taps the moon, says *"Tell me a story about a brave little fox"*, and Traumi — a warm, gentle AI storyteller — begins weaving a personalized tale in real-time. The child shapes the story at every turn (*"The fox should fly!"*), and as the narrative unfolds, watercolor illustrations appear on screen, painted live by AI.

No reading required. No buttons to press. Just a child's voice and imagination.

## How It Works

```
Child speaks into mic
        │
        ▼
┌──────────────────┐     PCM 16kHz mono      ┌──────────────────────────┐
│   Browser Audio   │ ──────────────────────► │   FastAPI WebSocket      │
│   (AudioWorklet)  │                         │   /ws/story              │
└──────────────────┘                          └────────────┬─────────────┘
        ▲                                                  │
        │  PCM 24kHz                                       │ Bidirectional
        │  (Traumi's voice)                                │ Audio Stream
        │                                                  ▼
┌──────────────────┐                          ┌──────────────────────────┐
│  AudioContext     │ ◄─────────────────────  │  Gemini Live API         │
│  Playback         │                         │  gemini-live-2.5-flash   │
└──────────────────┘                          │  -native-audio           │
        ▲                                     └────────────┬─────────────┘
        │                                                  │
        │  Base64 image                                    │ Function Call:
        │                                                  │ generate_illustration()
┌──────────────────┐                          ┌────────────▼─────────────┐
│  StoryCanvas      │ ◄─────────────────────  │  Nano Banana 2           │
│  (Illustration)   │      512px watercolor   │  gemini-3.1-flash-image  │
└──────────────────┘                          └──────────────────────────┘
```

### The Voice Pipeline

1. **AudioWorklet** captures mic input at 48kHz, downsamples to 16kHz mono PCM Int16
2. Raw audio bytes stream over a single WebSocket to the FastAPI backend
3. Backend pipes audio directly into **Gemini Live API** (`gemini-live-2.5-flash-native-audio`)
4. Gemini responds with audio (Traumi's voice at 24kHz PCM) streamed back to the browser
5. When the story reaches a visual moment, Gemini calls `generate_illustration()` — a tool that triggers **Nano Banana 2** (`gemini-3.1-flash-image-preview`) to generate a 512px watercolor illustration
6. The illustration streams to the frontend and reveals with a cinematic animation

### Why Gemini Live API?

This app needs **real-time, bidirectional voice** — not request/response. Children don't wait for loading spinners. Gemini Live API gives us:

- **Native audio input/output** — no STT/TTS roundtrip, Gemini hears and speaks directly
- **Voice Activity Detection** tuned for children — high start sensitivity (catches soft voices), low end sensitivity (waits through pauses), 1500ms silence threshold (kids think slowly)
- **Function calling mid-conversation** — Gemini decides when to paint illustrations, without interrupting the story flow
- **Session resumption** — stories can last 30+ minutes; `session_resumption_update` handles reconnection transparently

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Voice AI** | Gemini Live API (`gemini-live-2.5-flash-native-audio`) | Real-time bidirectional voice with function calling |
| **Image Gen** | Nano Banana 2 (`gemini-3.1-flash-image-preview`) | Fast, high-quality illustration generation |
| **Backend** | Python 3.12 · FastAPI · Uvicorn | Async WebSocket bridge between browser and Gemini |
| **Frontend** | React 19 · TypeScript · Vite 6 · Tailwind CSS v4 | Zero-dependency UI with canvas-rendered moon, AudioWorklet audio pipeline |
| **Deploy** | Google Cloud Run | Session-affinity, 3600s timeout for long stories, no CPU throttling |
| **Auth** | Google Cloud ADC | Application Default Credentials — no API keys in the app |

## Quick Start

### Prerequisites

- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) with a project that has Vertex AI API enabled
- Python 3.12+
- Node.js 22+

### 1. Clone and configure

```bash
git clone https://github.com/MarlonKr/TraumStorys-Live.git
cd TraumStorys-Live

cp .env.example .env
# Edit .env with your GCP project ID
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Authenticate with GCP
gcloud auth application-default login

# Start the backend
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — tap the moon to begin.

### 4. Deploy to Cloud Run

```bash
export GCP_PROJECT_ID=your-project-id
chmod +x clouddeploy.sh
./clouddeploy.sh
```

## Project Structure

```
traumstorys-live/
├── backend/
│   └── app/
│       ├── config.py           # Pydantic settings (models, regions, voice)
│       ├── main.py             # FastAPI app, /ws/story endpoint, static serving
│       ├── live_session.py     # Gemini Live API session manager
│       ├── image_generator.py  # Nano Banana 2 wrapper
│       └── ws_handler.py       # WebSocket bridge (browser ↔ Gemini)
├── frontend/
│   ├── public/
│   │   └── audio-capture-worklet.js  # 48kHz→16kHz downsampling processor
│   └── src/
│       ├── App.tsx             # State machine (idle → connecting → active → finished)
│       ├── components/
│       │   ├── MicButton.tsx       # Moon button with phase-aware states
│       │   ├── MoonCanvas.tsx      # Canvas-rendered moon with per-pixel sphere lighting
│       │   ├── StarryBackground.tsx # 100 deterministic stars + rare shooting stars
│       │   ├── StoryCanvas.tsx     # Illustration display with cinematic reveal
│       │   ├── TranscriptOverlay.tsx # Floating subtitles
│       │   └── Waveform.tsx        # Aurora-style audio visualization
│       ├── hooks/
│       │   ├── useWebSocket.ts     # Binary/text WebSocket routing
│       │   ├── useAudioCapture.ts  # AudioWorklet mic capture
│       │   └── useAudioPlayback.ts # PCM 24kHz playback with AnalyserNode
│       └── styles/
│           └── index.css           # Tailwind v4 theme + all animations
├── Dockerfile                  # Multi-stage: Node build + Python runtime
├── clouddeploy.sh             # One-command Cloud Run deployment
└── .env.example
```

## Design Philosophy

**Voice-first, screen-second.** The UI exists to enhance the audio experience, not replace it. The screen shows a night sky with a breathing moon — calming, not distracting. When illustrations appear, they fade in gently like pages of a storybook turning. The entire interface can be used without looking at the screen.

**Children's attention is sacred.** No loading states that break immersion. No error popups. No buttons during the story. The WebSocket stays open, audio streams continuously, and if the connection drops, session resumption reconnects silently.

**The moon is the interface.** One element. Tap to start, tap to stop. The moon breathes while idle, pulses with orbital particles while listening, and glows with aurora ribbons while Traumi speaks. Every state is communicated through the moon's behavior — no text labels needed.

## Traumi — The Storyteller

Traumi is configured via a detailed system instruction that defines personality, story structure, and pacing:

- **Multilingual** — automatically matches the child's language (German, English, or any language the child speaks)
- **5-phase story arc**: Greeting → Discovery → Narrating → Decision Points → Sleepy Ending
- **Adaptive pacing** — slower for mystery, faster for excitement, very gentle for the ending
- **Sound effects** in narration: *"Whoooosh went the wind!"*, *"Splish splash!"*
- **Tool calling** — calls `generate_illustration()` at visual moments and `signal_story_phase()` to update the UI phase

## License

MIT — built for the [Gemini Live Agent Challenge](https://ai.google.dev/competition/projects/live-agent-challenge).

---

<p align="center">
  <em>Built with genuine care by Marlon — because every child's imagination deserves a voice.</em>
</p>
