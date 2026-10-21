FROM python:3.11-slim

# Create standard non-root user required by Hugging Face Spaces (UID 1000)
RUN useradd -m -u 1000 user

WORKDIR /home/user/app

# Install dependencies first for fast caching
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend application
COPY --chown=user . .

USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    HF_HOME=/tmp/cache

EXPOSE 7860

# Run FastAPI with uvicorn on port 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
