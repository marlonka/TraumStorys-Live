import asyncio
import json
import logging

from fastapi import WebSocket, WebSocketDisconnect

from .image_generator import ImageGenerator
from .live_session import LiveSessionManager

logger = logging.getLogger(__name__)

image_gen = ImageGenerator()


async def websocket_endpoint(ws: WebSocket):
    """Single WebSocket: binary frames = audio, text frames = JSON control."""
    await ws.accept()
    logger.info("Client connected")

    session: LiveSessionManager | None = None

    async def send_json(msg: dict):
        await ws.send_text(json.dumps(msg))

    # --- Callbacks wired into LiveSessionManager ---

    async def on_audio(data: bytes):
        try:
            await ws.send_bytes(data)
        except Exception:
            pass

    async def on_transcript_in(text: str):
        await send_json({"type": "transcript_in", "text": text})

    async def on_transcript_out(text: str):
        await send_json({"type": "transcript_out", "text": text})

    async def on_interrupted():
        """Child interrupted Gemini — tell frontend to flush audio buffer."""
        await send_json({"type": "interrupted"})

    async def on_tool_call(name: str, args: dict) -> dict:
        if name == "generate_illustration":
            # Fire-and-forget: narration continues while image generates
            asyncio.create_task(
                _generate_and_send(ws, args.get("description", ""), args.get("scene_title", ""))
            )
            return {"status": "generating"}

        if name == "signal_story_phase":
            phase = args.get("phase", "narrating")
            await send_json({"type": "phase", "phase": phase})
            return {"status": "ok"}

        return {"status": "unknown_function"}

    try:
        while True:
            message = await ws.receive()

            if message.get("bytes"):
                # Binary frame → audio from mic
                if session:
                    await session.send_audio(message["bytes"])

            elif message.get("text"):
                data = json.loads(message["text"])
                msg_type = data.get("type")

                if msg_type == "start_session":
                    session = LiveSessionManager(
                        on_audio=on_audio,
                        on_transcript_in=on_transcript_in,
                        on_transcript_out=on_transcript_out,
                        on_tool_call=on_tool_call,
                        on_interrupted=on_interrupted,
                    )
                    await session.connect()
                    await send_json({"type": "session_started"})

                elif msg_type == "stop_session":
                    if session:
                        await session.disconnect()
                        session = None
                    await send_json({"type": "session_stopped"})

    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if session:
            await session.disconnect()


async def _generate_and_send(ws: WebSocket, description: str, scene_title: str):
    """Generate an illustration in background and push to client."""
    try:
        result = await image_gen.generate(description)
        if result:
            img_b64, mime = result
            await ws.send_text(json.dumps({
                "type": "illustration",
                "image": img_b64,
                "mime": mime,
                "title": scene_title,
            }))
    except Exception as e:
        logger.error(f"Illustration send failed: {e}")
