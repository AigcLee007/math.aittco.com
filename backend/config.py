from __future__ import annotations

import os
from typing import List


def get_env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name, default)
    return value.strip() if isinstance(value, str) else value


def parse_allowed_origins(raw_value: str | None) -> List[str]:
    if not raw_value:
        return ["http://localhost:3000"]
    return [origin.strip() for origin in raw_value.split(",") if origin.strip()]


def get_bool_env(name: str, default: bool = False) -> bool:
    value = get_env(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}
