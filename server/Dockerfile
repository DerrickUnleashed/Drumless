# Drumless backend — FastAPI + demo pipeline.
# NOTE: keep this service on a CPU+RAM tier sized for Demucs (>= 4GB RAM,
# persistent disk for model cache + outputs).
FROM python:3.15-slim

WORKDIR /app

# ffmpeg for yt-dlp post-processing + export; nodejs is the JS runtime
# newer yt-dlp needs for YouTube extraction (input_handler auto-detects it).
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg nodejs && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]