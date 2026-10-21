import os
import sys

backend_path = r"d:\Study Material\Sem 7\IOEL\Tero\backend"
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

import time
from PIL import Image, ImageDraw, ImageFont, ImageOps
import numpy as np
from recognition import recognizer
from test_improvements import clean_improved

recognizer.load("microsoft/trocr-base-handwritten", device="cpu")

test_cases = [
    ("Uppercase", "A"),
    ("Uppercase", "B"),
    ("Uppercase", "M"),
    ("Lowercase", "cat"),
    ("Lowercase", "dog"),
    ("Lowercase", "apple"),
    ("Digit", "5"),
    ("Digit", "7"),
    ("Digit", "8"),
    ("Two-word", "good morning"),
    ("Two-word", "thank you"),
]

def render_sample(text: str, width=600, height=240):
    img = Image.new("RGB", (width, height), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(r"C:\Windows\Fonts\segoepr.ttf", 52)
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    if text_w > width - 60:
        width = text_w + 100
        img = Image.new("RGB", (width, height), (255, 255, 255))
        draw = ImageDraw.Draw(img)
    x = (width - text_w) // 2
    y = (height - text_h) // 2
    draw.text((x, y), text, font=font, fill=(15, 15, 20))
    return img

def preprocess_variant_b(image: Image.Image, padding=24):
    rgb_img = image.convert("RGB")
    gray = ImageOps.grayscale(rgb_img)
    np_gray = np.array(gray)
    mean_val = np.mean(np_gray)
    if mean_val < 128:
        np_gray = 255 - np_gray
        rgb_img = ImageOps.invert(rgb_img)
    ink_mask = np_gray < 240
    if not np.any(ink_mask):
        return None
    ymin, ymax = np.where(ink_mask.any(axis=1))[0][[0, -1]]
    xmin, xmax = np.where(ink_mask.any(axis=0))[0][[0, -1]]
    bbox_x1 = max(0, int(xmin - padding))
    bbox_y1 = max(0, int(ymin - padding))
    bbox_x2 = min(rgb_img.width, int(xmax + padding + 1))
    bbox_y2 = min(rgb_img.height, int(ymax + padding + 1))
    cropped = rgb_img.crop((bbox_x1, bbox_y1, bbox_x2, bbox_y2))
    
    # Add subtle white border so strokes don't touch image edge
    bordered = ImageOps.expand(cropped, border=12, fill="white")
    return bordered

print("\n--- Systematic Benchmark: Variant B + Robust Postprocessing ---")
correct_count = 0
for category, text in test_cases:
    img = render_sample(text)
    preprocessed = preprocess_variant_b(img)
    
    t0 = time.time()
    out = recognizer.predict(preprocessed)
    duration = time.time() - t0
    
    raw = out["raw_prediction"]
    cleaned = clean_improved(raw)
    
    is_match = (cleaned.lower().strip() == text.lower().strip())
    if is_match:
        correct_count += 1
    print(f"[{category:9}] Target: '{text:12}' | Raw: '{raw:14}' | Cleaned: '{cleaned:12}' | Match: {is_match} ({duration:.2f}s)")

acc = (correct_count / len(test_cases)) * 100
print(f"\nFinal Empirical Accuracy with Optimized Preprocessing: {acc:.1f}% ({correct_count}/{len(test_cases)})")
