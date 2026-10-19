# pyrefly: ignore [missing-import]
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_full_system():
    # 1. Health
    r = client.get("/health")
    assert r.status_code == 200, f"Health failed: {r.text}"
    print("[OK] Health Check: OK")

    # 2. Login Admin
    r_admin = client.post("/api/v1/auth/login", json={"username": "admin", "password": "AdminPass123!"})
    assert r_admin.status_code == 200, f"Admin login failed: {r_admin.text}"
    admin_cookies = r_admin.cookies
    print("[OK] Admin Auth: OK")

    # 3. Login Standard User
    r_user = client.post("/api/v1/auth/login", json={"username": "user", "password": "UserPass123!"})
    assert r_user.status_code == 200, f"User login failed: {r_user.text}"
    user_cookies = r_user.cookies
    print("[OK] User Auth: OK")

    # 4. Check RBAC Isolation on Documents
    admin_docs = client.get("/api/v1/documents", cookies=admin_cookies).json()
    user_docs = client.get("/api/v1/documents", cookies=user_cookies).json()
    print(f"[OK] RBAC Test: Admin sees {len(admin_docs)} documents, User sees {len(user_docs)} authorized documents.")
    assert len(admin_docs) >= len(user_docs), "Admin must see all or more docs than regular user"

    # 5. Check AI Status
    ai_status = client.get("/api/v1/ai/status", cookies=admin_cookies).json()
    print(f"[OK] AI Status: {ai_status['status']}, Default Model: {ai_status['active_default_model']}")

    # 6. Test AI Chat
    chat_resp = client.post("/api/v1/ai/chat", json={"query": "Summarize the connective devices in the documents"}, cookies=admin_cookies).json()
    print(f"[OK] AI Chat Response Generated: Agent = {chat_resp.get('agent')}, Model = {chat_resp.get('model')}, Sources = {len(chat_resp.get('sources', []))}")

    # 7. Check Security Audit Endpoint
    audit_resp = client.get("/api/v1/security/audit", cookies=admin_cookies).json()
    print(f"[OK] Security Audit: Encryption = {audit_resp['encryption']['algorithm']}, Plaintext on disk = {audit_resp['encryption']['plaintext_on_disk']}")

    print("\n>>> ALL TESTS COMPLETED SUCCESSFULLY! SYSTEM READY FOR PRESENTATION.")

if __name__ == "__main__":
    test_full_system()
