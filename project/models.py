"""
数据模型定义
使用 Pydantic 进行请求参数验证
"""
from pydantic import BaseModel, Field, validator
from typing import List, Optional


class GenerateImageRequest(BaseModel):
    """生成图片请求模型"""
    prompt: str = Field(..., description="提示词，用户输入的文本描述", min_length=1)
    images: List[str] = Field(default_factory=list, description="图片 base64 数组（data URI格式）")
    model: str = Field(..., description="模型名称")
    size: str = Field(default="1:1", description="图片尺寸比例")
    resolution: Optional[str] = Field(default=None, description="分辨率，仅 Gemini 3 Pro Image 模型有效")
    thinkingLevel: Optional[str] = Field(default="MINIMAL", description="思考层级，仅 Gemini 3.1+ 有效")
    apiKey: str = Field(..., description="API Key，用于认证")
    baseURL: str = Field(..., description="API Base URL")
    userId: Optional[str] = Field(default=None, description="用户唯一标识，用于隔离历史记录")

    @validator('prompt')
    def validate_prompt(cls, v):
        if not v or not v.strip():
            raise ValueError('提示词不能为空')
        if len(v) > 8000:
            raise ValueError('提示词长度不能超过8000字符')
        return v.strip()

    @validator('baseURL')
    def validate_base_url(cls, v):
        if not v or not v.strip():
            raise ValueError('API Base URL 不能为空')
        # 去除末尾的斜杠
        return v.rstrip('/')

    @validator('apiKey')
    def validate_api_key(cls, v):
        if not v or not v.strip():
            raise ValueError('API Key 不能为空')
        return v.strip()

    class Config:
        allow_population_by_field_name = True
        json_schema_extra = {
            "example": {
                "prompt": "帮我设计一张赛博朋克风格的海报",
                "images": [],
                "model": "gemini-2.5-flash-image-exp",
                "size": "1:1",
                "resolution": "1k",
                "apiKey": "your-api-key-here",
                "baseURL": "https://api.example.com"
            }
        }


class OptimizePromptRequest(BaseModel):
    """优化提示词请求模型"""
    prompt: str = Field(..., description="原始提示词", min_length=1)
    apiKey: str = Field(..., description="API Key，用于认证")
    baseURL: str = Field(..., description="API Base URL")

    @validator('prompt')
    def validate_prompt(cls, v):
        if not v or not v.strip():
            raise ValueError('提示词不能为空')
        return v.strip()

    @validator('baseURL')
    def validate_base_url(cls, v):
        if not v or not v.strip():
            raise ValueError('API Base URL 不能为空')
        # 去除末尾的斜杠
        return v.rstrip('/')

    @validator('apiKey')
    def validate_api_key(cls, v):
        if not v or not v.strip():
            raise ValueError('API Key 不能为空')
        return v.strip()


class DescribeImageRequest(BaseModel):
    """图片描述请求模型"""
    image: str = Field(..., description="图片 base64 编码（data URI格式）")
    apiKey: str = Field(..., description="API Key，用于认证")
    baseURL: str = Field(..., description="API Base URL")

    @validator('image')
    def validate_image(cls, v):
        if not v or not v.strip():
            raise ValueError('图片不能为空')
        return v.strip()

    @validator('baseURL')
    def validate_base_url(cls, v):
        if not v or not v.strip():
            raise ValueError('API Base URL 不能为空')
        # 去除末尾的斜杠
        return v.rstrip('/')

    @validator('apiKey')
    def validate_api_key(cls, v):
        if not v or not v.strip():
            raise ValueError('API Key 不能为空')
        return v.strip()

