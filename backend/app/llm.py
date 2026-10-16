import httpx

from .config import (
    DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL,
    DEEPSEEK_MODEL,
    GLM_MODEL,
    LLM_PROVIDER,
    MOCK_LLM,
    OPENAI_API_KEY,
    OPENAI_BASE_URL,
    OPENAI_MODEL,
    ZHIPU_API_KEY,
    ZHIPU_BASE_URL,
)


class ModelUnavailable(Exception):
    pass


def active_model() -> str:
    if MOCK_LLM:
        return "mock"
    if LLM_PROVIDER == "glm":
        return GLM_MODEL
    if LLM_PROVIDER == "openai":
        return OPENAI_MODEL
    return DEEPSEEK_MODEL


async def deepseek_ready() -> dict:
    if not DEEPSEEK_API_KEY:
        return {"ok": False, "has_key": False, "model": DEEPSEEK_MODEL}
    return {"ok": True, "has_key": True, "model": DEEPSEEK_MODEL, "base_url": DEEPSEEK_BASE_URL}


async def openai_ready() -> dict:
    if not OPENAI_API_KEY:
        return {"ok": False, "has_key": False, "model": OPENAI_MODEL}
    return {"ok": True, "has_key": True, "model": OPENAI_MODEL, "base_url": OPENAI_BASE_URL}


async def glm_ready() -> dict:
    if not ZHIPU_API_KEY:
        return {"ok": False, "has_key": False, "model": GLM_MODEL}
    return {"ok": True, "has_key": True, "model": GLM_MODEL, "base_url": ZHIPU_BASE_URL}


def _message_text(message: dict) -> str:
    content = message.get("content")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                parts.append(item.get("text") or item.get("content") or "")
        return "".join(parts).strip()
    return ""


async def generate_reply(messages: list[dict]) -> tuple[str, str]:
    if MOCK_LLM:
        return _mock_reply(messages), "mock"
    if LLM_PROVIDER == "glm":
        return await _generate_glm(messages)
    if LLM_PROVIDER == "openai":
        return await _generate_openai(messages)
    return await _generate_deepseek(messages)


async def _generate_glm(messages: list[dict]) -> tuple[str, str]:
    if not ZHIPU_API_KEY:
        raise ModelUnavailable("未配置智谱 API Key。请在 backend/.env 写入 ZHIPUAI_API_KEY。")

    payloads = [
        {
            "model": GLM_MODEL,
            "messages": messages,
            "temperature": 1,
            "top_p": 0.95,
            "max_tokens": 512,
            "reasoning_effort": "low",
            "thinking": {"type": "enabled", "clear_thinking": False},
            "stream": False,
        },
        {
            "model": GLM_MODEL,
            "messages": messages,
            "temperature": 1,
            "top_p": 0.95,
            "max_tokens": 512,
            "stream": False,
        },
    ]
    last_error = ""
    data = None
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            for payload in payloads:
                response = await client.post(
                    f"{ZHIPU_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {ZHIPU_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                if response.status_code < 400:
                    data = response.json()
                    break
                last_error = f"{response.status_code}：{response.text[:400]}"
                if response.status_code not in {400, 422}:
                    raise ModelUnavailable(f"GLM 调用失败 {last_error}")
    except ModelUnavailable:
        raise
    except Exception as exc:
        raise ModelUnavailable(f"调用 GLM-5.3-Flash 失败：{exc}") from exc
    if data is None:
        raise ModelUnavailable(f"GLM 调用失败 {last_error}")

    choices = data.get("choices") or []
    if not choices:
        raise ModelUnavailable("GLM 返回为空。")
    message = choices[0].get("message") or {}
    content = _message_text(message)
    if not content:
        raise ModelUnavailable("GLM 返回正文为空。")
    return content, "glm"


async def _generate_deepseek(messages: list[dict]) -> tuple[str, str]:
    if not DEEPSEEK_API_KEY:
        raise ModelUnavailable("未配置 DeepSeek API Key。请在 backend/.env 写入 DEEPSEEK_API_KEY。")

    payloads = [
        {
            "model": DEEPSEEK_MODEL,
            "messages": messages,
            "temperature": 1,
            "max_tokens": 512,
            "thinking": {"type": "disabled"},
            "stream": False,
        },
        {
            "model": DEEPSEEK_MODEL,
            "messages": messages,
            "temperature": 1,
            "max_tokens": 512,
            "stream": False,
        },
    ]
    return await _openai_chat(
        f"{DEEPSEEK_BASE_URL}/chat/completions",
        DEEPSEEK_API_KEY,
        payloads,
        "DeepSeek V4.1 Flash",
        "deepseek",
    )


async def _openai_chat(
    url: str,
    api_key: str,
    payloads: list[dict],
    label: str,
    source: str,
) -> tuple[str, str]:
    last_error = ""
    data = None
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            for payload in payloads:
                response = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                if response.status_code < 400:
                    data = response.json()
                    break
                last_error = f"{response.status_code}：{response.text[:400]}"
                if response.status_code not in {400, 422}:
                    raise ModelUnavailable(f"{label} 调用失败 {last_error}")
    except ModelUnavailable:
        raise
    except Exception as exc:
        raise ModelUnavailable(f"调用 {label} 失败：{exc}") from exc
    if data is None:
        raise ModelUnavailable(f"{label} 调用失败 {last_error}")
    choices = data.get("choices") or []
    if not choices:
        raise ModelUnavailable(f"{label} 返回为空。")
    content = _message_text(choices[0].get("message") or {})
    if not content:
        raise ModelUnavailable(f"{label} 返回正文为空。")
    return content, source


async def _generate_openai(messages: list[dict]) -> tuple[str, str]:
    if not OPENAI_API_KEY:
        raise ModelUnavailable("未配置 OpenAI API Key。请在 backend/.env 写入 OPENAI_API_KEY。")

    payloads = [
        {
            "model": OPENAI_MODEL,
            "messages": messages,
            "temperature": 1,
            "max_completion_tokens": 512,
            "reasoning_effort": "none",
            "stream": False,
        },
        {
            "model": OPENAI_MODEL,
            "messages": messages,
            "max_completion_tokens": 512,
            "stream": False,
        },
        {
            "model": OPENAI_MODEL,
            "messages": messages,
            "max_tokens": 512,
            "stream": False,
        },
    ]
    return await _openai_chat(
        f"{OPENAI_BASE_URL}/chat/completions",
        OPENAI_API_KEY,
        payloads,
        "GPT",
        "openai",
    )


def _mock_reply(messages: list[dict]) -> str:
    last = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    return (
        f"我听到了，「{last[:24]}」这件事对你来说并不轻松。"
        "我们先停在这份感受上，不必马上解决。"
        "此刻身体里哪一块最紧，或者脑子里反复出现的那句话是什么？"
    )
