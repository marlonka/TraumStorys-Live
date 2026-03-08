import asyncio
import base64
import logging

from google import genai
from google.genai import types

from .config import settings

logger = logging.getLogger(__name__)

STYLE_PREFIX = (
    "Children's storybook illustration, whimsical watercolor style, "
    "soft warm colors, gentle lighting, friendly and magical atmosphere, "
    "suitable for ages 3-8. "
)


class ImageGenerator:
    def __init__(self):
        self._client = genai.Client(
            vertexai=True,
            project=settings.gcp_project_id,
            location=settings.image_location,
        )

    async def generate(self, description: str) -> tuple[str, str] | None:
        """Generate a storybook illustration. Returns (base64_png, mime_type) or None."""
        prompt = STYLE_PREFIX + description

        try:
            response = await asyncio.to_thread(
                self._client.models.generate_content,
                model=settings.image_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                    image_config=types.ImageConfig(
                        aspect_ratio="1:1",
                        image_size="512",
                        output_mime_type="image/png",
                    ),
                ),
            )

            if response.candidates and response.candidates[0].content.parts:
                for part in response.candidates[0].content.parts:
                    if part.inline_data and part.inline_data.data:
                        img_b64 = base64.b64encode(part.inline_data.data).decode()
                        return img_b64, part.inline_data.mime_type or "image/png"

            logger.warning("No image data in response")
            return None

        except Exception as e:
            logger.error(f"Image generation failed: {e}")
            return None
