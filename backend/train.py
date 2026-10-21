"""
TrOCR Fine-Tuning Script Scaffold for Custom Handwriting Strokes
Project: IoT-Based Real-Time Handwriting Recognition and OLED Display

Usage:
    python train.py --dataset path/to/dataset.json --epochs 5 --batch_size 4

NOTE: Fine-tuning is compute-intensive. This script is intended to run as an offline
batch training process, NOT automatically during real-time web requests.
"""

import os
import io
import json
import base64
import argparse
from typing import List, Tuple
from PIL import Image
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import (
    TrOCRProcessor,
    VisionEncoderDecoderModel,
    AdamW,
    get_linear_schedule_with_warmup,
)


class HandwritingDataset(Dataset):
    def __init__(self, samples: List[dict], processor: TrOCRProcessor, max_target_length: int = 32):
        self.samples = samples
        self.processor = processor
        self.max_target_length = max_target_length

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        item = self.samples[idx]
        image_data = item.get("image_data") or item.get("image")
        label = item.get("ground_truth") or item.get("label") or ""

        # Decode base64 image or load local file
        if image_data.startswith("data:image"):
            _, b64 = image_data.split(",", 1)
            raw = base64.b64decode(b64)
            image = Image.open(io.BytesIO(raw)).convert("RGB")
        elif os.path.isfile(image_data):
            image = Image.open(image_data).convert("RGB")
        else:
            raise ValueError(f"Unable to resolve image source: {image_data[:30]}...")

        # Process image tensor
        pixel_values = self.processor(image, return_tensors="pt").pixel_values.squeeze(0)

        # Process label tokens
        labels = self.processor.tokenizer(
            label,
            padding="max_length",
            max_length=self.max_target_length,
            truncation=True,
            return_tensors="pt",
        ).input_ids.squeeze(0)

        # Replace padding token id with -100 so cross-entropy loss ignores it
        labels[labels == self.processor.tokenizer.pad_token_id] = -100

        return {"pixel_values": pixel_values, "labels": labels, "ground_truth": label}


def split_dataset(samples: List[dict], train_ratio: float = 0.8) -> Tuple[List[dict], List[dict]]:
    """Splits samples into training and validation sets deterministically."""
    import random
    rng = random.Random(42)
    shuffled = list(samples)
    rng.shuffle(shuffled)
    split_idx = int(len(shuffled) * train_ratio)
    return shuffled[:split_idx], shuffled[split_idx:]


def run_training(
    dataset_path: str,
    output_dir: str = "./fine_tuned_trocr",
    model_name: str = "microsoft/trocr-base-handwritten",
    epochs: int = 3,
    batch_size: int = 4,
    learning_rate: float = 5e-5,
):
    print(f"Loading dataset from: {dataset_path}")
    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    samples = data.get("samples", data)
    print(f"Total labelled samples found: {len(samples)}")

    if len(samples) < 10:
        print("Warning: Dataset contains fewer than 10 samples. Collect at least 50-100 samples for meaningful fine-tuning.")

    train_samples, val_samples = split_dataset(samples, train_ratio=0.8)
    print(f"Training split: {len(train_samples)} samples | Validation split: {len(val_samples)} samples")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training device: {device}")

    # Load processor and model
    processor = TrOCRProcessor.from_pretrained(model_name, use_fast=False)
    model = VisionEncoderDecoderModel.from_pretrained(model_name)
    model.to(device)

    # Set special token IDs required for TrOCR generation
    model.config.decoder_start_token_id = processor.tokenizer.cls_token_id
    model.config.pad_token_id = processor.tokenizer.pad_token_id
    model.config.vocab_size = model.config.decoder.vocab_size

    train_ds = HandwritingDataset(train_samples, processor)
    val_ds = HandwritingDataset(val_samples, processor) if val_samples else None

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)

    optimizer = AdamW(model.parameters(), lr=learning_rate)
    total_steps = len(train_loader) * epochs
    scheduler = get_linear_schedule_with_warmup(optimizer, num_warmup_steps=10, num_training_steps=total_steps)

    print("\nBeginning Fine-Tuning Loop...")
    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        for step, batch in enumerate(train_loader):
            optimizer.zero_grad()
            pixel_values = batch["pixel_values"].to(device)
            labels = batch["labels"].to(device)

            outputs = model(pixel_values=pixel_values, labels=labels)
            loss = outputs.loss
            loss.backward()

            optimizer.step()
            scheduler.step()
            total_loss += loss.item()

            if (step + 1) % 5 == 0 or (step + 1) == len(train_loader):
                print(f"Epoch {epoch}/{epochs} | Step {step+1}/{len(train_loader)} | Loss: {loss.item():.4f}")

        avg_loss = total_loss / max(1, len(train_loader))
        print(f"--> Epoch {epoch} complete. Average Loss: {avg_loss:.4f}")

    print(f"\nSaving fine-tuned checkpoint to: {output_dir}")
    os.makedirs(output_dir, exist_ok=True)
    model.save_pretrained(output_dir)
    processor.save_pretrained(output_dir)
    print("Fine-tuning completed successfully!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fine-tune TrOCR on custom handwriting dataset")
    parser.add_argument("--dataset", type=str, required=True, help="Path to exported dataset JSON file")
    parser.add_argument("--output_dir", type=str, default="./fine_tuned_trocr", help="Output directory for weights")
    parser.add_argument("--epochs", type=int, default=3, help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=4, help="Batch size")
    parser.add_argument("--lr", type=float, default=5e-5, help="Learning rate")
    args = parser.parse_args()

    run_training(
        dataset_path=args.dataset,
        output_dir=args.output_dir,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
    )

