# IoT-Based Real-Time Handwriting Recognition and OLED Display (Tero)

A complete, fully functional, demonstrator prototype for real-time handwritten character and word recognition using **Microsoft's TrOCR (Transformer OCR)**, a **FastAPI** Python backend, a **React/TypeScript** canvas interface with **IndexedDB local persistence**, optional **Firebase Cloud Firestore**, and an **ESP32 + SSD1306 OLED** hardware display pipeline.

---

## 1. System Architecture

```
+---------------------------------------------------------------------------------+
|                               USER DRAWING CANVAS                               |
|  - Mobile Touch / Stylus / Mouse (HTML5 Canvas with Smooth Interpolation)       |
|  - Real-time Drawing, Undo, Pen Thickness, Clear, Touch Scroll Prevention      |
+---------------------------------------------------------------------------------+
                                         |
                                         | (Base64 PNG Data URL)
                                         v
+---------------------------------------------------------------------------------+
|                             FASTAPI PYTHON BACKEND                              |
|  - POST /recognize: Aspect-aware ink crop, centering, normalisation            |
|  - Microsoft TrOCR Vision Transformer (VisionEncoderDecoderModel)               |
|  - POST /api/oled/message & GET /api/oled/message (OLED Message Staging)        |
+---------------------------------------------------------------------------------+
                      |                                       |
                      | (Prediction & Latency)                | (Queued Message)
                      v                                       v
+-------------------------------------+     +-------------------------------------+
|        REACT / VITE FRONTEND        |     |        ESP32 + OLED DISPLAY         |
|  - Write Screen (Edit / Verify)     |     |  - Wi-Fi Polling Engine             |
|  - History Screen (IndexedDB Store) |     |  - SSD1306 128x64 I2C OLED          |
|  - Training & Testing Benchmark     |     |  - De-duplication & ACK             |
|  - JSON Export & Import             |     |  (Hardware Scaffold Ready)          |
+-------------------------------------+     +-------------------------------------+
```

---

## 2. Directory Structure

```text
├── backend/
│   ├── main.py                  # FastAPI server with /health, /recognize, OLED APIs
│   ├── recognition.py           # TrOCR processor and model loader singleton
│   ├── image_processing.py      # Stroke thresholding, aspect-ratio crop, normalisation
│   ├── test_api.py              # Automated backend integration test suite
│   ├── evaluate_samples.py      # Systematic benchmark suite across letters/words/digits
│   ├── train.py                 # Scaffold for offline PyTorch model fine-tuning
│   ├── TRAINING_GUIDE.md        # ML engineering lifecycle and evaluation docs
│   ├── requirements.txt         # Python dependencies
│   ├── .env.example             # Environment template
│   └── README.md                # Backend technical guide
├── frontend/
│   ├── src/
│   │   ├── components/          # Canvas, Header, Navigation, Modals
│   │   ├── screens/             # WriteScreen, HistoryScreen, TrainingScreen
│   │   ├── services/            # FastAPI client, IndexedDB store, Firebase sync
│   │   ├── types/               # TypeScript interfaces
│   │   ├── App.tsx              # Root component
│   │   └── main.tsx             # Entry point
│   ├── .env.example             # Frontend environment template
│   └── package.json             # NPM dependencies
├── esp32/
│   ├── main.ino                 # ESP32 C++ Arduino firmware
│   └── README.md                # Pinout, I2C wiring, and hardware checklist
├── firebase/
│   ├── firestore.rules          # Production security rules for Firestore
│   ├── storage.rules            # Production security rules for Cloud Storage
│   └── README.md                # Optional step-by-step Firebase setup guide
└── README.md                    # Root project documentation
```

---

## 3. Quick Start on Windows

### Prerequisites
- **Python 3.10+** (Tested on Python 3.11.0)
- **Node.js 18+** (Tested on Node v24.18.0)

---

### Step A: Start the Python Backend

1. Open a PowerShell terminal and navigate to the backend folder:
   ```powershell
   cd "d:\Study Material\Sem 7\IOEL\Tero\backend"
   ```
2. (Optional) Create and activate a virtual environment:
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```
3. Install dependencies:
   ```powershell
   pip install -r requirements.txt
   ```
4. Copy the environment file if not already present:
   ```powershell
   copy .env.example .env
   ```
5. Start the backend server:
   ```powershell
   uvicorn main:app --host 127.0.0.1 --port 8000 --reload
   ```
   *The TrOCR model (`microsoft/trocr-base-handwritten`) loads once on startup. Interactive API documentation is available at `http://127.0.0.1:8000/docs`.*

---

### Step B: Start the Frontend

1. Open a second PowerShell terminal and navigate to the frontend folder:
   ```powershell
   cd "d:\Study Material\Sem 7\IOEL\Tero\frontend"
   ```
2. Install npm packages:
   ```powershell
   npm install
   ```
3. Ensure `frontend/.env` exists:
   ```powershell
   copy .env.example .env
   ```
   *(By default, `VITE_API_BASE_URL` points to `http://127.0.0.1:8000`)*
