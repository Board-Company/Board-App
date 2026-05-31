import asyncio
import contextlib
from contextlib import asynccontextmanager

import redis.asyncio as redis_async
from fastapi import FastAPI, Depends, HTTPException, status, Request, Header
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from datetime import timedelta
from dotenv import load_dotenv
import os
import uvicorn
from loguru import logger
from schemas import Token, User, UserCreate, GoogleAuthRequest, UserInDB


def _user_public_dict(user: UserInDB) -> dict:
    data = user.model_dump() if hasattr(user, "model_dump") else user.dict()
    data.pop("hashed_password", None)
    # Mobile app expects `name` for display; DB stores `username`
    display_name = data.get("username") or data.get("email") or "Player"
    if not data.get("name"):
        data["name"] = display_name
    return data
from auth import (
    verify_password, get_password_hash, create_access_token, 
    get_user, get_user_by_email, authenticate_user, get_current_user, 
    get_current_active_user, ACCESS_TOKEN_EXPIRE_MINUTES,
    generate_code_verifier, generate_code_challenge, get_lichess_auth_url,
    verify_lichess_token, SECRET_KEY, ALGORITHM
)
from google.oauth2 import id_token
from google.auth.transport import requests
import json
import secrets
from pydantic import BaseModel
from jose import jwt, JWTError
import httpx

# Load environment variables
load_dotenv()

# Configure logger
logger.add("api.log", rotation="10 MB", level="DEBUG")

@asynccontextmanager
async def lifespan(app: FastAPI):
    redis_url = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
    client = redis_async.from_url(redis_url, decode_responses=True)
    try:
        await client.ping()
        logger.info("Redis connected at {}", redis_url)
    except Exception as e:
        logger.error("Redis connection failed ({}). Set REDIS_URL or start Redis.", e)
        raise
    app.state.redis = client

    from engine.config import default_redis_engine_url

    engine_url = default_redis_engine_url(redis_url)
    engine_client = redis_async.from_url(engine_url, decode_responses=True)
    try:
        await engine_client.ping()
        logger.info("Redis engine connected at {}", engine_url)
        app.state.redis_engine = engine_client
    except Exception as e:
        logger.warning(
            "Redis engine connection failed ({}). /engine/* will return 503 until REDIS_ENGINE_URL is set.",
            e,
        )
        app.state.redis_engine = None
        await engine_client.aclose()
        engine_client = None

    sweep_interval = int(os.getenv("ABANDONED_GAME_SWEEP_SEC", "300"))

    async def abandoned_sweep_loop() -> None:
        while True:
            await asyncio.sleep(sweep_interval)
            try:
                from game.service import sweep_abandoned_friend_games

                n = await sweep_abandoned_friend_games(client, supabase)
                if n:
                    logger.info("Archived {} abandoned (TTL) friend game(s) to Supabase", n)
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Abandoned friend game sweep failed")

    sweep_task = asyncio.create_task(abandoned_sweep_loop())
    try:
        yield
    finally:
        sweep_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await sweep_task
        await client.aclose()
        engine_client = getattr(app.state, "redis_engine", None)
        if engine_client is not None:
            await engine_client.aclose()
        logger.info("Redis connection closed")


