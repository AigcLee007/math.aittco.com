# 新项目后端 (FastAPI) 构建蓝图

如果你在另一个项目中也要用 FastAPI 构建自己的后端，并且希望使用跟这个项目一样的“指令格式”，你需要按照以下内容来构建。

## 1. 定义指令模型 (Pydantic)

在你的新项目后端代码里（例如 [models.py](file:///d:/%E7%BD%91%E7%AB%99%E5%BC%80%E5%8F%91/4K.aittco.com3%E6%9C%88%E6%9B%B4%E6%96%B0/3%E6%9C%883%E6%97%A5%E4%B8%8A%E7%BA%BF/4k-main/backend/models.py)），复制这个模型。它决定了你的前端该如何发指令：

```python
from pydantic import BaseModel, Field
from typing import List, Optional

class GenerateImageInstruction(BaseModel):
    # 这是前端发给后端的“指令”格式
    prompt: str = Field(..., description="生图提示词")
    images: List[str] = Field(default_factory=list, description="参考图Base64")
    model: str = Field(..., description="模型名称, 如 gemini-3-pro-image-preview")
    size: str = Field(default="1:1", description="尺寸")
    resolution: Optional[str] = Field(default="1k", description="分辨率")
    apiKey: str = Field(..., description="上游 Aittco 的 Key")
    baseURL: str = Field(..., description="上游 Aittco 的 URL (https://api.aittco.com)")
```

## 2. 定义后端接口 (FastAPI)

在你的 [main.py](file:///d:/%E7%BD%91%E7%AB%99%E5%BC%80%E5%8F%91/4K.aittco.com3%E6%9C%88%E6%9B%B4%E6%96%B0/3%E6%9C%883%E6%97%A5%E4%B8%8A%E7%BA%BF/4k-main/backend/main.py) 中，定义接收指令的端点：

```python
from fastapi import FastAPI
from models import GenerateImageInstruction

app = FastAPI()

@app.post("/api/generate-image")
async def handle_instruction(instruction: GenerateImageInstruction):
    # 这里的 instruction 就是前端发来的数据
    print(f"收到指令: {instruction.prompt}")
    
    # 在这里编写代码去请求 https://api.aittco.com/v1beta/...
    # 然后将结果流式返回给你的前端
    # (逻辑可以完全抄这个项目的 backend/services/image_service.py)
    return {"status": "processing"} 
```

## 3. 前端如何发送指令

有了上面的后端，你的另外一个项目（前端部分）发送的“指令”就是如下的 JSON 数据：

- **目标 URL**: `http://你的新后端地址/api/generate-image`
- **请求方法**: `POST`
- **指令内容 (Body)**:

```json
{
  "prompt": "一只在森林里喝茶的兔子",
  "model": "gemini-3-pro-image-preview",
  "apiKey": "你的Aittco_Key",
  "baseURL": "https://api.aittco.com",
  "size": "1:1",
  "resolution": "1k"
}
```

## 4. 为什么这样建议？

1.  **完全兼容**：如果你把这个 `4k-main/backend` 的核心逻辑搬过去，你甚至可以直接复用这个项目的前端界面（改个接口地址就行）。
2.  **自主可控**：你可以在 `handle_instruction` 逻辑里加入你自己的逻辑（比如检查用户余额、保存图片到你自己的硬盘等）。
