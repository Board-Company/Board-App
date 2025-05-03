from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import Optional
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
from supabase import create_client, Client
from schemas import TokenData, User, UserInDB
from dotenv import load_dotenv
from google.oauth2 import id_token
from google.auth.transport import requests
from loguru import logger

# Load environment variables
load_dotenv()

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-for-development-only")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")

# Make sure the Supabase URL and key are available
if not supabase_url or not supabase_key:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY environment variables must be set")

supabase: Client = create_client(supabase_url, supabase_key)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def verify_google_token(token: str):
    try:
        # Verify the token
        idinfo = id_token.verify_oauth2_token(
            token, requests.Request(), GOOGLE_CLIENT_ID)

        # Get user info from the token
        user_email = idinfo['email']
        user_name = idinfo.get('name', '')
        user_picture = idinfo.get('picture', '')

        # Check if user exists in database
        response = supabase.table("users").select("*").eq("email", user_email).execute()
        
        if not response.data:
            # Create new user if doesn't exist
            new_user = {
                "email": user_email,
                "username": user_name,
                "picture": user_picture,
                "auth_provider": "google"
            }
            response = supabase.table("users").insert(new_user).execute()
            user_data = response.data[0]
        else:
            user_data = response.data[0]

        return user_data
    except ValueError as e:
        # Invalid token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token",
            headers={"WWW-Authenticate": "Bearer"},
        )

# Security functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_user(username: str, supabase: Client):
    try:
        logger.info(f"Looking up user with username: {username}")
        response = supabase.table("users").select("*").eq("username", username).execute()
        logger.debug(f"Supabase response for user lookup: {response}")
        
        if response.data:
            user_dict = response.data[0]
            logger.info(f"User found: {user_dict}")
            return UserInDB(**user_dict)
        logger.warning(f"No user found with username: {username}")
        return None
    except Exception as e:
        logger.error(f"Error getting user: {str(e)}")
        return None

async def authenticate_user(username: str, password: str, supabase: Client):
    logger.info(f"Attempting to authenticate user: {username}")
    user = await get_user(username, supabase)
    
    if not user:
        logger.warning(f"Authentication failed: User not found - {username}")
        return False
        
    logger.debug(f"Verifying password for user: {username}")
    if not verify_password(password, user.hashed_password):
        logger.warning(f"Authentication failed: Invalid password for user - {username}")
        return False
        
    logger.info(f"Authentication successful for user: {username}")
    return user

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    
    user = await get_user(username=token_data.username, supabase=supabase)
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user 