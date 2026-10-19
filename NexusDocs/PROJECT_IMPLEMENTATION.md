# NexusDocs implementation and security report

## Technology used

- **Frontend:** HTML5, CSS3, Bootstrap 5.3.3, and vanilla JavaScript.
- **Backend framework:** Python 3.14 with FastAPI, served by Uvicorn.
- **Database:** There is no server database in this demo. Document metadata and user settings are stored in JSON files under `backend/storage/`. Encrypted document contents are stored as binary files in the same directory. ChromaDB provides the local vector index when installed, with an in-memory hash-vector fallback.
- **AI API:** Gemini is called server-side through the Google Generative Language REST API. The browser calls `POST /api/v1/ai/chat`; the backend retrieves only authorized document chunks and then sends that context to Gemini. The API key is never sent to the frontend.
- **Document processing:** PDF text is extracted with `pypdf`; TXT files are decoded as UTF-8; retrieval uses ChromaDB or the deterministic local fallback.

## What has been implemented

- Login, logout, session expiry, and role-aware access for Admin, User, and Auditor accounts.
- PDF/TXT upload with extension/content-type validation and a 25 MB limit.
- Fernet encryption before uploaded files are written to disk.
- Authorization checks for listing, downloading, deleting, analyzing, and retrieving document context.
- RAG-based document chat with Gemini when `GEMINI_API_KEY` is configured, and a local RAG fallback when it is not.
- Source snippets in chat responses and local scanning for passwords, tokens, private keys, payment cards, SSNs, email addresses, and phone numbers.
- HttpOnly, SameSite cookies, CORS allowlisting, security response headers, input validation, safe filenames, and HTML escaping for chat output.
- The committed environment template no longer contains a live-looking API key. Any previously exposed Gemini key should be revoked and replaced.
- Non-development startup now fails when required secrets or account passwords are missing, and session cookies are Secure outside development.
- External Gemini processing is now an explicit `ENABLE_EXTERNAL_GEMINI=true` opt-in; sensitive values are redacted before external requests, mutating requests are origin-checked, and login/chat requests are throttled.

## Criteria check against the project brief

| Requirement | Status | Evidence |
| --- | --- | --- |
| Clean login screen | Complete | `index.html` and `/api/v1/auth/login` |
| Document upload | Complete for PDF/TXT | `documents.html` and `/api/v1/documents/upload` |
| AI chat about documents | Complete | `ai-chat.html`, `js/script.js`, and `/api/v1/ai/chat` |
| RAG using uploaded documents | Complete for indexed authorized chunks | ChromaDB/local vector retrieval in `backend/main.py` |
| Role-based permissions | Complete for the demo roles | Admin/User/Auditor checks in backend routes |
| Encrypted documents | Complete for stored file contents | Fernet encryption in `backend/main.py` |
| Persistent relational database | Not implemented | JSON storage is used for this demo; use PostgreSQL for production |
| Production identity provider | Not implemented | Seeded development accounts are still used |
| Production secret management | Partial | Environment variables are used, but a vault/secret manager is still recommended |

## Configuration and run steps

1. Copy `backend/.env.example` to `backend/.env`.
2. Generate a long random `SECRET_KEY` and a Fernet `ENCRYPTION_KEY`.
3. Put the Gemini key only in `backend/.env` as `GEMINI_API_KEY`.
4. Start the backend with `uvicorn main:app --reload --port 8000` from `NexusDocs/backend`.
5. Serve `NexusDocs` on port 5500 and open `http://localhost:5500/index.html`.

Never commit `backend/.env`. If a key has ever been committed or shared, revoke it in Google AI Studio and create a new one.

## Remaining production hardening

- Replace JSON files and demo credentials with PostgreSQL and an identity provider.
- Add centralized audit logging, rate limiting, malware scanning, and a managed secret store.
- Use HTTPS in production so the session cookie can always be marked `Secure`.
- Add automated tests for authorization, upload validation, encryption, Gemini fallback, and prompt-injection-resistant retrieval.
