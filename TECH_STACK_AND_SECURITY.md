# NexusDocs: Technology Stack & Security Implementation

## Project Overview

**NexusDocs** is a secure internal document search portal that allows authenticated employees to upload confidential documents (PDFs and text files), search them using AI, and ask questions about their content. All documents are encrypted at rest, and role-based access controls ensure employees only see authorized material.

---

## Technology Stack

### Frontend
- **HTML5** – Semantic markup for login, dashboard, document management, and AI chat interface.
- **CSS3** – Custom responsive design with flexbox and grid layouts.
- **Bootstrap 5.3.3** – Pre-built responsive components and utilities.
- **Bootstrap Icons 1.11.3** – Icon library for UI elements.
- **Vanilla JavaScript** – Application behavior; no frameworks to minimize dependencies.
- **Google Fonts (Inter, Poppins)** – Typography.
- **Python HTTP server** – Local development server on port 5500.

### Backend
- **Python 3.14** – Runtime environment.
- **FastAPI** – Modern REST API framework with automatic OpenAPI documentation.
- **Uvicorn** – ASGI server for development and production.
- **Pydantic v2** – Request validation and response serialization.
- **python-multipart** – Multipart form data handling for file uploads.
- **python-dotenv** – Environment variable loading from `.env` files.
- **python-jose** – JWT (JSON Web Token) creation and validation.
- **passlib + bcrypt** – Password hashing and verification.
- **pypdf** – PDF text extraction.
- **cryptography (Fernet)** – Symmetric encryption for stored documents.
- **ChromaDB** – Vector database for document retrieval (optional; in-memory fallback included).

### AI/ML Components
- **Gemini API (Google)** – Optional external LLM for answering questions with reduced hallucination.
- **RAG (Retrieval-Augmented Generation)** – Local embedding via ChromaDB or deterministic hash-based vectors.
- **Local security scanner** – Pattern-based detection of passwords, API keys, private keys, payment cards, SSNs, emails, and phone numbers.

### Storage & Database
- **JSON files** – Document metadata and user settings stored in `backend/storage/`.
- **Encrypted binary files** – Uploaded documents encrypted with Fernet before storage.
- **Vector index** – ChromaDB (when installed) or in-memory hash-based fallback.

**Production recommendation:** Replace JSON storage with PostgreSQL and managed object storage (AWS S3, Azure Blob, etc.).

---

## Cyber Security Implementation

### Authentication & Authorization

#### 1. **Session Management**
- JWT-based access tokens issued on login.
- Tokens stored in **HttpOnly, SameSite=Strict** cookies (prevents XSS and CSRF token theft).
- Automatic redirection to login for 401 Unauthorized responses.
- Session timeout configurable via `ACCESS_TOKEN_MINUTES` (default: 30 minutes).
- Logout deletes the cookie.

#### 2. **Password Security**
- Passwords hashed with **bcrypt** (automatic salt, configurable cost factor).
- Minimum length: 8 characters.
- Development accounts (`admin/AdminPass123!`, `user/UserPass123!`, `auditor/AuditorPass123!`) are seeded only in development mode.
- **Non-development environments require explicit password configuration** and fail startup if passwords are missing.

#### 3. **Role-Based Access Control (RBAC)**
- Three roles: **Admin**, **User**, **Auditor**.
- Admin: Full workspace access, can upload restricted documents, manage users.
- User: Access to unrestricted documents only.
- Auditor: Access to all documents, including restricted (admin-only).
- Per-endpoint authorization checks prevent horizontal privilege escalation.

#### 4. **API Security**
- CORS configured for trusted origins only (`http://localhost:5500`, `http://127.0.0.1:5500` by default).
- Origin validation middleware rejects state-changing requests (POST, PATCH, DELETE) from untrusted origins.
- Rate limiting: 10 login attempts per client IP per minute; 30 chat requests per minute.
- Input validation on all request payloads (username pattern, password length, query length, file size).

---

### Data Protection

