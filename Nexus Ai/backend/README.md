# Nexus AI Backend

## Run locally

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn main:app --reload --port 8000
```

In a second terminal, serve the frontend from the project root so browser cookies
and CORS behave consistently:

```powershell
cd ..\
python -m http.server 5500
```

Open `http://localhost:5500/index.html`, then use the seeded development account
or replace the credentials through environment variables before deployment.

Development uses the seed users `admin` / `AdminPass123!`, `user` / `UserPass123!`, and `auditor` / `AuditorPass123!`. New users can create a normal User account from the login page; self-registration can never create an administrator or auditor account. User records are stored in `storage/users.db` and contain bcrypt password hashes only, never plaintext credentials. Non-development environments must provide `ADMIN_PASSWORD`, `USER_PASSWORD`, and `AUDITOR_PASSWORD`, plus a long random `SECRET_KEY` (at least 32 characters) and a Fernet `ENCRYPTION_KEY` in `.env`. The encryption key must remain stable or previously uploaded files cannot be decrypted.

Documents are encrypted with Fernet before being written to `storage`. Normal users can only list, download, analyze, and query documents they own; administrators and auditors can access workspace documents, while only administrators can manage accounts or upload restricted files. Authorization is applied both to document listing and to the vector query, so unauthorized chunks never enter an answer context. ChromaDB is used when installed; the file also includes a small in-memory vector fallback for a lightweight demo setup. Uploads are limited by `MAX_UPLOAD_BYTES` (25 MB by default) and only PDF/TXT files are accepted.

The Settings page exposes administrator user controls for activating or deactivating accounts. AI Chat can target one selected authorized document for document-specific questions and summaries. External Gemini use is opt-in; detected credentials and other sensitive values are redacted before authorized context is sent to it.

## Gemini agent

Set `GEMINI_API_KEY` and `ENABLE_EXTERNAL_GEMINI=true` in the backend environment to enable Gemini responses. The backend sends only the authenticated user's authorized context, with detected secrets redacted, to Gemini. If either setting is missing or Gemini is unavailable, chat falls back to the local RAG agent. `GEMINI_MODEL` can override the default `gemini-2.0-flash` model.
