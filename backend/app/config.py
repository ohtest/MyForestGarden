import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROMPTS_DIR = ROOT / "prompts"
SKILLS_DIR = ROOT / "skills"
WEB_DIR = ROOT / "web"


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_env_file(ROOT / ".env")
_load_env_file(ROOT.parent / ".env")

MOCK_LLM = os.getenv("ECHO_MOCK_LLM", "").lower() in {"1", "true", "yes"}

ZHIPU_API_KEY = (
    os.getenv("ZHIPUAI_API_KEY")
    or os.getenv("ZHIPU_API_KEY")
    or os.getenv("BIGMODEL_API_KEY")
    or ""
).strip()
ZHIPU_BASE_URL = os.getenv("ZHIPU_BASE_URL", "https://open.bigmodel.cn/api/paas/v4").rstrip("/")
GLM_MODEL = os.getenv("GLM_MODEL", "glm-5.3-flash")
DEEPSEEK_API_KEY = (os.getenv("DEEPSEEK_API_KEY") or "").strip()
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-flash")
OPENAI_API_KEY = (os.getenv("OPENAI_API_KEY") or "").strip()
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-6-luna")
LLM_PROVIDER = os.getenv("ECHO_LLM_PROVIDER", "deepseek").strip().lower()

CRISIS_HOTLINES = [
    "希望24热线 400-161-9995",
    "北京心理危机研究与干预中心 010-82951332",
]