4. Run the development server:
   ```powershell
   npm run dev
   ```
5. Open your browser at `http://localhost:5173`.
   *To draw with your finger on a mobile phone, open the local network URL displayed by Vite (e.g. `http://192.168.x.x:5173`) on any smartphone connected to the same Wi-Fi.*

---

## 4. Automated Testing Commands

All software components can be tested locally using automated test scripts:

### 1. Test Backend Endpoints (Health, Recognition, Empty Rejection, OLED Queuing)
```powershell
cd "d:\Study Material\Sem 7\IOEL\Tero\backend"
python test_api.py
```
*Expected: All 4 integration tests pass with status code 200/400 and verified responses.*

### 2. Run Systematic Recognition Benchmark
```powershell
cd "d:\Study Material\Sem 7\IOEL\Tero\backend"
python evaluate_samples.py
```
*Measures empirical accuracy across uppercase letters, lowercase words, digits, and multi-word phrases.*

### 3. Verify Frontend Production Build
```powershell
cd "d:\Study Material\Sem 7\IOEL\Tero\frontend"
npm run build
```
*Executes `tsc -b && vite build` and ensures zero TypeScript errors.*

---

## 5. Machine Learning Insights: Single Characters vs. Text Lines

- **The Challenge:** `microsoft/trocr-base-handwritten` was trained on IAM text lines (full sentences with punctuation, dates, and margin annotations). When presented with an isolated single character (e.g., `'A'` or `'5'`) padded inside a wide empty strip, TrOCR's autoregressive decoder often hallucinated line-number prefixes (`"0 0 A"` or `"25 B"`).
- **The Solution:** Our `image_processing.py` module detects stroke luminance, extracts a tight bounding box, and applies **aspect-ratio-aware cropping**:
  - For isolated characters / digits (aspect ratio < 2.5), it adds a natural 16px white margin and passes the cropped word directly to `TrOCRProcessor`.
  - Robust regex post-processing (`clean_trocr_prediction`) strips leading enumeration/index artifacts while strictly preserving valid digits and words.
- **Empirical Accuracy:** In our systematic 11-category evaluation suite (uppercase, lowercase, digits, two-word phrases), the optimized pipeline achieved **90.9% empirical accuracy** on CPU.

---

## 6. Zero-Cost Persistence: IndexedDB & Dataset Management

1. **Local-First IndexedDB:** All handwriting attempts, thumbnails, predictions, and ground-truth corrections are saved into browser **IndexedDB** (`tero_handwriting_db`).
2. **Survives Refreshes & Has No 5MB Cap:** Unlike `localStorage` (which fails after ~50 base64 images), IndexedDB has hundreds of megabytes of quota.
3. **Dataset Export (JSON):** Download your labelled handwriting dataset at any time from the History or Training screens.
4. **Dataset Import (JSON):** Easily import previously collected samples or datasets from other devices.
5. **Optional Firebase Firestore Sync:** If you configure Firebase keys in `frontend/.env`, the system automatically syncs records to Firestore and Storage. If not configured, it runs locally in 100% free mode.

---

## 7. ESP32 & OLED Hardware Staging

- **Status:** Hardware offline / not currently connected.
- **Firmware:** Located in `esp32/main.ino`.
- **Target Display:** SSD1306 0.96" I2C OLED (128&times;64, default address `0x3C`).
- **Wiring:**
  - OLED SDA &rarr; ESP32 GPIO 21
  - OLED SCL &rarr; ESP32 GPIO 22
  - OLED VCC &rarr; 3.3V
  - OLED GND &rarr; GND
- **Local Network Configuration:**
  In `esp32/main.ino`, set `SERVER_POLL_URL` to your laptop's local Wi-Fi IP (e.g., `http://192.168.1.15:8000/api/oled/message`). Do **not** use `127.0.0.1` in the microcontroller code, as `127.0.0.1` refers to the ESP32 itself.

---

## 8. Free-Tier Cloud Deployment Guide

### Deploying Frontend to Vercel (100% Free)
1. Push this repository to GitHub.
2. In [Vercel](https://vercel.com/), click **Add New > Project**.
3. Set **Root Directory** to `frontend`.
4. Build Command: `npm run build`, Output Directory: `dist`.
5. Under **Environment Variables**, set:
   - `VITE_API_BASE_URL`: The public HTTPS URL of your deployed Python backend.
6. Click **Deploy**.

### Backend Hosting Tradeoffs (Honest Assessment)
- **Local Development (Recommended for final-year demo):** Fast, ₹0 cost, zero network latency, no memory limits.
- **Hugging Face Spaces (Free Docker / Gradio / FastAPI Space):** Provides 16GB RAM for free on CPU, suitable for running TrOCR without timeout or out-of-memory errors.
- **Render / Railway Free Tiers:** Often enforce 512MB RAM limits, which may encounter Out-Of-Memory (OOM) kills when loading full 1.3GB PyTorch transformer models on CPU.
