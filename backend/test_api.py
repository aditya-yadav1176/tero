import os
import sys

# Ensure backend directory is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import io
import time
import base64
from PIL import Image, ImageDraw, ImageFont
from fastapi.testclient import TestClient
from main import app

print("Initializing FastAPI TestClient (lifespan will load TrOCR once)...")
with TestClient(app) as client:
    print("\n--- 1. Testing GET /health ---")
    resp = client.get("/health")
    print(f"Status Code: {resp.status_code}")
    health = resp.json()
    print(f"Health Response: {health}")
    assert resp.status_code == 200
    assert health["model_loaded"] is True
    assert health["status"] == "healthy"
    print("Health check PASSED!")

    print("\n--- 2. Testing POST /recognize with Empty Canvas (Expect 400) ---")
    empty_img = Image.new("RGB", (300, 150), (255, 255, 255))
    buf = io.BytesIO()
    empty_img.save(buf, format="PNG")
    empty_b64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    resp_empty = client.post("/recognize", json={"image": empty_b64})
    print(f"Empty Canvas Status: {resp_empty.status_code}")
    print(f"Detail: {resp_empty.json()}")
    assert resp_empty.status_code == 400
    print("Empty canvas validation PASSED!")

    print("\n--- 3. Testing POST /recognize with Valid Handwritten Stroke ---")
    img = Image.new("RGB", (400, 180), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    # Draw clear word "OK"
    draw.ellipse([60, 40, 120, 120], outline=(15, 15, 20), width=8)
    draw.line([150, 30, 150, 130], fill=(15, 15, 20), width=8)
    draw.line([150, 80, 200, 35], fill=(15, 15, 20), width=8)
    draw.line([165, 68, 205, 125], fill=(15, 15, 20), width=8)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64_str = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

    t0 = time.time()
    resp_rec = client.post("/recognize", json={"image": b64_str})
    elapsed = time.time() - t0
    print(f"Recognize Status: {resp_rec.status_code} in {elapsed:.2f}s")
    rec_data = resp_rec.json()
    print(f"Recognition Data: {rec_data}")
    assert resp_rec.status_code == 200
    assert "predicted_text" in rec_data
    assert rec_data["success"] is True
    print("Recognition inference PASSED!")

    print("\n--- 4. Testing OLED Hardware Staging Endpoints ---")
    resp_oled = client.post("/api/oled/message", json={"text": rec_data["predicted_text"]})
    print(f"OLED POST Status: {resp_oled.status_code}")
    oled_data = resp_oled.json()
    print(f"OLED Queued Data: {oled_data}")
    assert resp_oled.status_code == 200
    assert oled_data["is_new"] is True
    assert oled_data["text"] == rec_data["predicted_text"]

    resp_poll = client.get("/api/oled/message")
    print(f"OLED Poll Response: {resp_poll.json()}")
    assert resp_poll.json()["message_id"] == oled_data["message_id"]

    # Test ESP32 ACK
    resp_ack = client.post(f"/api/oled/ack?message_id={oled_data['message_id']}")
    print(f"OLED ACK Status: {resp_ack.status_code} -> {resp_ack.json()}")
    assert resp_ack.status_code == 200

    # Verify is_new is now False after ACK
    resp_poll_after = client.get("/api/oled/message")
    assert resp_poll_after.json()["is_new"] is False
    print("OLED ACK verification PASSED!")

print("\n========================================================")
print(" ALL 4 BACKEND INTEGRATION TESTS PASSED SUCCESSFULLY!")
print("========================================================")

