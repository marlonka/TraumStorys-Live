from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    gcp_project_id: str = ""
    gcp_region: str = "europe-west1"

    # Live API
    live_model: str = "gemini-live-2.5-flash-native-audio"
    live_location: str = "europe-west1"
    voice_name: str = "Aoede"

    # Image generation (Nano Banana 2)
    image_model: str = "gemini-3.1-flash-image-preview"
    image_location: str = "global"

    class Config:
        env_file = ".env"


settings = Settings()
