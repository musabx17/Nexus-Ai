# NexusDocs Project Stack

## Project Purpose

NexusDocs is a secure document search portal. Authenticated users can upload documents, search authorized content, ask the AI questions, analyze documents for common security leaks, and manage their workspace according to their role.

## Frontend

- **HTML5**: Page structure and forms.
- **CSS3**: Custom responsive styling in `css/style.css`.
- **Vanilla JavaScript**: Application behavior in `js/script.js`.
- **Bootstrap 5.3.3**: Responsive layout utilities and offcanvas navigation.
- **Bootstrap Icons 1.11.3**: Interface icons.
- **Google Fonts**: Inter and Poppins typography.
- **Python HTTP server**: Used locally to serve the static frontend on port `5500`.

Frontend pages:

- `index.html`: Login.
- `dashboard.html`: Workspace overview and live document statistics.
- `documents.html`: Upload, search, filter, sort, analyze, download, and delete documents.
- `ai-chat.html`: Authorized document AI assistant.
- `profile.html`: Profile information and display name.
- `settings.html`: User preferences and role permissions.

## Backend

- **Python 3.14**: Backend runtime.
- **FastAPI**: REST API framework.
- **Uvicorn**: ASGI development and production server.
- **Pydantic v2**: Request validation and response models.
- **python-multipart**: Multipart form and file upload handling.
- **python-dotenv**: Loads configuration from `backend/.env`.

Main backend module:

- `backend/main.py`

Run the backend from the `NexusDocs` directory:

```powershell
c:/python314/python.exe -m uvicorn backend.main:app --reload
```

## API

Base URL:

```text
http://localhost:8000/api/v1
```

Main API areas:

- `/auth/login`, `/auth/logout`, `/auth/me`
- `/auth/profile`
- `/settings`
- `/documents`
- `/documents/upload`
- `/documents/{document_id}/download`
- `/ai/chat`
- `/ai/analyze/{document_id}`

The frontend uses `fetch()` with `credentials: "include"` so the HttpOnly authentication cookie is sent with API requests.

## Database and Storage

This project does not currently use a traditional SQL database server.

- **Document metadata**: Stored in `backend/storage/documents.json`.
- **User settings**: Stored in `backend/storage/user-settings.json`.
- **Encrypted files**: Stored as encrypted binary files in `backend/storage/`.
- **Document encryption**: Fernet symmetric encryption from the `cryptography` package.
- **Vector search**: ChromaDB when installed.
- **Vector fallback**: An in-memory deterministic hash-based vector store is included for lightweight development.

The metadata files and encrypted storage directory should be protected in production. A production deployment should move metadata to PostgreSQL or another managed database and store files in protected object storage.

## AI Components

- **Local RAG agent**: Retrieves authorized document chunks and produces a grounded answer locally.
- **Gemini agent**: Optional server-side Gemini API integration.
- **Gemini model**: Defaults to `gemini-2.0-flash`.
- **Security analysis**: Local pattern scanning detects common passwords, secrets, tokens, private keys, payment cards, SSNs, email addresses, and phone numbers.

Configure Gemini in `backend/.env`:

```env
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash
```

The Gemini key must never be placed in frontend JavaScript. If the key is missing or Gemini is unavailable, the application falls back to the local RAG agent.

## Authentication and Security

- **JWT**: JSON Web Tokens are used for authenticated sessions.
- **HttpOnly cookie**: The access token is stored in an HttpOnly cookie.
- **Role-based access**: Admin, User, and Auditor roles have different document permissions.
- **CORS**: Configured for the local frontend origins.
- **Security headers**: Frame protection, MIME sniffing protection, referrer policy, and Content Security Policy headers are added by the backend.
- **Encrypted document storage**: Uploaded files are encrypted before being written to disk.
- **Authorized retrieval**: Document listing, downloads, AI retrieval, and analysis verify the current user's access.

## Python Dependencies

The complete dependency list is maintained in `backend/requirements.txt`:

- `fastapi`
- `uvicorn[standard]`
- `python-multipart`
- `cryptography`
- `python-jose[cryptography]`
- `passlib[bcrypt]`
- `bcrypt`
- `pypdf`
- `chromadb`

## Local URLs

- Frontend: http://localhost:5500
- Backend: http://localhost:8000
- API health check: http://localhost:8000/health

## Demo Accounts

These are development accounts only:

- Admin: `admin` / `AdminPass123!`
- User: `user` / `UserPass123!`
- Auditor: `auditor` / `AuditorPass123!`

Replace demo credentials and secrets before deploying to production.
