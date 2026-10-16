import re

from .config import CRISIS_HOTLINES

CRISIS_PATTERNS = [
    r"自杀",
    r"想死",
    r"不想活",
    r"结束生命",
    r"自残",
    r"割腕",
    r"跳楼",
    r"伤害自己",
    r"杀死",
    r"活不下去",
]


def detect_crisis(text: str) -> bool:
    return any(re.search(pattern, text) for pattern in CRISIS_PATTERNS)


def crisis_reply() -> str:
    lines = "、".join(CRISIS_HOTLINES)
    return (
        "我很担心你现在的安全。你的痛苦是认真的，但这里不能替代现场救援。"
        "请马上联系身边可信任的人，或拨打："
        f"{lines}。"
        "如果有即时危险，请拨打 120 / 110。"
    )
