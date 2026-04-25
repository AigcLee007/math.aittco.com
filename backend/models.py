from typing import List, Optional

from pydantic import BaseModel, Field, validator


class GenerateImageRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="Image prompt")
    images: List[str] = Field(default_factory=list, description="Optional base64 images")
    model: str = Field(..., description="Upstream model name")
    size: str = Field(default="1:1", description="Aspect ratio")
    resolution: Optional[str] = Field(default="1k", description="Requested resolution")
    apiKey: Optional[str] = Field(default=None, description="Optional upstream API key override")
    baseURL: str = Field(default="https://api.aittco.com", description="Upstream API host")
    userId: Optional[str] = Field(default=None, description="User identifier")

    @validator("prompt")
    def validate_prompt(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("prompt cannot be empty")
        return value

    @validator("baseURL")
    def validate_base_url(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("baseURL cannot be empty")
        return value.rstrip("/")

    @validator("apiKey")
    def validate_api_key(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("apiKey cannot be empty when provided")
        return value
