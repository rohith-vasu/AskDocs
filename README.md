# AskDocs

**AskDocs** is an intelligent AI-powered document assistant that allows users to **upload, search, and chat** with their documents — including **PDF**, **DOCX**, and **PPT** files.  
It combines **semantic search**, **vector databases**, and **large language models** to make static documents interactive and insightful.

---

## 🚀 Features

- **📄 Multi-format Support** — Upload and index DOCX, PDF, PPT, and CSV files  
- **💬 Conversational AI** — Ask natural language questions and get contextual answers  
- **🔍 Vector-based Search** — Uses embeddings for accurate semantic retrieval  
- **🧠 Persistent Memory** — Maintains chat context across turns  
- **⚡ FastAPI + React Architecture** — Modern, modular, and scalable  
- **🔐 Secure & Extensible** — Built with privacy and modular components  
- **🐳 Docker Support** — Easy to deploy locally or in the cloud  

---

## 🏗️ Tech Stack

| Component      | Technology |
|----------------|-------------|
| **Frontend**   | React + TypeScript + Tailwind CSS |
| **Backend**    | FastAPI + LangChain + RAG |
| **Database**  | PostgreSQL |
| **Vector DB**  | Qdrant |
| **Container**  | Docker + Docker Compose |
| **LLM Layer**  | OpenAI / Gemini |
| **Build Tools**| Make + Vite |

---

## 📦 Prerequisites

Make sure you have the following installed:

- [Python 3.12+](https://www.python.org/)
- [uv](https://docs.astral.sh/uv/getting-started/installation/) — Python package manager
- [Node.js 18+](https://nodejs.org/)
- [Docker](https://docs.docker.com/get-started/get-docker/)
- [GNU Make](https://www.gnu.org/software/make)

---

## ⚙️ Setup

### Clone the repository
```bash
git clone https://github.com/rohith-vasu/AskDocs.git
cd AskDocs
```

### Environment variables

Backend (backend/.env.dev and backend/.env.prod)

```bash
ENV_FOR_DYNACONF=development / production
ASKDOCS_LLM_API_KEY=your_api_key_here
ASKDOCS_DB_PASSWORD=your_db_password
```

Frontend (frontend/.env)

```bash
VITE_BASE_API_URL=http://localhost:8000/api/v1
```

---

### Development Setup

AskDocs is composed of a backend (FastAPI) and a frontend (React).

#### 1. Start dependencies via Docker

From the project root:

```bash
make up-deps
```

This spins up all required services like:

- Vector database
- PostgreSQL
- Redis

#### 2. Start the backend
```bash
cd backend
./start.sh
```

This runs the FastAPI app in development mode (hot reload enabled).

#### 3. Start the frontend
```bash
cd frontend
npm install
npm run dev
```

This runs the Vite-powered React app at http://localhost:8001.

---

### Production Setup

For production deployment (all in Docker):

```bash
make up-prod
```

This builds and runs:
- Backend (FastAPI)
- Frontend (React, served statically)
- All dependencies (DB, vector store, redis)

By default, the app will be available on: http://localhost:8001

---

## How It Works

1. Upload — User uploads documents (PDF, DOCX, PPT, CSV)
2. Ingestion — Files are parsed and converted into embeddings via LangChain
3. Storage — Embeddings are stored in a vector database (e.g., ChromaDB or pgvector)
4. Query — When the user asks a question, AskDocs performs semantic retrieval
5. Response — The LLM processes relevant context and returns a natural, contextual answer

---

## 🛠️ Development Tips

Backend API is available at: http://localhost:8000

Frontend runs at: http://localhost:8001

Use ```npm run build``` in frontend to generate static assets for production

To rebuild everything cleanly:

```bash
make down
make build-nc
make up-prod
```