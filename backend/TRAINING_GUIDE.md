# Handwriting Recognition Training & Fine-Tuning Guide

This guide details the machine learning lifecycle for the **IoT-Based Real-Time Handwriting Recognition** project.

---

## 1. Distinction: Pretrained Inference vs. Model Training

It is critical in an engineering project to clearly distinguish:
1. **Pretrained Inference (Current Prototype):**
   - The system utilizes Microsoft's `microsoft/trocr-base-handwritten` Vision Transformer checkpoint, pretrained on the IAM Handwriting Database.
   - It performs real-time feedforward inference on individual characters and short words.
   - The model weights remain **static** during inference; correcting a prediction in the UI updates the ground-truth database, but does **not** dynamically modify the neural network weights on the fly.
2. **Dataset Collection (Active Stage):**
   - Users draw characters and words on the canvas.
   - When a prediction is verified or edited, the handwriting stroke image and its confirmed ground-truth label are stored in Cloud Firestore or local JSON exports.
3. **Downstream Fine-Tuning (Batch Script):**
   - Once sufficient labelled samples (recommended 100–500 samples) have been collected, the batch training script (`train.py`) fine-tunes the transformer encoder and decoder specifically for single-character and short-word canvas strokes.

---

## 2. Character vs. Line Recognition Considerations

- **The Challenge:** TrOCR (`trocr-base-handwritten`) was originally trained on text lines (full sentences with punctuation and line context). When presented with an isolated single character (e.g., `'A'` or `'5'`), the autoregressive language model decoder may output line-number prefixes or punctuation artifacts (such as `'2 A'` or `'0. 5.'`).
- **The Preprocessing Remedy:** Our `image_processing.py` module detects ink strokes, extracts a tight bounding box, centers the strokes on a normalized 384&times;128 canvas, and uses regex post-processing (`clean_trocr_prediction`) to strip line-level artifacts.
- **Future Alternative:** If single isolated character accuracy needs to reach >98% without large memory overhead, a dedicated lightweight CNN (such as MobileNetV3 trained on EMNIST / Chars74K) can serve as a character classifier, while TrOCR handles cursive and multi-word phrases.

---

## 3. How to Fine-Tune TrOCR with Collected Samples

### Step 1: Export Dataset
In the web application, navigate to the **Training & Testing** tab and click **Export Dataset (JSON)**. This downloads a structured JSON file containing all reviewed handwriting samples.

### Step 2: Split Train and Validation
`train.py` automatically implements an 80/20 train/validation split with fixed seed (`Random(42)`) to prevent data leakage and evaluate real generalization.

### Step 3: Run the Training Script
```powershell
cd backend
python train.py --dataset path/to/exported_dataset.json --epochs 5 --batch_size 4 --lr 5e-5
```

### Step 4: Evaluate Post-Training Accuracy
After training completes, point `MODEL_NAME` in `.env` to the saved checkpoint directory `./fine_tuned_trocr` and restart the backend server:
```powershell
uvicorn main:app --reload
```
Test the new checkpoint on held-out evaluation samples in the **Training & Testing** screen to measure empirical accuracy improvements.