#### 1. **Encryption at Rest**
- Uploaded documents encrypted with **Fernet (AES-128-CBC + HMAC-SHA256)** before storage.
- Encryption key must be a valid Fernet-encoded key (Base64, 44 characters).
- **Critical:** The encryption key must remain stable; if rotated, old files cannot be decrypted.
- Encrypted files stored as random UUIDs in `backend/storage/` directory.
- Metadata stored separately in JSON (unencrypted but access-controlled).

#### 2. **Encryption in Transit**
- Development environment uses HTTP (localhost only).
- **Production must use HTTPS** (enforced at reverse proxy/load balancer level).
- Session cookies marked `Secure=True` outside development, preventing transmission over plaintext HTTP.

#### 3. **Sensitive Data Handling**
- Documents containing passwords, API keys, payment cards, or PII are flagged during analysis.
- **External Gemini API calls redact detected secrets** before transmission (replaces sensitive patterns with `[REDACTED SENSITIVE DATA]`).
- Local RAG agent does not redact internally (data stays on-premises).
- Gemini integration is **disabled by default**; requires explicit `ENABLE_EXTERNAL_GEMINI=true`.

---

### Upload Security

#### 1. **File Validation**
- Only PDF and TXT files accepted.
- Filename sanitization: removes special characters, max 180 characters.
- Extension verification: only `.pdf` and `.txt` allowed.
- MIME type validation: must match file extension or be `application/octet-stream`.
- **PDF content validation:** Magic number check (`%PDF-` header) prevents renamed binaries.
- Size limit: 25 MB by default (configurable via `MAX_UPLOAD_BYTES`).

#### 2. **Document Access Control**
- Files can be marked `restricted` by admins during upload.
- Regular users cannot access restricted documents.
- Auditors and admins can access all documents.
- **Vector store authorization:** Restricted documents excluded from User queries at retrieval time.
- Access checks enforced on listing, download, delete, analyze, and RAG retrieval.

#### 3. **Storage Protection**
- Uploaded files stored in `backend/storage/` (local) or object storage (recommended for production).
- Directory permissions should restrict access to the application user only (use OS-level ACLs or container security).

---

### AI Safety & Prompt Injection Prevention

#### 1. **Retrieval Safety**
- Document chunks sent to Gemini are limited to 5 most-relevant results, 700 tokens max.
- System prompt instructs Gemini to answer only from supplied context.
- Unauthorized documents filtered before retrieval (via vector metadata).
- Sensitive patterns (passwords, tokens, cards, SSNs) redacted before external transmission.

#### 2. **Input Validation**
- Chat queries limited to 2–1000 characters.
- Control character injection prevented.
- Whitespace normalized before processing.

#### 3. **Output Safety**
- Gemini responses sanitized: markdown, emojis, and decorative symbols removed.
- Response length capped at 700 tokens.
- HTML output escaped to prevent XSS in chat display.

#### 4. **Fallback Behavior**
- If Gemini is unavailable or disabled, chat falls back to local RAG.
- No error messages leak sensitive details; users see "service temporarily unavailable."

---

### Infrastructure & Deployment Security

#### 1. **Environment Configuration**
- Secrets loaded from `.env` file (never committed; template provided in `.env.example`).
- Environment variable validation: `ENVIRONMENT` must be `development`, `test`, or `production`.
- Non-development environments fail startup if `SECRET_KEY`, `ENCRYPTION_KEY`, and account passwords are missing.
- Deterministic fallback secrets removed for non-development.

#### 2. **Security Headers**
- `X-Frame-Options: DENY` – Prevents clickjacking.
- `X-Content-Type-Options: nosniff` – Prevents MIME type sniffing.
- `Referrer-Policy: strict-origin-when-cross-origin` – Leak prevention.
- `Content-Security-Policy: default-src 'self'; frame-ancestors 'none'` – XSS and framing protection.

#### 3. **Logging & Monitoring**
- Failed login attempts logged (available through HTTP 401 responses).
- No PII logged in error messages.
- **Production recommendation:** Centralized audit logging (ELK, CloudWatch, Splunk) for login attempts, document access, AI queries, and administrative actions.

