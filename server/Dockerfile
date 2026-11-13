# Drumless backend - FastAPI + demo pipeline.
# NOTE: keep this service on a CPU+RAM tier sized for Demucs (>= 4GB RAM,
# persistent disk for model cache + outputs).
FROM python:3.12-slim

WORKDIR /app

# ffmpeg for yt-dlp post-processing + export; deno is the JS runtime yt-dlp
# recommends for YouTube extraction (nodejs kept as a fallback). The node
# symlink matters because Debian installs the binary as `nodejs`, not `node`.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg nodejs curl ca-certificates unzip \
    && ln -sf "$(command -v nodejs)" /usr/local/bin/node \
    && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]