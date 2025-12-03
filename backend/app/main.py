from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.routes.auth import auth_router
from app.routes.chat import chat_router
from app.routes.documents import document_router
from app.routes.users import user_router
from app.routes.sessions import session_router
from app.dependencies.auth import get_current_user
import os

os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Initialize FastAPI app
app = FastAPI(
    root_path="/askdocs-api/v1",
    title="AskDocs API",
    description="Visit http://0.0.0.0:8000/docs for API documentation",
    version="0.0.1"
)

ALLOWED_ORIGINS = [
    "http://localhost:8001",
    "http://127.0.0.1:8001",
    "https://askdocs.rohithvasu.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router)
app.include_router(user_router, dependencies=[Depends(get_current_user)])
app.include_router(document_router, dependencies=[Depends(get_current_user)])
app.include_router(session_router, dependencies=[Depends(get_current_user)])
app.include_router(chat_router, dependencies=[Depends(get_current_user)])
