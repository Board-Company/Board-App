from pydantic import BaseModel
from typing import Optional

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class TokenData(BaseModel):
    username: Optional[str] = None

class User(BaseModel):
    username: str
    email: Optional[str] = None
    disabled: Optional[bool] = None
    picture: Optional[str] = None
    auth_provider: Optional[str] = None

class UserInDB(User):
    hashed_password: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    full_name: Optional[str] = None

class GoogleAuthRequest(BaseModel):
    token: str

class GoogleUser(BaseModel):
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None 