from __future__ import annotations

import logging
from typing import Any, Dict

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import get_bool_env, get_env, parse_allowed_origins
from models import GenerateImageRequest

logger = logging.getLogger("banana-backend")
logging.basicConfig(level=get_env("BACKEND_LOG_LEVEL", "INFO"))

IMAGE_PROVIDER_API_HOST = get_env("IMAGE_PROVIDER_API_HOST", "https://api.aittco.com") or "https://api.aittco.com"
BACKEND_API_KEY = get_env("BACKEND_API_KEY") or get_env("GEMINI_API_KEY")
BACKEND_ALLOWED_ORIGINS = parse_allowed_origins(get_env("BACKEND_ALLOWED_ORIGINS"))
BACKEND_SKIP_SSL_VERIFY = get_bool_env("BACKEND_SKIP_SSL_VERIFY", default=False)
BACKEND_UPSTREAM_TIMEOUT_SECONDS = float(get_env("BACKEND_UPSTREAM_TIMEOUT_SECONDS", "900") or "900")

app = FastAPI(title="Banana Studio Image Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=BACKEND_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/")
async def root():
    return {"status": "running", "message": "Banana Studio Image Backend is active"}


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


def resolve_upstream_api_key(request: GenerateImageRequest) -> str:
    api_key = BACKEND_API_KEY or request.apiKey
    if not api_key:
        raise HTTPException(status_code=500, detail="Missing BACKEND_API_KEY or GEMINI_API_KEY")
    return api_key


async def make_request(api_url: str, payload: Dict[str, Any], headers: Dict[str, str]) -> httpx.Response:
    timeout = httpx.Timeout(timeout=BACKEND_UPSTREAM_TIMEOUT_SECONDS, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout, verify=not BACKEND_SKIP_SSL_VERIFY) as client:
        logger.info("Sending upstream request to %s", api_url)
        return await client.post(api_url, json=payload, headers=headers)


@app.post("/api/generate-image")
async def generate_image(request: GenerateImageRequest):
    model = request.model
    base_url = request.baseURL or IMAGE_PROVIDER_API_HOST
    api_url = f"{base_url}/v1beta/models/{model}:generateContent"

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": request.prompt}
                ]
            }
        ],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "imageConfig": {
                "imageSize": request.resolution.upper() if request.resolution else "1K",
                "aspectRatio": request.size or "1:1",
            }
        }
    }

    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": resolve_upstream_api_key(request),
    }

    try:
        response = await make_request(api_url, payload, headers)

        if response.status_code != 200:
            logger.error("Upstream error %s: %s", response.status_code, response.text)
            return JSONResponse(
                status_code=response.status_code,
                content={"detail": f"upstream error: {response.text}"},
            )

        data = response.json()
        img_data = None

        if "candidates" in data:
            parts = data["candidates"][0].get("content", {}).get("parts", [])
            for part in parts:
                if "inlineData" in part:
                    mime = part["inlineData"].get("mimeType", "image/png")
                    b64 = part["inlineData"].get("data")
                    img_data = f"data:{mime};base64,{b64}"
                    break

        if not img_data and "predictions" in data:
            pred = data["predictions"][0]
            mime = pred.get("mimeType", "image/png")
            b64 = pred.get("bytesBase64Encoded")
            img_data = f"data:{mime};base64,{b64}"

        if not img_data:
            logger.error("Unexpected upstream payload: %s", data)
            return JSONResponse(
                status_code=500,
                content={"detail": "no image data found in upstream response"},
            )

        return {"image": img_data, "status": "success"}

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="image generation timed out")
    except httpx.HTTPError as exc:
        logger.exception("Upstream request failed")
        raise HTTPException(status_code=502, detail=f"upstream request failed: {exc}") from exc
    except Exception as exc:
        logger.exception("Backend execution failed")
        raise HTTPException(status_code=500, detail=f"internal server error: {exc}") from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=3336)
