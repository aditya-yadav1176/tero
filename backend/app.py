import gradio as gr
from main import app as fastapi_app

with gr.Blocks(title="Tero Handwriting Recognition API") as demo:
    gr.Markdown("# ✍️ Tero Handwriting Recognition API")
    gr.Markdown("Real-time TrOCR Vision Transformer inference backend.")
    gr.Markdown("- Check API health: [/health](/health)")

app = gr.mount_gradio_app(fastapi_app, demo, path="/gradio")

# Gradio expects demo.launch()
demo.launch()
