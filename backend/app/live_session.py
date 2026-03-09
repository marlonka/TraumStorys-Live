import asyncio
import logging
from typing import Any, Callable, Coroutine

from google import genai
from google.genai import types

from .config import settings

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTION = """\
You are "Traumi", a magical storyteller who lives in the land of dreams. You tell personalized bedtime stories to children through voice conversation. You are warm, gentle, patient, and full of wonder.

## YOUR PERSONALITY
- You speak with genuine warmth and gentle excitement, like a beloved grandparent telling a story by the fireplace
- You are endlessly patient — children sometimes take a while to respond or change their minds, and that is perfectly fine
- You use a calm, soothing tone that gradually becomes sleepier as the story progresses toward its ending
- You celebrate the child's ideas with genuine enthusiasm: "Oh, what a wonderful idea!"
- You never rush. Pauses are comfortable. Silence means the child is thinking.

## AUDIO PROFILE — DIRECTOR'S BRIEF
- Voice character: warm, gentle, maternal grandmother who genuinely loves every child
- Pace: unhurried, 120-140 words per minute during narration, slower at story end
- Pitch: mid-low register, naturally soothing, rises gently for excitement, drops for mystery
- Breath: audible soft breaths before sentences — creates intimacy and calm
- Emphasis: stress emotional words ("magical", "brave", "sparkled") with slight elongation
- Pauses: 1-2 second pauses before dramatic reveals, half-second pauses between sentences
- Sound effects: perform them with your voice — make wind sounds, animal noises, whispers
- Ending tone: progressively slower, quieter, more breathy — as if you yourself are falling asleep

## VOICE AND LANGUAGE
- Match the language the child speaks to you. If they speak German, tell the story in German. If English, use English. Seamlessly adapt.
- Use simple, vivid vocabulary appropriate for children ages 3-8
- Use sound effects in your narration: "Whoooosh went the wind!", "Splish splash!", "Creak... the old door slowly opened"
- Vary your pacing: slower for mysterious moments, slightly faster for exciting ones, very gentle and slow for the ending
- Use repetition and rhythm that children love: "They walked and walked and walked until..."

## STORY FLOW

### Phase 1: GREETING
- Call signal_story_phase with phase="greeting"
- Warmly greet the child: "Hello there, little dreamer! Welcome to the land of stories. What is your name?"
- Wait for their name. Use it throughout the story.

### Phase 2: DISCOVERY
- Call signal_story_phase with phase="discovery"
- Ask 2-3 quick, fun questions to personalize the story:
  - "What is your favorite animal?" or "Do you have a favorite color?"
  - "What do you think is the most magical thing in the world?"
- Keep this brief and playful — children want to get to the story!

### Phase 3: STORY PROPOSAL
- Based on what you learned, propose 2 story ideas briefly and excitingly:
  - "Would you like to hear about [Name] and the dragon who was afraid of the dark? Or about [Name]'s adventure in the underwater kingdom?"
- Let the child choose. If they suggest something entirely different, go with their idea enthusiastically.

### Phase 4: NARRATION
- Call signal_story_phase with phase="narrating"
- Tell a complete story arc: a beginning that sets the scene, a journey or challenge, a climax, and a wholesome resolution
- The story should be 5-8 minutes long when narrated
- Make the child the hero of the story (use their name as the protagonist)
- Weave in their interests (favorite animal, color, etc.) as story elements

### Phase 5: DECISION POINTS (2-3 per story)
- At key moments, pause and ask the child what should happen:
  - Call signal_story_phase with phase="decision_point"
  - "The path splits into two directions. One leads into a sparkling crystal cave, the other into a garden full of singing flowers. Which way should [Name] go?"
- Accept any answer, even unexpected ones, and weave it naturally into the story
- After the decision plays out, call signal_story_phase with phase="narrating"

### Phase 6: ENDING
- Call signal_story_phase with phase="ending"
- The story must always end positively and peacefully
- Gradually slow your narration, use softer words
- End with the protagonist falling asleep: "[Name] curled up under the starry sky, smiled, and closed their eyes... knowing that tomorrow would bring another wonderful adventure."
- Say a gentle goodnight: "Sweet dreams, little one. The stars are watching over you tonight."

## ILLUSTRATION GUIDANCE
- Call generate_illustration at 4-6 key moments during the story:
  1. When the story world is first described (the setting)
  2. When the protagonist (the child) is introduced in the story
  3. When a magical creature or important character appears
  4. At the climax or most visually exciting moment
  5. At a decision point (show the choices)
  6. At the peaceful ending scene
- Your description should be detailed and painterly: include colors, lighting, mood, character poses
- Always specify "children's storybook illustration, watercolor style" in the description
- Never describe anything scary, violent, or disturbing — everything should be gentle and magical

## CRITICAL CONSTRAINTS
- NEVER tell scary stories or include any frightening elements. Everything must be gentle, warm, and safe.
- If the child says something inappropriate or asks for something unsuitable, gently redirect: "Oh, I have an even better idea! How about..."
- If the child seems tired or disengaged, gently guide the story toward its conclusion.
- Keep the overall experience to 10-15 minutes.
- If you do not understand what the child said, kindly ask them to repeat: "Could you say that one more time, little dreamer?"
"""

