import time
import logging
from typing import Optional, Dict, Any
import torch
from PIL import Image
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from image_processing import clean_trocr_prediction

logger = logging.getLogger("recognition")

class HandwritingRecognizer:
    def __init__(self):
        self.processor: Optional[TrOCRProcessor] = None
        self.model: Optional[VisionEncoderDecoderModel] = None
        self.model_name: str = ""
        self.device: str = "cpu"
        self.is_loaded: bool = False
        self.load_error: Optional[str] = None
        self.load_duration_seconds: float = 0.0

    def load(self, model_name: str = "microsoft/trocr-base-handwritten", device: Optional[str] = None) -> bool:
        """
        Loads the Hugging Face TrOCR model and processor once during startup.
        """
        if self.is_loaded and self.model_name == model_name:
            logger.info("Model %s already loaded.", model_name)
            return True

        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"

        self.model_name = model_name
        self.device = device
        t0 = time.time()
        logger.info("Loading TrOCR model '%s' on %s...", model_name, device)

        try:
            # use_fast=False is used to prevent tiktoken / sentencepiece mismatch on Windows
            self.processor = TrOCRProcessor.from_pretrained(model_name, use_fast=False)
            self.model = VisionEncoderDecoderModel.from_pretrained(model_name)
            self.model.to(device)
            self.model.eval()

            self.load_duration_seconds = round(time.time() - t0, 2)
            self.is_loaded = True
            self.load_error = None
            logger.info("Model loaded successfully in %.2fs", self.load_duration_seconds)
            return True
        except Exception as exc:
            self.is_loaded = False
            self.load_error = str(exc)
            logger.error("Failed to load model %s: %s", model_name, exc, exc_info=True)
            return False

    def predict(self, preprocessed_image: Image.Image, max_new_tokens: int = 25) -> Dict[str, Any]:
        """
        Runs handwriting recognition inference on a preprocessed PIL image.
        """
        if not self.is_loaded or self.model is None or self.processor is None:
            raise RuntimeError(f"Recognition model is not loaded. Error: {self.load_error or 'Not initialized'}")

        t0 = time.time()
        # Convert image to model pixel tensor
        pixel_values = self.processor(images=preprocessed_image, return_tensors="pt").pixel_values
        pixel_values = pixel_values.to(self.device)

        with torch.no_grad():
            generated_ids = self.model.generate(
                pixel_values,
                max_new_tokens=max_new_tokens,
                num_beams=1 # Fast greedy decoding for real-time interactive response
            )

        raw_prediction = self.processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        cleaned_prediction = clean_trocr_prediction(raw_prediction)
        duration_ms = round((time.time() - t0) * 1000, 2)

        return {
            "predicted_text": cleaned_prediction,
            "raw_prediction": raw_prediction,
            "inference_time_ms": duration_ms,
            "model_name": self.model_name,
            "device": self.device
        }

# Global singleton recognizer instance
recognizer = HandwritingRecognizer()
