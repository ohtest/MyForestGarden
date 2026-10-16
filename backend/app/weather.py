from typing import Optional

import httpx

RAIN_CODES = set(range(51, 68)) | set(range(80, 83))
STORM_CODES = set(range(95, 100))
SNOW_CODES = set(range(71, 78)) | {85, 86}
FOG_CODES = {45, 48}

LABELS = {
    "snow": "下雪了，炉火正旺",
    "rain": "下雨了，我们在伞下说",
    "wind": "风有点大，先到小屋里",
    "autumn": "秋日正好",
}

PLATES = {
    "clear": "clear",
    "partly": "clear",
    "cloudy": "cloudy",
    "fog": "cloudy",
    "rain": "rain",
    "storm": "rain",
    "snow": "snow",
}


def classify(code: int, wind_kmh: float) -> str:
    if code in SNOW_CODES:
        return "snow"
    if code in RAIN_CODES or code in STORM_CODES:
        return "rain"
    if wind_kmh >= 32:
        return "wind"
    return "autumn"


def classify_sky(code: int, cloud_cover: Optional[float]) -> str:
    if code in SNOW_CODES:
        return "snow"
    if code in STORM_CODES:
        return "storm"
    if code in RAIN_CODES:
        return "rain"
    if code in FOG_CODES:
        return "fog"
    if code == 3 or (cloud_cover is not None and cloud_cover >= 75):
        return "cloudy"
    if code in {1, 2} or (cloud_cover is not None and cloud_cover >= 30):
        return "partly"
    return "clear"


def intensity(code: int, precipitation: float) -> float:
    if code in {51, 56, 61, 66, 71, 77, 80, 85}:
        base = 0.35
    elif code in {53, 63, 73, 81}:
        base = 0.6
    elif code in {55, 57, 65, 67, 75, 82, 86} or code in STORM_CODES:
        base = 0.9
    else:
        base = 0.0
    return round(min(1.0, max(base, precipitation / 6.0)), 2)


async def fetch_weather(lat: Optional[float], lon: Optional[float]) -> dict:
    latitude = lat if lat is not None else 31.2304
    longitude = lon if lon is not None else 121.4737
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "weather_code,wind_speed_10m,precipitation,temperature_2m,cloud_cover,is_day",
        "timezone": "auto",
        "wind_speed_unit": "kmh",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            current = response.json().get("current") or {}
            code = int(current.get("weather_code") or 0)
            wind = float(current.get("wind_speed_10m") or 0)
            cloud = current.get("cloud_cover")
            cloud = float(cloud) if cloud is not None else None
            precipitation = float(current.get("precipitation") or 0)
            scene = classify(code, wind)
            sky = classify_sky(code, cloud)
            return {
                "ok": True,
                "scene": scene,
                "sky": sky,
                "plate": PLATES[sky],
                "windy": wind >= 28,
                "intensity": intensity(code, precipitation),
                "label": LABELS[scene],
                "temperature": current.get("temperature_2m"),
                "weather_code": code,
                "wind_kmh": wind,
                "cloud_cover": cloud,
                "is_day": current.get("is_day"),
            }
    except Exception:
        return {
            "ok": False,
            "scene": "autumn",
            "sky": "clear",
            "plate": "clear",
            "windy": False,
            "intensity": 0.0,
            "label": LABELS["autumn"],
            "temperature": None,
            "weather_code": None,
            "wind_kmh": None,
            "cloud_cover": None,
            "is_day": None,
        }
