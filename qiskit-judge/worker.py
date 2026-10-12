"""
FastAPI Server & Background Queue Worker for Qiskit Judging.
Provides /evaluate HTTP endpoint and optionally consumes jobs from Redis queue.
"""

import os
import sys
import json
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException, Header, Depends
from runner import run_evaluation

# Optional shared secret verification
JUDGE_SECRET = os.getenv("QISKIT_JUDGE_SECRET", "")

app = FastAPI(
    title="Qiskit Fall Fest 2026 Code Evaluation Service",
    version="1.0.0",
    docs_url="/docs" if os.getenv("ENV") != "production" else None,
)

class EvaluationRequest(BaseModel):
    problem_id: str = Field(..., alias="problemId")
    code: str
    mode: str = "run"  # 'run' (public only) or 'submit' (public + hidden)

    class Config:
        allow_population_by_field_name = True

def verify_token(authorization: Optional[str] = Header(None)):
    if not JUDGE_SECRET:
        return  # Open if no secret configured
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Bearer token")
    token = authorization.split(" ")[1]
    if token != JUDGE_SECRET:
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
        result = run_evaluation(
            problem_id=payload.problem_id,
            source_code=payload.code,
            mode=payload.mode,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("worker:app", host="0.0.0.0", port=port, reload=False)
