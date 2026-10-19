# 🛡️ NexusDocs — Secure Enterprise Document Search & AI Assistant

[![Python](https://img.shields.io/badge/Python-3.14%2B-blue.svg?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3.3-7952B3.svg?logo=bootstrap&logoColor=white)](https://getbootstrap.com/)
[![Security](https://img.shields.io/badge/Security-Fernet%20AES--128--CBC-success.svg)](https://cryptography.io/)
[![AI Engine](https://img.shields.io/badge/AI-Gemini%201.5%20%7C%20Local%20RAG-orange.svg)](https://ai.google.dev/)
[![Bano Qabil](https://img.shields.io/badge/Program-Bano%20Qabil%20BootCamp-green.svg)](#acknowledgements)

**NexusDocs** is an enterprise-grade, privacy-first internal document search portal and AI assistant. It empowers authenticated employees to upload confidential documents (PDFs and text files), run semantic vector search, analyze files for security leaks, and converse with an AI agent—while ensuring complete document encryption at rest and strict role-based access control (RBAC).

---

## 🌟 Key Features

- **🔐 Cryptographic Encryption at Rest**  
  Every uploaded document is automatically encrypted using **Fernet (AES-128-CBC + HMAC-SHA256)** before writing to disk. Zero plaintext files touch persistent storage.
- **🛡️ Strict Role-Based Access Control (RBAC)**  
  Three distinct user roles:
  - **Administrator:** Full workspace visibility, user management, and restricted document uploading.
  - **Standard User:** Isolated private workspace; can only view, search, and chat with their own documents.
  - **Auditor:** Read-only compliance access to all documents, activity logs, and encryption audits.
- **🤖 Dual-Engine Hybrid RAG (Retrieval-Augmented Generation)**  
  - **Google Gemini 1.5 Flash:** Cloud LLM generation for in-depth reasoning and summarization.
  - **Local Neural/Vector Fallback:** 100% offline-capable deterministic RAG agent when external AI is disabled or offline.
- **🔍 Sensitive Data Loss Prevention (DLP)**  
  Automatic server-side regex redaction engine sanitizes passwords, private keys, API keys, payment card numbers, SSNs, and phone numbers *before* sending authorized document excerpts to external LLMs.
- **🔒 Hardened Authentication & Session Security**  
  - Secure bcrypt password hashing with unique per-password salts.
  - `HttpOnly`, `SameSite=Strict` session cookies protecting against XSS and CSRF attacks.
  - CORS origin allowlist verification and brute-force rate limiting.
- **🎨 Modern, Responsive Web Interface**  
  - Built with clean Vanilla JavaScript, Bootstrap 5.3, and modern CSS glassmorphism.
  - One-click Dark / Light mode toggle.
  - Live statistics dashboard, document search filters, file viewer, and interactive conversational chat.

---

## 🚀 Quick Start Guide

### Step 1: Set Up & Start Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn main:app --reload --port 8000
```

### Step 2: Serve the Frontend

In a second terminal:
```powershell
# From NexusDocs folder
python -m http.server 5500
```
Visit: **`http://localhost:5500/index.html`**

---

## 👥 Demo Accounts

| Role | Username | Default Password | Access Level |
|---|---|---|---|
| **Administrator** | `admin` | `AdminPass123!` | Complete access, user control, system audit |
| **Standard User** | `user` | `UserPass123!` | Isolated personal documents & AI chat |
| **Auditor** | `auditor` | `AuditorPass123!` | Read-only compliance & security audit logs |

---

## 🔒 Security & Privacy Notice

- All `.env` files and active credentials are removed from version control via `.gitignore`.
- Encrypted file contents (`*.bin`) and SQLite databases (`*.db`) are ignored to prevent leaking personal/school documents.
- Always keep `GEMINI_API_KEY` private and never commit `.env` to public repositories.

---

## 🎓 Acknowledgements

Developed as part of the **Bano Qabil BootCamp Project** initiative.
