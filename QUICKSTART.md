# Nexus AI Quick Start Guide

## What Has Been Done

Your AI-powered secure document search portal is **ready for local development and demonstration**. The project has:

1. ✅ **Gemini AI connected** – The frontend AI chat calls the backend, which uses Gemini (optional) or local RAG to answer questions about uploaded documents.
2. ✅ **Security hardened** – All high-severity findings fixed; Gemini key removed from committed files; sensitive data redacted before external API calls.
3. ✅ **Criteria verified** – Login, document upload, encryption, RAG retrieval, and role-based access all working.
4. ✅ **Documented** – See `SECURITY_REVIEW.md` and `TECH_STACK_AND_SECURITY.md` for full details.

---

## Quick Start (Local Development)

### 1. **Start the Backend**

```powershell
cd "Nexus Ai/backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# .env now has development defaults; GEMINI_API_KEY is optional
uvicorn main:app --reload --port 8000
```

### 2. **Start the Frontend (in a new terminal)**

```powershell
cd "Nexus Ai"
python -m http.server 5500
```

### 3. **Open Browser**

- Go to **http://localhost:5500/index.html**
- Login with: **admin** / **AdminPass123!**
- Upload a PDF or TXT file
- Ask the AI a question about it!

---

## Demo Accounts

| Username | Password | Role | Access |
|----------|----------|------|--------|
| admin | AdminPass123! | Admin | All documents, restricted docs, user management |
| user | UserPass123! | User | Only unrestricted documents |
| auditor | AuditorPass123! | Auditor | All documents (including restricted) |

---

## How Gemini Is Connected

### Default Behavior (No Gemini)
- Backend uses **local RAG** to answer questions.
- No external API calls; all data stays on your machine.
- Slower but fully private.

### With Gemini (Optional)
1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Edit `backend/.env`:
   ```env
   GEMINI_API_KEY=your-actual-key-here
   ENABLE_EXTERNAL_GEMINI=true
   ```
3. Restart the backend.
4. Chat will now use Gemini (with sensitive data redacted).

### Fallback Behavior
- If Gemini fails or is disabled, chat automatically falls back to local RAG.
- Users never see the API key; it's server-side only.

---

## Key Files

| File | Purpose |
|------|---------|
| `Nexus Ai/backend/main.py` | FastAPI backend with auth, upload, encryption, AI endpoints |
| `Nexus Ai/js/script.js` | Frontend logic for login, upload, chat, document management |
| `Nexus Ai/ai-chat.html` | AI chat interface |
| `Nexus Ai/index.html` | Login page |
| `Nexus Ai/documents.html` | Document management & upload |
| `SECURITY_REVIEW.md` | Full security findings & fixes |
| `TECH_STACK_AND_SECURITY.md` | Tech stack details & security controls |

---

## What's Secured?

✅ **Passwords** – Hashed with bcrypt; never stored in plain text.  
✅ **Session cookies** – HttpOnly, SameSite=Strict to prevent XSS and CSRF.  
✅ **Documents** – Encrypted with Fernet (AES-128-CBC + HMAC-SHA256) before storage.  
✅ **Upload validation** – PDF magic number check, file size limits, extension validation.  
✅ **Rate limiting** – 10 login attempts per minute per IP; 30 chat requests per minute.  
✅ **Gemini integration** – Sensitive data (passwords, tokens, cards, SSNs) redacted before transmission.  
✅ **RBAC** – Admin/User/Auditor roles with per-endpoint checks.  
✅ **CORS & origin validation** – Trusted origins only; state-changing requests verified.  

---

## Production Readiness

**Current state:** ✅ Safe for local development & internal demo.

**Before public internet deployment, you need:**

1. **Identity Provider** – Replace demo accounts with Azure AD, Okta, or similar.
2. **Database** – Replace JSON files with PostgreSQL.
3. **HTTPS** – Use a reverse proxy (nginx, HAProxy) with TLS certificates.
4. **Logging** – Set up centralized audit logging (ELK, CloudWatch).
5. **Secrets vault** – Use AWS Secrets Manager, Azure Key Vault, or HashiCorp Vault.
6. **Monitoring** – Add intrusion detection, performance monitoring, and alerting.

See `SECURITY_REVIEW.md` section "Remaining Production Recommendations" for details.

---

## Troubleshooting

### Backend won't start
```powershell
# Make sure port 8000 is free
netstat -ano | findstr :8000
# If in use, kill the process:
taskkill /pid <PID> /f
```

### Login fails
- Check username/password (case-sensitive).
- Make sure backend is running on port 8000.
- Check browser console (F12) for error messages.

### Gemini not working
- Verify `GEMINI_API_KEY` is set in `backend/.env`.
- Ensure `ENABLE_EXTERNAL_GEMINI=true` in `.env`.
- Check backend logs for HTTP errors.
- Fallback to local RAG still works if Gemini fails.

### Document upload fails
- File must be PDF or TXT only.
- File size under 25 MB.
- PDF files must start with `%PDF-` header.

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/logout` | Logout |
| GET | `/api/v1/auth/me` | Current user |
| POST | `/api/v1/documents/upload` | Upload document |
| GET | `/api/v1/documents` | List authorized documents |
| GET | `/api/v1/documents/{id}/download` | Download document |
| DELETE | `/api/v1/documents/{id}` | Delete document |
| POST | `/api/v1/ai/chat` | Chat with AI |
| POST | `/api/v1/ai/analyze/{id}` | Analyze document for security issues |

All endpoints require authentication (JWT token in cookie).

---

## Questions?

- **Security concerns?** See `SECURITY_REVIEW.md` for detailed findings.
- **Tech details?** See `TECH_STACK_AND_SECURITY.md` for full stack & controls.
- **Implementation status?** See `PROJECT_IMPLEMENTATION.md` for criteria checklist.

---

**Ready to go!** 🚀