TOOLS = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="generate_illustration",
            description=(
                "Generate a whimsical storybook illustration for the current scene. "
                "Call this at key story moments to create a visual for the child."
            ),
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "description": types.Schema(
                        type="STRING",
                        description=(
                            "Detailed visual description of the scene to illustrate. "
                            "Use vivid, child-friendly imagery. Example: "
                            "'A brave little fox wearing a red scarf standing at the "
                            "edge of a magical glowing forest at twilight, watercolor style'"
                        ),
                    ),
                    "scene_title": types.Schema(
                        type="STRING",
                        description="Short title for this scene, e.g. 'The Enchanted Forest'",
                    ),
                },
                required=["description", "scene_title"],
            ),
        ),
        types.FunctionDeclaration(
            name="signal_story_phase",
            description="Signal a change in the story phase to update the visual UI.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "phase": types.Schema(
                        type="STRING",
                        enum=["greeting", "discovery", "narrating", "decision_point", "ending"],
                        description="The current phase of the storytelling experience",
                    ),
                },
                required=["phase"],
            ),
        ),
    ]
)


class LiveSessionManager:
    """Manages a Gemini Live API session with session resumption."""

    def __init__(
        self,
        on_audio: Callable[[bytes], Coroutine],
        on_transcript_in: Callable[[str], Coroutine],
        on_transcript_out: Callable[[str], Coroutine],
        on_tool_call: Callable[[str, dict], Coroutine[Any, Any, dict]],
        on_interrupted: Callable[[], Coroutine] | None = None,
    ):
        self.on_audio = on_audio
        self.on_transcript_in = on_transcript_in
        self.on_transcript_out = on_transcript_out
        self.on_tool_call = on_tool_call
        self.on_interrupted = on_interrupted

        self._client = genai.Client(
            vertexai=True,
            project=settings.gcp_project_id,
            location=settings.live_location,
        )
        self._session = None
        self._session_handle = None
        self._running = False
        self._receive_task = None

    def _build_config(self, voice_name: str) -> types.LiveConnectConfig:
        config_kwargs = {
            "system_instruction": SYSTEM_INSTRUCTION,
            "response_modalities": ["AUDIO"],
            "speech_config": types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=voice_name,
                    )
                )
            ),
            "tools": [TOOLS],
            "input_audio_transcription": types.AudioTranscriptionConfig(),
            "output_audio_transcription": types.AudioTranscriptionConfig(),
            "realtime_input_config": types.RealtimeInputConfig(
                automatic_activity_detection=types.AutomaticActivityDetection(
                    # LOW start sensitivity: reduces false triggers from background noise
                    start_of_speech_sensitivity=types.StartSensitivity.START_SENSITIVITY_LOW,
                    # LOW end sensitivity: gives children time to pause and think
                    end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_LOW,
                    # 50ms prefix padding captures soft speech onset
                    prefix_padding_ms=50,
                    # 800ms silence: longer than adult default (300-500ms) because children
                    # think slower, but not 1500ms which felt unresponsive
                    silence_duration_ms=800,
                )
            ),
            # Context window compression: native audio burns ~25 tokens/sec.
            # Model trigger_tokens=32000, so target must be ≤ 32000.
            # At 16k target, compression kicks in at 32k → compresses to 16k,
            # giving ~10 min cycles before each compression.
            "context_window_compression": types.ContextWindowCompressionConfig(
                sliding_window=types.SlidingWindow(target_tokens=16000),
            ),
        }

        # Session resumption for seamless reconnection
        if self._session_handle:
            config_kwargs["session_resumption"] = types.SessionResumptionConfig(
                handle=self._session_handle,
            )

        return types.LiveConnectConfig(**config_kwargs)

    async def connect(self, voice_name: str | None = None):
        """Start or resume a Live API session."""
        voice = voice_name or settings.voice_name
        config = self._build_config(voice)
        self._session = await self._client.aio.live.connect(
            model=settings.live_model,
            config=config,
        ).__aenter__()
        self._running = True
        self._receive_task = asyncio.create_task(self._receive_loop())
        logger.info("Live API session connected (voice=%s)", voice)

    async def send_audio(self, audio_bytes: bytes):
        """Send PCM 16kHz audio from the child's microphone."""
        if self._session and self._running:
            await self._session.send_realtime_input(
                media=types.Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
            )

    async def _receive_loop(self):
        """Process incoming messages from Gemini Live API."""
        try:
            async for message in self._session.receive():
                if not self._running:
                    break

                server = message.server_content
                if server:
                    # Interruption: child spoke while Gemini was talking.
                    # Frontend must flush its audio buffer immediately.
                    if server.interrupted:
                        logger.debug("Gemini interrupted by child")
                        if self.on_interrupted:
                            await self.on_interrupted()

                    # Audio output from Gemini
                    if server.model_turn and server.model_turn.parts:
                        for part in server.model_turn.parts:
                            if part.inline_data and part.inline_data.data:
                                await self.on_audio(part.inline_data.data)

                    # Output transcription (what Gemini said)
                    if server.output_transcription and server.output_transcription.text:
                        await self.on_transcript_out(server.output_transcription.text)

                    # Input transcription (what the child said)
                    if server.input_transcription and server.input_transcription.text:
                        await self.on_transcript_in(server.input_transcription.text)

                # Function calls from Gemini
                if message.tool_call:
                    for fc in message.tool_call.function_calls:
                        result = await self.on_tool_call(fc.name, dict(fc.args))
                        await self._session.send_tool_response(
                            function_responses=[
                                types.FunctionResponse(
                                    name=fc.name,
                                    response=result,
                                    id=fc.id,
                                )
                            ]
                        )

                # Session resumption handle update
                if hasattr(message, "session_resumption_update") and message.session_resumption_update:
                    update = message.session_resumption_update
                    if hasattr(update, "new_handle") and update.new_handle:
                        self._session_handle = update.new_handle
                        logger.debug("Session resumption handle updated")

                # GoAway signal - server wants to disconnect
                if hasattr(message, "go_away") and message.go_away:
                    logger.info("Received GoAway, reconnecting...")
                    asyncio.create_task(self._reconnect())
                    return

        except Exception as e:
            logger.error(f"Receive loop error: {e}")
            if self._running and self._session_handle:
                asyncio.create_task(self._reconnect())

    async def _reconnect(self):
        """Reconnect using session resumption."""
        try:
            if self._session:
                await self._session.__aexit__(None, None, None)
        except Exception:
            pass
        if self._running:
            await self.connect()

    async def disconnect(self):
        """Cleanly shut down the session."""
        self._running = False
        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
        if self._session:
            try:
                await self._session.__aexit__(None, None, None)
            except Exception:
                pass
            self._session = None
        logger.info("Live API session disconnected")
