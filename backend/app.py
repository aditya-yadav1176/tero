import io
import time
from PIL import Image
import gradio as gr
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from recognition import recognizer
from image_processing import preprocess_handwriting_image, EmptyCanvasError, InvalidImageError

# 1. Initialize recognition model
MODEL_NAME = "microsoft/trocr-base-handwritten"
recognizer.load(model_name=MODEL_NAME)

# 2. FastAPI app for Vercel and ESP32 REST API
api = FastAPI(title="Tero Handwriting API")

latest_oled_message = {
    "message_id": "initial-msg-000",
    "text": "Waiting for input...",
    "timestamp": time.time(),
    "is_new": False,
    "source": "system"
}

class Base64RecognizeRequest(BaseModel):
    image: str

@api.get("/health")
def health():
    return {
        "status": "healthy" if recognizer.is_loaded else "degraded",
        "model_loaded": recognizer.is_loaded,
        "model_name": recognizer.model_name or MODEL_NAME,
        "device": recognizer.device,
        "timestamp": time.time()
    }

@api.post("/recognize")
def recognize_api(payload: Base64RecognizeRequest):
    try:
        from image_processing import load_image_from_bytes_or_base64
        pil_img = load_image_from_bytes_or_base64(payload.image)
        preprocessed = preprocess_handwriting_image(pil_img)
        pred_text, raw_text, inf_time = recognizer.predict(preprocessed)
        
        # Update OLED queue
        global latest_oled_message
        latest_oled_message = {
            "message_id": f"msg-{int(time.time()*1000)}",
            "text": pred_text,
            "timestamp": time.time(),
            "is_new": True,
            "source": "web"
        }
        
        return {
            "success": True,
            "predicted_text": pred_text,
            "raw_prediction": raw_text,
            "inference_time_ms": round(inf_time, 2),
            "model_name": recognizer.model_name,
            "device": recognizer.device,
            "metadata": {}
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api.get("/api/oled/message")
def get_oled_message():
    return latest_oled_message

@api.post("/api/oled/ack")
def ack_oled_message():
    global latest_oled_message
    latest_oled_message["is_new"] = False
    return {"status": "acknowledged", "message_id": latest_oled_message["message_id"]}

# 3. Gradio Interface (what Hugging Face Gradio SDK needs)
def gradio_predict(img):
    if img is None:
        return "Please draw or upload an image."
    try:
        preprocessed = preprocess_handwriting_image(img)
        pred, _, _ = recognizer.predict(preprocessed)
        return pred
    except Exception as err:
        return f"Error: {err}"

demo = gr.Interface(
    fn=gradio_predict,
    inputs=gr.Image(type="pil", label="Draw / Upload Handwriting"),
    outputs=gr.Textbox(label="Predicted Text"),
    title="✍️ Tero Handwriting Recognition",
    description="Backend API running on Hugging Face Spaces. REST endpoints `/health`, `/recognize`, `/api/oled/message` are active."
)

# 4. Mount Gradio onto the FastAPI app so BOTH UI and REST APIs work on the same port!
app = gr.mount_gradio_app(api, demo, path="/")