# Configure FastAPI app
app = FastAPI(
    title="Board API",
    description="Backend API for Board Application",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your app's domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from supabase_client import supabase

# initialize google client
google_client_id = os.getenv("GOOGLE_CLIENT_ID")

logger.info("Supabase configuration successfully loaded")

from game.routes import router as game_router
from engine.routes import router as engine_router

app.include_router(game_router, prefix="/games", tags=["games"])
app.include_router(engine_router, prefix="/engine", tags=["engine"])

# Routes
@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    logger.info(f"Login attempt for username: {form_data.username}")
    
    try:
        user = await authenticate_user(form_data.username, form_data.password, supabase)
        if not user:
            logger.warning(f"Authentication failed for username: {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        logger.info(f"User authenticated successfully: {user.username}")
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        logger.debug(f"Access token created for user: {user.username}")
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": _user_public_dict(user),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error during authentication: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Authentication error: {str(e)}"
        )

@app.post("/register", response_model=User)
async def register_user(user_data: UserCreate):
    # Check if username already exists
    existing_user = await get_user(user_data.username, supabase)
    if existing_user:
        logger.warning(f"Registration attempt with existing username: {user_data.username}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Check if email already exists
    try:
        email_check = supabase.table("users").select("*").eq("email", user_data.email).execute()
        if email_check.data and len(email_check.data) > 0:
            logger.warning(f"Registration attempt with existing email: {user_data.email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking email existence: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error checking email existence"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    
    # Clean up the user data to match Supabase schema
    user_dict = {
        "username": user_data.username,
        "email": user_data.email,
        "hashed_password": hashed_password,
        "disabled": False
    }
    
    try:
        # Log user registration attempt
        logger.info(f"Attempting to register user: {user_data.username}")
        logger.debug(f"User data being inserted: {user_dict}")
        
        # Check Supabase connection
        try:
            test_query = supabase.table("users").select("count").limit(1).execute()
            logger.debug(f"Supabase connection test: {test_query}")
        except Exception as conn_err:
            logger.error(f"Supabase connection error: {str(conn_err)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database connection error"
            )
        
        response = supabase.table("users").insert(user_dict).execute()
        
        logger.debug(f"Full Supabase response: {response}")
        
        if hasattr(response, 'data') and response.data:
            logger.success(f"User registered successfully: {user_data.username}")
            row = response.data[0]
            created = UserInDB(**row)
            return User(**_user_public_dict(created))
        else:
            logger.error(f"Supabase response empty or invalid: {response}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user - empty response"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error creating user: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating user: {str(e)}"
        )

@app.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user

@app.get("/")
async def root():
    return {"message": "Board API is running"}

# Health check endpoint
@app.get("/health")
async def health_check(request: Request):
    """Liveness + Redis connectivity (friend games + engine jobs)."""
    r = getattr(request.app.state, "redis", None)
    re = getattr(request.app.state, "redis_engine", None)
    games_ok = False
    engine_ok = False
    if r is not None:
        try:
            await r.ping()
            games_ok = True
        except Exception:
            pass
    if re is not None:
        try:
            await re.ping()
            engine_ok = True
        except Exception:
            pass
    if games_ok and engine_ok:
        return {"status": "healthy", "redis": True, "redis_engine": True}
    if games_ok:
        return {"status": "degraded", "redis": True, "redis_engine": engine_ok}
    return {"status": "degraded", "redis": games_ok, "redis_engine": engine_ok}

@app.post("/auth/google", response_model=Token)
async def google_auth(google_data: GoogleAuthRequest):
    try:
        if not google_client_id:
            logger.error("GOOGLE_CLIENT_ID is not set; cannot verify Google ID tokens")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Server Google OAuth is not configured",
            )
        logger.info("Received Google ID token for verification")
        # Verify the Google token (audience must match OAuth "Web application" client ID)
        try:
            idinfo = id_token.verify_oauth2_token(
                google_data.token, requests.Request(), google_client_id)
            logger.info(f"Google token verified. idinfo: {idinfo}")
        except Exception as verify_err:
            logger.error(f"Google token verification failed: {verify_err}")
            raise

        # Get user email from Google data
        email = idinfo.get('email')
        logger.info(f"Extracted email from Google token: {email}")
        
        # Match by email (username may differ for email/password accounts)
        existing_user = await get_user_by_email(email, supabase)
        logger.info(f"User lookup by email for {email}: {existing_user}")
        
        if not existing_user:
            # Create new user if they don't exist
            user_dict = {
                "username": email,  # Using email as username
                "email": email,
                "disabled": False,
                "hashed_password": get_password_hash(os.urandom(32).hex())  # Random password for Google users
            }
            logger.info(f"Creating new user: {user_dict}")
            response = supabase.table("users").insert(user_dict).execute()
            logger.info(f"Supabase insert response: {response}")
            if not hasattr(response, 'data') or not response.data:
                logger.error(f"Failed to create user for {email}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create user"
                )
            user = UserInDB(**response.data[0])
        else:
            user = existing_user
            logger.info(f"Using existing user: {user}")

        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username},
            expires_delta=access_token_expires
        )
        logger.info(f"Access token created for {user.username}")
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": _user_public_dict(user),
        }

    except ValueError as ve:
        logger.error(f"Invalid Google token: {ve}")
        # Invalid token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token"
        )
    except Exception as e:
        logger.exception(f"Error in Google authentication: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing Google authentication"
        )

