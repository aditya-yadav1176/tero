import os
import time
import uuid
import logging
from contextlib import asynccontextmanager
from typing import Optional, List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load local environment variables
load_dotenv()

from image_processing import (
    load_image_from_bytes_or_base64,
    preprocess_handwriting_image,
    EmptyCanvasError,
    InvalidImageError,
)
from recognition import recognizer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("main")

# Configuration from env
MODEL_NAME = os.getenv("MODEL_NAME", "microsoft/trocr-base-handwritten")
DEVICE = os.getenv("DEVICE", None)
CORS_ORIGINS_STR = os.getenv("CORS_ORIGINS", "*")
CORS_ORIGINS: List[str] = [origin.strip() for origin in CORS_ORIGINS_STR.split(",") if origin.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load the model once
    logger.info("Initializing Handwriting Recognition service...")
    logger.info("Selected model: %s", MODEL_NAME)
    success = recognizer.load(model_name=MODEL_NAME, device=DEVICE)
    if success:
        logger.info("TrOCR model is ready for real-time inference.")
    else:
        logger.warning("TrOCR model failed to load during startup: %s", recognizer.load_error)
    yield
    # Shutdown
    logger.info("Shutting down Handwriting Recognition service.")


app = FastAPI(
    title="IoT Real-Time Handwriting Recognition API",
    description="Backend service for recognizing handwritten characters/words with TrOCR and queuing messages for ESP32 OLED.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in CORS_ORIGINS else CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory OLED message queue (prepares ESP32 hardware polling)
latest_oled_message = {
    "message_id": "initial-msg-000",
    "text": "Waiting for input...",
    "timestamp": time.time(),
    "is_new": False,
    "source": "system"
}


# Request / Response Schemas
class Base64RecognizeRequest(BaseModel):
    image: str = Field(..., description="Handwriting image as Base64 data URL or raw Base64 string")
    max_tokens: Optional[int] = Field(25, description="Maximum new tokens to generate")

class RecognizeResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    success: bool
    predicted_text: str
    raw_prediction: str
    inference_time_ms: float
    model_name: str
    device: str
    metadata: dict

class HealthResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    status: str
    model_loaded: bool
    model_name: str
    device: str
    load_duration_seconds: float
    error: Optional[str] = None
    timestamp: float

class OledMessageRequest(BaseModel):
    text: str = Field(..., max_length=128, description="Text to show on OLED display")
    source: Optional[str] = Field("web", description="Origin of display command")

class OledMessageResponse(BaseModel):
    message_id: str
    text: str
    timestamp: float
    is_new: bool
    source: str


@app.get("/")
async def root():
    return {
        "project": "Tero",
        "description": "IoT-Based Real-Time Handwriting Recognition and OLED Display API",
        "health": "/health",
        "docs": "/docs"
    }


@app.get("/health", response_model=HealthResponse)
async def get_health():
    """
    Returns server health and model loading status.
    """
    return HealthResponse(
        status="healthy" if recognizer.is_loaded else "degraded",
        model_loaded=recognizer.is_loaded,
        model_name=recognizer.model_name or MODEL_NAME,
        device=recognizer.device,
        load_duration_seconds=recognizer.load_duration_seconds,
        error=recognizer.load_error,
        timestamp=time.time()
    )


@app.post("/recognize", response_model=RecognizeResponse)
async def recognize_json(payload: Base64RecognizeRequest):
    """
    Accepts a handwriting canvas image (Base64 data URL), preprocesses it,
    and runs real inference through TrOCR.
    """
    if not recognizer.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Recognition model is not loaded: {recognizer.load_error or 'Initializing...'}"
        )

    try:
        pil_image = load_image_from_bytes_or_base64(payload.image)
        preprocessed, meta = preprocess_handwriting_image(pil_image)
        result = recognizer.predict(preprocessed, max_new_tokens=payload.max_tokens or 25)

        return RecognizeResponse(
            success=True,
            predicted_text=result["predicted_text"],
            raw_prediction=result["raw_prediction"],
            inference_time_ms=result["inference_time_ms"],
            model_name=result["model_name"],
            device=result["device"],
            metadata=meta
        )
    except EmptyCanvasError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except InvalidImageError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Inference failure: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Recognition failed during processing: {str(e)}"
        )


@app.post("/recognize/file", response_model=RecognizeResponse)
async def recognize_file(file: UploadFile = File(...)):
    """
    Accepts a handwriting image file (multipart/form-data upload)
    """
    if not recognizer.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Recognition model is not loaded."
        )

    try:
        content = await file.read()
        pil_image = load_image_from_bytes_or_base64(content)
        preprocessed, meta = preprocess_handwriting_image(pil_image)
        result = recognizer.predict(preprocessed)

        return RecognizeResponse(
            success=True,
            predicted_text=result["predicted_text"],
            raw_prediction=result["raw_prediction"],
            inference_time_ms=result["inference_time_ms"],
            model_name=result["model_name"],
            device=result["device"],
            metadata=meta
        )
    except EmptyCanvasError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except InvalidImageError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("File inference error: %s", e, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# --- ESP32 OLED Hardware Staging Endpoints ---

@app.get("/api/oled/message", response_model=OledMessageResponse)
async def get_latest_oled_message():
    """
    Polled by the ESP32 firmware to check for new recognized text to display on the OLED.
    """
    return OledMessageResponse(**latest_oled_message)


@app.post("/api/oled/message", response_model=OledMessageResponse)
async def set_oled_message(payload: OledMessageRequest):
    """
    Triggered by the frontend 'Send to OLED' action. Queues text for display.
    """
    global latest_oled_message
    new_msg_id = str(uuid.uuid4())[:8]
    latest_oled_message = {
        "message_id": new_msg_id,
        "text": payload.text.strip(),
        "timestamp": time.time(),
        "is_new": True,
        "source": payload.source or "web"
    }
    logger.info("Queued new message for OLED: '%s' (id: %s)", payload.text, new_msg_id)
    return OledMessageResponse(**latest_oled_message)


@app.post("/api/oled/ack")
async def ack_oled_message(message_id: str):
    """
    Called by ESP32 firmware after successfully displaying the message on the OLED.
    Marks is_new as False so it won't be re-displayed.
    """
    global latest_oled_message
    if latest_oled_message["message_id"] == message_id:
        latest_oled_message["is_new"] = False
        return {"status": "acknowledged", "message_id": message_id}
    return {"status": "ignored", "detail": "Message ID does not match current"}

