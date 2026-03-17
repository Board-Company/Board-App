from pydantic import BaseModel 
from datetime import datetime

class MoveRequest(BaseModel):
    game_id: str
    move: str
    player_id: str
    timestamp: datetime 

class GameState(BaseModel): 
    game_id: str
    fen: str
    move_history: list[str]
    player_ids: list[str] 
    status: str
    timestamp: datetime 

