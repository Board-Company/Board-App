from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from typing import Optional, Dict
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
import secrets
import hashlib
import base64
import httpx
from urllib.parse import urlencode
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

# Lichess OAuth Configuration
LICHESS_CLIENT_ID = os.getenv("LICHESS_CLIENT_ID", "your-client-id")
LICHESS_REDIRECT_URI = os.getenv("LICHESS_REDIRECT_URI", "http://localhost:8000/auth/lichess/callback")
LICHESS_AUTH_URL = "https://lichess.org/oauth"
LICHESS_TOKEN_URL = "https://lichess.org/api/token"
LICHESS_API_URL = "https://lichess.org/api"

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

logger.info(f"LICHESS_REDIRECT_URI: {LICHESS_REDIRECT_URI}")

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

def generate_code_verifier() -> str:
    """Generate a code verifier for PKCE."""
    code_verifier = secrets.token_urlsafe(32)
    return code_verifier

def generate_code_challenge(code_verifier: str) -> str:
    """Generate a code challenge from the verifier using SHA256."""
    sha256_hash = hashlib.sha256(code_verifier.encode('utf-8')).digest()
    code_challenge = base64.urlsafe_b64encode(sha256_hash).decode('utf-8').rstrip('=')
    return code_challenge

def get_lichess_auth_url(code_challenge: str, state: str) -> str:
    """Generate the Lichess authorization URL."""
    params = {
        'response_type': 'code',
        'client_id': LICHESS_CLIENT_ID,
        'redirect_uri': LICHESS_REDIRECT_URI,
        'scope': 'challenge:write board:play puzzle:read email:read',
        'code_challenge': code_challenge,
        'code_challenge_method': 'S256',
        'state': state
    }
    return f"{LICHESS_AUTH_URL}?{urlencode(params)}"

async def exchange_code_for_token(code: str, code_verifier: str) -> Dict:
    """Exchange the authorization code for an access token."""
    async with httpx.AsyncClient() as client:
        data = {
            'grant_type': 'authorization_code',
            'client_id': LICHESS_CLIENT_ID,
            'code': code,
            'code_verifier': code_verifier,
            'redirect_uri': LICHESS_REDIRECT_URI
        }
        response = await client.post(LICHESS_TOKEN_URL, data=data)
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange code for token"
            )
        return response.json()

async def get_lichess_user_info(access_token: str) -> Dict:
    """Get user information from Lichess API."""
    async with httpx.AsyncClient() as client:
        headers = {'Authorization': f'Bearer {access_token}'}
        response = await client.get(f"{LICHESS_API_URL}/account", headers=headers)
        logger.info(f"Lichess /account response: {response.text}")
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get user info from Lichess"
            )
        return response.json()

async def verify_lichess_token(code: str, code_verifier: str):
    """Verify Lichess token and get or create Lichess user."""
    try:
        # Exchange code for token
        token_data = await exchange_code_for_token(code, code_verifier)
        access_token = token_data['access_token']
        
        # Get user info from Lichess
        user_info = await get_lichess_user_info(access_token)
        
        # Extract user data
        username = user_info.get('username')
        if not username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user data from Lichess: missing username"
            )
        
        # Try to find Lichess user by username
        response = supabase.table("lichess_users").select("*").eq("username", username).execute()
        
        if not response.data:
            # Create new lichess_users row if doesn't exist
            new_lichess_user = {
                "username": username,
                "access_token": access_token
            }
            response = supabase.table("lichess_users").insert(new_lichess_user).execute()
            lichess_user_data = response.data[0]
        else:
            lichess_user_data = response.data[0]
            # Update access_token if changed
            if lichess_user_data.get('access_token') != access_token:
                supabase.table("lichess_users").update({"access_token": access_token}).eq("username", username).execute()
                lichess_user_data['access_token'] = access_token

        return lichess_user_data
    except Exception as e:
        logger.error(f"Error in Lichess authentication: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Lichess authentication",
            headers={"WWW-Authenticate": "Bearer"},
        ) 