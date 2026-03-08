import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .ws_handler import websocket_endpoint

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="TraumStorys Live")

# WebSocket endpoint
app.websocket("/ws/story")(websocket_endpoint)


@app.get("/health")
async def health():
    return {"status": "ok"}


# Serve built frontend in production
static_dir = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