---

### Known Limitations & Production Considerations

| Issue | Current Implementation | Production Recommendation |
|-------|------------------------|---------------------------|
| **User Database** | In-memory demo accounts | PostgreSQL + managed identity provider (Azure AD, Okta, etc.) |
| **Secret Storage** | Environment variables | AWS Secrets Manager, Azure Key Vault, HashiCorp Vault |
| **Audit Logging** | Limited console/error logs | Centralized logging with tamper-proof storage |
| **HTTPS Enforcement** | Development only | TLS termination at reverse proxy (nginx, HAProxy, AWS ALB) |
| **Rate Limiting** | In-memory per-instance | Distributed rate limiting (Redis, WAF) for multi-instance deployments |
| **Malware Scanning** | File extension/header only | ClamAV or cloud-based scanning (VirusTotal API) |
| **Key Rotation** | Manual, requires redeployment | Automated key rotation service |
| **MFA** | Not implemented | TOTP, FIDO2, or provider-managed MFA |
| **Compliance** | Not addressed | SOC 2, ISO 27001, GDPR, HIPAA audits |

---

## How to Configure for Production

### 1. **Generate Secrets**

```powershell
# Generate a random SECRET_KEY (32+ characters)
$secret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
Write-Output $secret

# Generate a Fernet encryption key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 2. **Create .env for Production**

```env
ENVIRONMENT=production
SECRET_KEY=<64-character random string>
ENCRYPTION_KEY=<Fernet key from above>
DATABASE_URL=postgresql://user:password@host:5432/ai_power  # Future: PostgreSQL
TRUSTED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
ACCESS_TOKEN_MINUTES=30
MAX_UPLOAD_BYTES=26214400
ADMIN_PASSWORD=<secure random password>
USER_PASSWORD=<secure random password>
AUDITOR_PASSWORD=<secure random password>
GEMINI_API_KEY=<actual API key from Google AI Studio>
ENABLE_EXTERNAL_GEMINI=false  # Set to 'true' only after security review
ENVIRONMENT_LABEL=production
```

### 3. **Deploy**

```bash
# Behind reverse proxy with TLS termination
docker run \
  --env-file .env \
  --env ENVIRONMENT=production \
  -p 127.0.0.1:8000:8000 \
  ai-power:latest

# nginx listens on :443 (TLS) and forwards to http://127.0.0.1:8000
```

### 4. **Rotate Secrets Regularly**

- **JWT key** – Every 90 days (affects active sessions).
- **Encryption key** – Never rotate without archival strategy.
- **Passwords** – Every 30–60 days.
- **Gemini API key** – Every 90 days; revoke compromised keys immediately.

---

## Testing Security Controls

```bash
# 1. Verify environment validation
ENVIRONMENT=staging python -c "import main"  # Should fail

# 2. Test rate limiting
for i in {1..15}; do curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"AdminPass123!"}'; done
# Should return 429 after 10 attempts

# 3. Verify HTTPS-only cookie
# Open browser DevTools > Application > Cookies after login
# Should see `Secure` flag set (production) or unset (development)

# 4. Test origin validation
curl -X POST http://localhost:8000/api/v1/documents/upload \
  -H "Origin: https://attacker.com"  # Should return 403

# 5. Verify Gemini redaction
# Upload a document containing "API_KEY=secret123"
# Enable ENABLE_EXTERNAL_GEMINI=true and ask AI about it
# Gemini should receive "[REDACTED SENSITIVE DATA]" instead of the key
```

---

## Summary

NexusDocs implements a **multi-layered security model** covering authentication, authorization, encryption, input validation, rate limiting, and sensitive-data handling. The application is **safe for local development and internal demonstration**. Production deployment requires identity provider integration, centralized logging, HTTPS enforcement, and PostgreSQL adoption.

All findings from the security review have been remediated. For questions or to report security issues, contact the development team.

---

**Last Updated:** October 2026  
**Status:** Development & Internal Demo Ready  
**Production Readiness:** 60% (Requires identity provider, logging, and database migration)
