from .config import PROMPTS_DIR, SKILLS_DIR


def _parse_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---"):
        return {}, text.strip()
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text.strip()
    meta = {}
    for line in parts[1].splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        raw = value.strip()
        if raw.lower() in {"true", "false"}:
            meta[key.strip()] = raw.lower() == "true"
        else:
            meta[key.strip()] = raw
    return meta, parts[2].strip()


def load_system_prompt() -> str:
    path = PROMPTS_DIR / "system.md"
    return path.read_text(encoding="utf-8").strip()


def load_skills() -> list[dict]:
    skills = []
    if not SKILLS_DIR.exists():
        return skills
    for path in sorted(SKILLS_DIR.glob("*.md")):
        if path.name.lower() == "readme.md":
            continue
        meta, body = _parse_frontmatter(path.read_text(encoding="utf-8"))
        skill = {
            "id": meta.get("id") or path.stem,
            "name": meta.get("name") or path.stem,
            "enabled": meta.get("enabled", True),
            "body": body,
            "file": path.name,
        }
        skills.append(skill)
    return skills


def build_system_message() -> str:
    prompt = load_system_prompt()
    enabled = [s for s in load_skills() if s["enabled"] and s["body"]]
    if not enabled:
        return prompt
    blocks = [f"【Skill: {s['name']}】\n{s['body']}" for s in enabled]
    return prompt + "\n\n以下技能当前已启用，请按需使用：\n\n" + "\n\n".join(blocks)


def skill_summaries() -> list[dict]:
    return [
        {"id": s["id"], "name": s["name"], "enabled": s["enabled"], "file": s["file"]}
        for s in load_skills()
    ]
