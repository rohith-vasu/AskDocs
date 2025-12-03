FROM python:3.12-slim

# Install system dependencies + tesseract
RUN apt-get update && apt-get install -y \
    build-essential gcc g++ cmake \
    tesseract-ocr \
    tesseract-ocr-eng \
    libtesseract-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only dependency files first (for Docker cache)
COPY pyproject.toml ./
RUN pip install pip-tools
RUN pip-compile --output-file requirements.txt pyproject.toml

RUN pip install --no-cache-dir -r requirements.txt

# Copy app AFTER dependencies
COPY . .

CMD ["bash", "start.sh"]