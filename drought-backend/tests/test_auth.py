"""
Tests de autenticación — POST /auth/login, GET /auth/me, POST /auth/logout
"""


class TestLogin:
    def test_login_ok(self, client):
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "testpassword123"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert len(data["access_token"]) > 20

    def test_login_wrong_password(self, client):
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "wrong_password"},
        )
        assert resp.status_code == 401

    def test_login_unknown_email(self, client):
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@test.com", "password": "testpassword123"},
        )
        assert resp.status_code == 401

    def test_login_missing_fields(self, client):
        resp = client.post("/api/v1/auth/login", json={"email": "admin@test.com"})
        assert resp.status_code == 422  # Pydantic validation error

    def test_login_empty_body(self, client):
        resp = client.post("/api/v1/auth/login", json={})
        assert resp.status_code == 422


class TestMe:
    def test_me_ok(self, client, auth_headers):
        resp = client.get("/api/v1/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "admin@test.com"
        assert data["is_superuser"] is True

    def test_me_no_token(self, client):
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code in (401, 403)

    def test_me_invalid_token(self, client):
        resp = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert resp.status_code == 401


class TestLogout:
    def test_logout_ok(self, client, auth_headers):
        resp = client.post("/api/v1/auth/logout", headers=auth_headers)
        assert resp.status_code == 200
        assert "message" in resp.json()

    def test_logout_no_token(self, client):
        resp = client.post("/api/v1/auth/logout")
        assert resp.status_code in (401, 403)