# Lichess OAuth2 endpoints
@app.get("/auth/lichess/login")
async def lichess_login(Authorization: Optional[str] = Header(None)):
    try:
        code_verifier = generate_code_verifier()
        code_challenge = generate_code_challenge(code_verifier)
        state = secrets.token_urlsafe(16)  # Generate a random state

        # Store code_verifier with state as key
        app.state.code_verifiers = getattr(app.state, 'code_verifiers', {})
        app.state.code_verifiers[state] = code_verifier

        # Store the user's JWT with the state if provided
        if Authorization:
            app.state.lichess_login_jwts = getattr(app.state, 'lichess_login_jwts', {})
            app.state.lichess_login_jwts[state] = Authorization

        # Add state to auth URL
        auth_url = get_lichess_auth_url(code_challenge, state)
        logger.info(f"Generated Lichess auth URL with code challenge: {code_challenge} and state: {state}")

        return {"auth_url": auth_url}
    except Exception as e:
        logger.error(f"Error initiating Lichess login: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error initiating Lichess login"
        )

class LinkLichessRequest(BaseModel):
    lichess_username: str

@app.get("/auth/lichess/callback")
async def lichess_callback(code: str, state: Optional[str] = None):
    try:
        code_verifiers = getattr(app.state, 'code_verifiers', {})
        code_verifier = code_verifiers.pop(state, None)  # Remove after use

        if not code_verifier:
            error_params = {
                "error": "invalid_code",
                "error_description": "Invalid or expired authorization code"
            }
            return RedirectResponse(
                url=f"boardapp://auth/lichess/callback?{json.dumps(error_params)}"
            )

        # Get Lichess user data
        user_data = await verify_lichess_token(code, code_verifier)

        # Save or update Lichess user in lichess_users table
        lichess_user_dict = {
            "username": user_data["username"],
            "access_token": user_data.get("access_token"),
        }
        # Upsert (insert or update) lichess_users
        supabase.table("lichess_users").upsert(lichess_user_dict, on_conflict=["username"]).execute()

        # If a JWT was provided with this state, link the Lichess account to the app user
        lichess_login_jwts = getattr(app.state, 'lichess_login_jwts', {})
        jwt_token = lichess_login_jwts.pop(state, None)
        if not jwt_token:
            logger.warning(f"No JWT token found for Lichess linking (state={state})")
        else:
            # Validate JWT and get current user
            from fastapi.security.utils import get_authorization_scheme_param
            scheme, param = get_authorization_scheme_param(jwt_token)
            logger.debug(f"Decoded JWT scheme: {scheme}, param: {param}")
            if scheme.lower() == "bearer" and param:
                try:
                    # Decode the JWT to get the username
                    payload = jwt.decode(param, SECRET_KEY, algorithms=[ALGORITHM])
                    username = payload.get("sub")
                    if not username:
                        raise HTTPException(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid token: missing username",
                            headers={"WWW-Authenticate": "Bearer"},
                        )
                    
                    # Get user from database
                    user_lookup = supabase.table("users").select("*").eq("username", username).single().execute()
                    logger.debug(f"Supabase user lookup for username {username}: {user_lookup.data}")
                    
                    if not user_lookup.data:
                        logger.error(f"No app user found with username: {username}")
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"User not found: {username}"
                        )
                    
                    # Only link if the user does not already have a lichess_username
                    if not user_lookup.data.get("lichess_username"):
                        supabase.table("users").update({
                            "lichess_username": user_data["username"],
                            "lichess_linked": True
                        }).eq("username", username).execute()
                        logger.info(f"Linked Lichess account {user_data['username']} to app user {username}")
                    else:
                        logger.info(f"App user {username} already has a Lichess account linked: {user_lookup.data.get('lichess_username')}")
                except JWTError as e:
                    logger.error(f"JWT validation error: {str(e)}")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid token",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
                except Exception as e:
                    logger.error(f"Error linking Lichess to app user: {str(e)}")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Error linking Lichess account: {str(e)}"
                    )
            else:
                logger.warning(f"Invalid or missing Bearer token in Authorization header for Lichess linking (state={state})")

        # Create access token for Lichess user
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user_data["username"]},
            expires_delta=access_token_expires
        )
        
        structured_user_data = {
            "username": user_data["username"],
            "email": user_data.get("email"),
            "lichess_username": user_data["username"],
            "auth_provider": "lichess",
            "lichess_rating": user_data.get("perfs", {})
        }
        
        success_data = {
            "access_token": access_token,
            "token_type": "bearer",
            "user": structured_user_data,
            "lichess_username": user_data["username"]
        }
        
        encoded_data = json.dumps(success_data)
        return RedirectResponse(
            url=f"boardapp://auth/lichess/callback?data={encoded_data}"
        )
    except Exception as e:
        logger.error(f"Error in Lichess callback: {str(e)}")
        error_params = {
            "error": "auth_error",
            "error_description": str(e)
        }
        return RedirectResponse(
            url=f"boardapp://auth/lichess/callback?{json.dumps(error_params)}"
        )

