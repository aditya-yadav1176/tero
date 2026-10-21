import os
import gradio as gr
from fastapi import FastAPI
from main import app as fastapi_app

# Gradio allows mounting any FastAPI app directly!
# Any HTTP request to /health, /recognize, /api/oled/message routes directly to FastAPI.
demo = gr.mount_gradio_app(fastapi_app, gr.Blocks(title="Tero Handwriting API"), path="/gradio")

# Export app for Hugging Face Gradio runner
app = fastapi_app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
