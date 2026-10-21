import io
import re
import base64
from typing import Tuple, Optional
import numpy as np
from PIL import Image, ImageOps

class EmptyCanvasError(ValueError):
    """Raised when the submitted image contains no discernible handwriting strokes."""
    pass

class InvalidImageError(ValueError):
    """Raised when the image format or payload cannot be parsed."""
    pass


def load_image_from_bytes_or_base64(data: bytes | str) -> Image.Image:
    """
    Parses either raw binary image bytes or a data URL base64 string
    (e.g., 'data:image/png;base64,iVBORw0KGgo...') into a PIL Image.
    """
    try:
        if isinstance(data, str):
            if "," in data:
                _, b64_str = data.split(",", 1)
            else:
                b64_str = data
            raw_bytes = base64.b64decode(b64_str)
        else:
            raw_bytes = data
            
        if len(raw_bytes) == 0:
            raise InvalidImageError("Image payload is empty.")
            
        if len(raw_bytes) > 10 * 1024 * 1024:
            raise InvalidImageError("Image size exceeds maximum 10MB limit.")
            
        img = Image.open(io.BytesIO(raw_bytes))
        img.load()
        return img
    except (base64.binascii.Error, IOError) as e:
        raise InvalidImageError(f"Failed to decode image data: {str(e)}")


def preprocess_handwriting_image(
    image: Image.Image,
    ink_threshold: int = 240,
    min_ink_pixels: int = 25,
    padding: int = 20
) -> Tuple[Image.Image, dict]:
    """
    Normalizes a handwriting image captured from an HTML5 canvas:
    1. Handles RGBA transparency by flattening onto solid white.
    2. Detects stroke luminance and inverts if background was drawn dark.
    3. Rejects empty canvases (< min_ink_pixels).
    4. Computes tight bounding box around the ink.
    5. Formats the stroke image for TrOCR's Vision Transformer encoder:
       - For isolated characters / words (aspect ratio < 2.5): crops with natural margin padding,
         avoiding excessive letterbox void which causes language decoder hallucinations.
       - For long lines / multi-word phrases (aspect ratio >= 2.5): scales to standard line strip.
    """
    # 1. Handle transparency and color mode
    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        alpha_img = image.convert("RGBA")
        background = Image.new("RGBA", alpha_img.size, (255, 255, 255, 255))
        composite = Image.alpha_composite(background, alpha_img)
        rgb_img = composite.convert("RGB")
    else:
        rgb_img = image.convert("RGB")

    # 2. Convert to grayscale for ink detection
    gray = ImageOps.grayscale(rgb_img)
    np_gray = np.array(gray)

    # Detect if canvas is inverted (white ink on black background)
    mean_val = np.mean(np_gray)
    if mean_val < 128:
        np_gray = 255 - np_gray
        rgb_img = ImageOps.invert(rgb_img)

    ink_mask = np_gray < ink_threshold
    ink_pixel_count = int(np.sum(ink_mask))

    if ink_pixel_count < min_ink_pixels:
        raise EmptyCanvasError("No handwriting strokes detected. Please draw a character or word.")

    # 3. Find bounding box of ink
    ymin, ymax = np.where(ink_mask.any(axis=1))[0][[0, -1]]
    xmin, xmax = np.where(ink_mask.any(axis=0))[0][[0, -1]]

    bbox_x1 = max(0, int(xmin - padding))
    bbox_y1 = max(0, int(ymin - padding))
    bbox_x2 = min(rgb_img.width, int(xmax + padding + 1))
    bbox_y2 = min(rgb_img.height, int(ymax + padding + 1))

    cropped = rgb_img.crop((bbox_x1, bbox_y1, bbox_x2, bbox_y2))
    crop_w, crop_h = cropped.size
    aspect = crop_w / max(1, crop_h)

    # 4. Aspect-ratio aware canvas formatting
    if aspect < 2.5:
        # Isolated characters, digits, or compact words:
        # Avoid huge empty horizontal letterbox strips which cause TrOCR to hallucinate line numbers.
        # Add a comfortable border around the cropped word so strokes don't touch edges.
        final_img = ImageOps.expand(cropped, border=16, fill="white")
    else:
        # Wide text line (e.g. multi-word phrases)
        target_h = 128
        target_w = max(384, int(target_h * aspect) + 32)
        fit_h = int(target_h * 0.78)
        fit_w = int(fit_h * aspect)
        if fit_w > target_w - 24:
            fit_w = target_w - 24
            fit_h = max(1, int(fit_w / aspect))

        resized = cropped.resize((fit_w, fit_h), Image.Resampling.LANCZOS)
        final_img = Image.new("RGB", (target_w, target_h), (255, 255, 255))
        paste_x = (target_w - fit_w) // 2
        paste_y = (target_h - fit_h) // 2
        final_img.paste(resized, (paste_x, paste_y))

    metadata = {
        "original_size": [image.width, image.height],
        "ink_pixel_count": ink_pixel_count,
        "bounding_box": [bbox_x1, bbox_y1, bbox_x2, bbox_y2],
        "preprocessed_size": [final_img.width, final_img.height],
        "aspect_ratio": round(aspect, 2)
    }

    return final_img, metadata


def clean_trocr_prediction(raw_text: str) -> str:
    """
    Cleans TrOCR line-level artifact prefixes/suffixes without deleting valid text.
    TrOCR is trained on IAM handwritten lines, which often contain line numbers,
    periods, leading/trailing punctuation, and enumeration artifacts.
    """
    text = raw_text.strip()
    if not text:
        return ""

    # Strip stray punctuation from both ends
    text = re.sub(r"^[\.\,\;\:\-\_\'\"\/\\]+", "", text).strip()
    text = re.sub(r"[\.\,\;\:\-\_\'\"\/\\]+$", "", text).strip()

    # If the text is purely a digit or integer, preserve it exactly
    if text.isdigit():
        return text

    # Handle hallucinated leading line/index artifacts (e.g. "0 0 A" -> "A", "25 B" -> "B", "2, cat" -> "cat")
    while True:
        m = re.match(r"^(\d{1,3}[\.\,\:\-\)]?\s+)(.*)$", text)
        if m:
            remainder = m.group(2).strip()
            if remainder:
                text = remainder
                continue
        break

    # Handle attached index digits like "22dog" -> "dog"
    m_attached = re.match(r"^\d{1,2}([a-zA-Z]+.*)$", text)
    if m_attached:
        text = m_attached.group(1).strip()

    # Handle repeated single-token artifacts like "5 . 5" or "8 8" or "M.M"
    # where the model repeats the same character across patches
    m_repeat = re.match(r"^([a-zA-Z0-9])[\s\.\,]+(\1)$", text)
    if m_repeat:
        text = m_repeat.group(1)

    # Clean stray punctuation once more after prefix cleanup
    text = re.sub(r"^[\.\,\;\:\-\_\'\"\/\\]+", "", text).strip()
    text = re.sub(r"[\.\,\;\:\-\_\'\"\/\\]+$", "", text).strip()
    text = re.sub(r"\s+", " ", text)
    return text.strip()