@app.post("/users/link-lichess")
async def link_lichess_account(
    request: LinkLichessRequest,
    current_user: User = Depends(get_current_active_user)
):
    try:
        logger.info(f"Attempting to link Lichess account {request.lichess_username} for user {current_user.username}")
        
        # First check if this Lichess account is already linked
        existing_link = supabase.table("users").select("*").eq("lichess_username", request.lichess_username).execute()
        if existing_link.data and len(existing_link.data) > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This Lichess account is already linked to another user"
            )
        
        response = supabase.table("users").update({
            "lichess_username": request.lichess_username,
            "lichess_linked": True,
            "auth_provider": "lichess"  # Add auth provider info
        }).eq("username", current_user.username).execute()
        
        if not response.data:
            logger.error(f"Failed to link Lichess account for user {current_user.username}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to link Lichess account"
            )
            
        logger.info(f"Successfully linked Lichess account for user {current_user.username}")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error linking Lichess account: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error linking Lichess account: {str(e)}"
        )

@app.post("/users/unlink-lichess")
async def unlink_lichess_account(
    current_user: User = Depends(get_current_active_user)
):
    try:
        logger.info(f"Attempting to unlink Lichess account for user {current_user.username}")
        response = supabase.table("users").update({
            "lichess_username": None,
            "lichess_linked": False
        }).eq("username", current_user.username).execute()
        
        if not response.data:
            logger.error(f"Failed to unlink Lichess account for user {current_user.username}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to unlink Lichess account"
            )
            
        logger.info(f"Successfully unlinked Lichess account for user {current_user.username}")
        return {"success": True}
    except Exception as e:
        logger.error(f"Error unlinking Lichess account: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error unlinking Lichess account: {str(e)}"
        )

@app.get("/users/lichess-info")
async def get_lichess_info(current_user: User = Depends(get_current_active_user)):
    try:
        if not current_user.lichess_username:
            return {"lichess": None}
        lichess_info = supabase.table("lichess_users").select("*").eq("username", current_user.lichess_username).single().execute()
        return {"lichess": lichess_info.data}
    except Exception as e:
        logger.error(f"Error fetching lichess info: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching lichess info: {str(e)}"
        )

# Run the application
if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
