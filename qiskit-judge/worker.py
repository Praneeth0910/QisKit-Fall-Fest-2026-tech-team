"""
FastAPI Server & Background Queue Worker for Qiskit Judging.
Provides /evaluate HTTP endpoint and optionally consumes jobs from Redis queue.
"""
import traceback
import os
import sys
import json
import hmac
import threading
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException, Header, Depends, Request
from fastapi.responses import JSONResponse
from runner import run_evaluation

# Optional shared secret verification
JUDGE_SECRET = os.getenv("QISKIT_JUDGE_SECRET", "")
MAX_REQUEST_BYTES = 128 * 1024
_evaluation_semaphore = threading.BoundedSemaphore(2)

if os.getenv("ENV") == "production" and not JUDGE_SECRET.strip():
    raise RuntimeError("QISKIT_JUDGE_SECRET must be configured in production.")

app = FastAPI(
    title="Qiskit Fall Fest 2026 Code Evaluation Service",
    version="1.0.0",
    docs_url="/docs" if os.getenv("ENV") != "production" else None,
)


@app.middleware("http")
async def enforce_request_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and content_length.isdigit() and int(content_length) > MAX_REQUEST_BYTES:
        return JSONResponse(
            status_code=413,
            content={"detail": "Request body is too large."},
        )
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > MAX_REQUEST_BYTES:
            return JSONResponse(
                status_code=413,
                content={"detail": "Request body is too large."},
            )
    request._body = bytes(body)
    return await call_next(request)

class EvaluationRequest(BaseModel):
    problem_id: str = Field(..., alias="problemId")
    code: str
    mode: str = "run"  # 'run' (public only) or 'submit' (public + hidden)

    class Config:
        populate_by_name = True

def verify_token(authorization: Optional[str] = Header(None)):
    if not JUDGE_SECRET.strip():
        raise HTTPException(status_code=503, detail="Judge authentication is unavailable.")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing or invalid Bearer token")
    if not hmac.compare_digest(token, JUDGE_SECRET):
        raise HTTPException(status_code=403, detail="Unauthorized judge secret")

@app.get("/health")
def health():
    return {"status": "ok", "service": "qiskit-judge", "version": "1.0.0"}

@app.post("/evaluate")
def evaluate(payload: EvaluationRequest, _auth=Depends(verify_token)):
    """
    Executes code evaluation against problem test suites in sandbox.
    """
    try:
        if payload.mode not in {"run", "submit"}:
            raise HTTPException(status_code=422, detail="Invalid evaluation mode.")
        if not _evaluation_semaphore.acquire(timeout=1):
            raise HTTPException(status_code=429, detail="Judge is busy.")
        try:
            result = run_evaluation(
                problem_id=payload.problem_id,
                source_code=payload.code,
                mode=payload.mode,
            )
        finally:
            _evaluation_semaphore.release()
        return result
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Judge evaluation failed.")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("worker:app", host="0.0.0.0", port=port, reload=False)
