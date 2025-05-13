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
    lichess_username: Optional[str] = None
    lichess_rating: Optional[dict] = None

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

class LichessAuthRequest(BaseModel):
    code: str
    state: Optional[str] = None

class LichessUser(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    profile: Optional[dict] = None
    perfs: Optional[dict] = None  # Lichess ratings for different time controls 