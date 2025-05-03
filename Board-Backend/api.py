from fastapi import FastAPI, Depends, HTTPException, status
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from typing import Optional
from datetime import timedelta
from dotenv import load_dotenv
import os
from supabase import create_client, Client
import uvicorn
from loguru import logger
from schemas import Token, User, UserCreate, GoogleAuthRequest
from auth import (
    verify_password, get_password_hash, create_access_token, 
    get_user, authenticate_user, get_current_user, 
    get_current_active_user, ACCESS_TOKEN_EXPIRE_MINUTES
)
from google.oauth2 import id_token
from google.auth.transport import requests

# Load environment variables
load_dotenv()

# Configure logger
logger.add("api.log", rotation="10 MB", level="DEBUG")

# Configure FastAPI app
app = FastAPI(title="Board API", description="Backend API for Board Application")

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")

#initialize google client
google_client_id = os.getenv("GOOGLE_CLIENT_ID")

# Replace the current logging section with this:
if supabase_url and supabase_key:
    logger.info("Supabase configuration successfully loaded")
else:
    logger.error("Missing Supabase configuration")

supabase: Client = create_client(supabase_url, supabase_key)

# Routes
@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await authenticate_user(form_data.username, form_data.password, supabase)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user.dict()
    }

@app.post("/register", response_model=User)
async def register_user(user_data: UserCreate):
    # Check if user already exists
    existing_user = await get_user(user_data.username, supabase)
    if existing_user:
        logger.warning(f"Registration attempt with existing username: {user_data.username}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
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
            return User(**user_dict)
        else:
            logger.error(f"Supabase response empty or invalid: {response}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user - empty response"
            )
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
async def health_check():
    return {"status": "healthy"}

@app.post("/auth/google", response_model=Token)
async def google_auth(google_data: GoogleAuthRequest):
    try:
        logger.info(f"Received Google token: {google_data.token}")
        # Verify the Google token
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
        
        # Check if user exists in your database
        existing_user = await get_user(email, supabase)
        logger.info(f"User lookup result for {email}: {existing_user}")
        
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
            user = User(**user_dict)
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
            "user": user.dict()
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

# Run the application
if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
