import gradio as gr
from main import app as fastapi_app

# Create a clean Gradio interface that mounts the FastAPI endpoints
# Any HTTP request to /health, /recognize, /api/oled/message routes directly to FastAPI
with gr.Blocks(title="Tero Handwriting Recognition API") as demo:
    gr.Markdown("# ✍️ Tero Handwriting Recognition API")
    gr.Markdown("Real-time TrOCR inference backend for IoT Handwriting Recognition and OLED Display.")
    gr.Markdown("- **Health Check:** `/health`")
    gr.Markdown("- **Recognition Endpoint:** `POST /recognize`")
    gr.Markdown("- **ESP32 OLED Queue:** `/api/oled/message`")

# Mount Gradio app into FastAPI
app = gr.mount_gradio_app(fastapi_app, demo, path="/")
