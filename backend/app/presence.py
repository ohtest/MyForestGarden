import re

PRESENCE = {"listening", "nod", "thinking", "agree", "comfort", "hold", "warmth"}
TAG = re.compile(r"\[\[presence:(listening|nod|thinking|agree|comfort|hold|warmth)\]\]", re.I)

COMFORT = ("难过", "委屈", "伤心", "哭", "失落", "心累", "撑不住", "好难受")
AGREE = ("我想通", "原来我", "我发现", "我愿意", "我可以试试", "我自己感觉")
WARMTH = ("睡不着", "好冷", "一个人", "熬夜", "空落落")


def take_presence(reply: str, text: str, long_voice: bool, period: str) -> tuple[str, str]:
    found = "listening"
    match = TAG.search(reply or "")
    if match:
        found = match.group(1).lower()
        reply = TAG.sub("", reply).strip()
    elif any(word in text for word in COMFORT):
        found = "comfort"
    elif any(word in text for word in AGREE):
        found = "agree"
    elif period == "late" and any(word in text for word in WARMTH):
        found = "warmth"

    if found not in PRESENCE:
        found = "listening"
    if long_voice and found == "listening":
        found = "hold"
    if period == "late" and found == "comfort":
        found = "warmth"
    return reply.strip(), found
