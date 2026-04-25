from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class PostCreate(BaseModel):
    category: str
    name: str
    password: str
    title: str
    content: str

class PostOut(BaseModel):
    id: int
    category: str
    name: str
    title: str
    content: str
    created_at: Optional[datetime]

    class Config:
        from_attributes = True
