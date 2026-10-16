import uuid
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .config import LLM_PROVIDER, WEB_DIR
from .llm import (
    ModelUnavailable,
    active_model,
    deepseek_ready,
    generate_reply,
    glm_ready,
    openai_ready,
)
from .presence import take_presence
from .prompt_loader import build_system_message, skill_summaries
from .safety import crisis_reply, detect_crisis
from .weather import fetch_weather

app = FastAPI(title="Echo")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

sessions: dict[str, list[dict]] = {}


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_id: Optional[str] = None
    long_voice: bool = False
    period: str = ""


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    crisis: bool = False
    source: str = "deepseek"
    presence: str = "listening"


@app.get("/api/health")
async def health():
    return {
        "ok": True,
        "provider": LLM_PROVIDER,
        "model": active_model(),
        "deepseek": await deepseek_ready(),
        "openai": await openai_ready(),
        "glm": await glm_ready(),
        "skills": skill_summaries(),
    }


@app.get("/api/skills")
async def skills():
    return {"skills": skill_summaries()}


@app.get("/api/weather")
async def weather(lat: Optional[float] = None, lon: Optional[float] = None):
    return await fetch_weather(lat, lon)


@app.post("/api/session")
async def create_session():
    session_id = uuid.uuid4().hex[:12]
    sessions[session_id] = []
    return {"session_id": session_id}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    text = req.message.strip()
    if not text:
        raise HTTPException(status_code=400, detail="message 不能为空")

    session_id = req.session_id or uuid.uuid4().hex[:12]
    history = sessions.setdefault(session_id, [])

    if detect_crisis(text):
        reply = crisis_reply()
        history.extend(
            [
                {"role": "user", "content": text},
                {"role": "assistant", "content": reply},
            ]
        )
        return ChatResponse(
            session_id=session_id,
            reply=reply,
            crisis=True,
            source="safety",
            presence="comfort",
        )

    messages = [{"role": "system", "content": build_system_message()}, *history, {"role": "user", "content": text}]
    try:
        reply, source = await generate_reply(messages)
    except ModelUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    reply, presence = take_presence(reply, text, req.long_voice, req.period or "")

    history.extend(
        [
            {"role": "user", "content": text},
            {"role": "assistant", "content": reply},
        ]
    )
    if len(history) > 24:
        sessions[session_id] = history[-24:]

    return ChatResponse(
        session_id=session_id,
        reply=reply,
        crisis=False,
        source=source,
        presence=presence,
    )


if WEB_DIR.exists():
    app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
