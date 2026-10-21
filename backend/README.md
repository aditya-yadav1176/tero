# IoT Handwriting Recognition Backend

FastAPI backend for real-time handwriting recognition using Hugging Face's `microsoft/trocr-base-handwritten` Vision Encoder-Decoder transformer model and ESP32 OLED communication staging.

---

## Architecture & Endpoints

### 1. `GET /health`
Returns system status, active inference device (CPU/CUDA), model load state, and startup duration.

### 2. `POST /recognize`
Accepts a JSON payload containing a Base64-encoded canvas image:
```json
{
  "image": "data:image/png;base64,iVBORw0KGgo...",
  "max_tokens": 25
}
```
**Response:**
```json
{
  "success": true,
  "predicted_text": "Cat",
  "raw_prediction": "2. Cat 2",
  "inference_time_ms": 1420.5,
  "model_name": "microsoft/trocr-base-handwritten",
  "device": "cpu",
  "metadata": {
    "original_size": [500, 250],
    "ink_pixel_count": 840,
    "bounding_box": [30, 40, 165, 110],
    "preprocessed_size": [384, 128]
  }
}
```

### 3. `POST /recognize/file`
Accepts multipart form file upload for testing images directly from Postman, curl, or scripts.

### 4. `GET /api/oled/message` & `POST /api/oled/message`
Provides message queuing for the ESP32 OLED display. The ESP32 firmware polls `GET /api/oled/message` to fetch newly recognized text.

---

## Local Setup on Windows

### 1. Activate or Create Virtual Environment (Optional)
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 2. Install Dependencies
```powershell
pip install -r requirements.txt
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```powershell
cp .env.example .env
```

### 4. Start the Server
```powershell
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive Swagger docs: `http://127.0.0.1:8000/docs`

