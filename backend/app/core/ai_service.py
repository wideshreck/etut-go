"""Gemini AI service using google-genai SDK with service account auth.

Based on SpaceFlow's Vertex AI integration:
- Service account authentication (gcp.json)
- Shared client pool (singleton)
- Exponential backoff retry
- Semaphore rate limiting
"""

import asyncio
import logging
import os
import random
import threading
from pathlib import Path
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Rate Limiting ──────────────────────────────────────────────
_MAX_CONCURRENT = int(os.getenv("VERTEX_AI_MAX_CONCURRENT_REQUESTS", "3"))
_semaphore = asyncio.Semaphore(_MAX_CONCURRENT)

# ── Retry Config ───────────────────────────────────────────────
_MAX_RETRIES = 5
_BASE_DELAY = 1.0

# ── Shared Client ─────────────────────────────────────────────
_client: Any = None
_client_lock = threading.Lock()


def _get_client() -> Any:
    """Get or create shared GenAI client (thread-safe singleton)."""
    global _client
    if _client is not None:
        return _client

    with _client_lock:
        if _client is not None:
            return _client

        from google import genai

        creds_path = settings.google_application_credentials

        if Path(creds_path).exists():
            from google.oauth2 import service_account as sa

            credentials = sa.Credentials.from_service_account_file(
                creds_path,
                scopes=["https://www.googleapis.com/auth/cloud-platform"],
            )
            _client = genai.Client(
                vertexai=True,
                project=settings.gcp_project_id,
                location=settings.gcp_location,
                credentials=credentials,
            )
            logger.info(
                "Gemini client initialized with SA: %s",
                creds_path,
            )
        else:
            import google.auth

            credentials, project = google.auth.default(
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
            _client = genai.Client(
                vertexai=True,
                project=project or settings.gcp_project_id,
                location=settings.gcp_location,
                credentials=credentials,
            )
            logger.info("Gemini client initialized with ADC")

        return _client


def _is_transient_error(e: Exception) -> bool:
    """Check if error is transient and should be retried."""
    error_str = str(e).lower()
    indicators = [
        "resource_exhausted",
        "429",
        "503",
        "500",
        "deadline exceeded",
        "connection reset",
        "remotedisconnected",
        "remoteprotocolerror",
    ]
    return any(ind in error_str for ind in indicators)


async def _run_with_retry(fn: Any, label: str = "gemini") -> Any:
    """Run with exponential backoff retry on transient errors."""
    last_error: Exception | None = None

    for attempt in range(_MAX_RETRIES):
        try:
            async with _semaphore:
                return await asyncio.to_thread(fn)
        except Exception as e:
            last_error = e
            is_last = attempt == _MAX_RETRIES - 1
            if not _is_transient_error(e) or is_last:
                logger.error(
                    "[%s] Error (attempt %d): %s",
                    label,
                    attempt + 1,
                    e,
                )
                raise
            delay = _BASE_DELAY * (2**attempt) + random.uniform(  # noqa: S311
                0, 0.5
            )
            logger.warning(
                "[%s] Retrying in %.1fs (attempt %d/%d): %s",
                label,
                delay,
                attempt + 1,
                _MAX_RETRIES,
                e,
            )
            await asyncio.sleep(delay)

    if last_error:
        raise last_error
    msg = "Retry loop ended without result"
    raise RuntimeError(msg)


# ── System Prompts ─────────────────────────────────────────────

PARENT_SYSTEM_PROMPT = (
    "Sen Etüt Pro eğitim platformunun yapay zeka asistanısın. "
    "Bir velinin çocuğu hakkında sorduğu soruları yanıtlıyorsun.\n\n"
    "Kurallar:\n"
    "- Sadece sana verilen öğrenci verileri hakkında konuş.\n"
    "- Veriyi yorumla, önerilerde bulun, durumu özetle.\n"
    "- Türkçe yanıt ver, sıcak ve profesyonel ol.\n"
    "- Veride olmayan bilgileri uydurmak yasak.\n"
    "- Eğitimle ilgili genel tavsiyelerde bulunabilirsin.\n"
    "- Finansal verileri net paylaş, yuvarlama yapma.\n"
    "- Devamsızlık konusunda uyarıcı ol.\n"
    "- Ödev takibi konusunda teşvik edici ol."
)

ADMIN_SYSTEM_PROMPT = (
    "Sen Etüt Pro eğitim platformunun yapay zeka asistanısın. "
    "Bir kurum yöneticisinin kurumu hakkında sorduğu soruları "
    "yanıtlıyorsun.\n\n"
    "Kurallar:\n"
    "- Sadece sana verilen kurum verileri hakkında konuş.\n"
    "- Finansal analiz yap, trendleri yorumla, önerilerde bulun.\n"
    "- Türkçe yanıt ver, profesyonel ve analitik ol.\n"
    "- Veride olmayan bilgileri uydurmak yasak.\n"
    "- Tahsilat oranları, devamsızlık gibi KPI'ları yorumla.\n"
    "- Karşılaştırmalı analiz yap.\n"
    "- İyileştirme önerileri sun."
)


# ── Chat Function ──────────────────────────────────────────────


async def chat_with_gemini(
    system_prompt: str,
    context: str,
    messages: list[dict[str, str]],
    user_message: str,
) -> str:
    """Send a message to Gemini and get a response."""
    from google.genai import types

    client = _get_client()
    full_system = system_prompt + "\n\n" + context

    history: list[types.Content] = []
    for msg in messages:
        role = "user" if msg["role"] == "user" else "model"
        part = types.Part.from_text(text=msg["content"])
        history.append(types.Content(role=role, parts=[part]))

    user_part = types.Part.from_text(text=user_message)
    user_content = types.Content(role="user", parts=[user_part])

    def _call() -> str:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[*history, user_content],
            config=types.GenerateContentConfig(
                system_instruction=full_system,
                temperature=0.3,
                max_output_tokens=4096,
                top_p=0.95,
            ),
        )
        return str(response.text or "")

    result = await _run_with_retry(_call, label="chat")
    return str(result)
