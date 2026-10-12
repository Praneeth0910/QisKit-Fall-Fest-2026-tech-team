# Production Isolated Docker Sandbox for Qiskit Fall Fest 2026 Judge
FROM python:3.11-slim

# Prevent interactive prompts and Python bytecode/buffering issues
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/judge

# Install system dependencies (build-essential, cmake for quantum numerical libraries if needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged runner user
RUN useradd -m -u 1001 -s /bin/bash judgeuser

WORKDIR /judge

# Copy and install pinned requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy judge implementation
COPY . .

# Set strict permissions: code owned by root, unprivileged user has read/execute only
RUN chown -R root:root /judge && \
    chmod -R 755 /judge && \
    mkdir -p /tmp/sandbox && \
    chown -R judgeuser:judgeuser /tmp/sandbox && \
    chmod 700 /tmp/sandbox

# Switch to unprivileged user
USER judgeuser

EXPOSE 8000

# Default entrypoint starts the FastAPI judge evaluation service
CMD ["uvicorn", "worker:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
