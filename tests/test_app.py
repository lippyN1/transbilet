import os, tempfile, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
import app as waygo

def setup_module():
    # Tests use an isolated SQLite file.
    waygo.DB_PATH = __import__("pathlib").Path(tempfile.gettempdir()) / "waygo_test.db"
    if waygo.DB_PATH.exists(): waygo.DB_PATH.unlink()

def test_catalog_has_twelve_routes():
    with TestClient(waygo.app) as client:
        r = client.get("/api/trips")
        assert r.status_code == 200
        assert len(r.json()) >= 12

def test_price_descending_sort():
    with TestClient(waygo.app) as client:
        r = client.get("/api/trips?sort=price_desc")
        assert r.status_code == 200
        prices = [trip["price"] for trip in r.json()]
        assert prices == sorted(prices, reverse=True)

def test_register_login_and_booking():
    with TestClient(waygo.app) as client:
        email = "test-waygo@example.com"
        # allow repeat runs
        with waygo.db() as c:
            c.execute("DELETE FROM users WHERE email=?", (email,))
        reg = client.post("/api/auth/register", json={"name":"Test User","email":email,"password":"safe-pass-123"})
        assert reg.status_code == 201, reg.text
        token = reg.json()["token"]
        headers = {"Authorization":f"Bearer {token}"}
        booking = client.post("/api/bookings", headers=headers,
                              json={"trip_id":1,"seat":"6F","passenger_name":"Test User"})
        assert booking.status_code == 201, booking.text
        assert client.get("/api/bookings", headers=headers).json()[0]["seat"] == "6F"
        assert client.post("/api/bookings", headers=headers,
                           json={"trip_id":1,"seat":"6F","passenger_name":"Other User"}).status_code == 409
        login = client.post("/api/auth/login", json={"email":email,"password":"safe-pass-123"})
        assert login.status_code == 200
        login_token = login.json()["token"]
        # The session returned by login must remain valid on subsequent pages/API calls.
        me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {login_token}"})
        assert me.status_code == 200
        assert me.json()["user"]["email"] == email
        assert client.get("/api/bookings", headers={"Authorization": f"Bearer {login_token}"}).status_code == 200


def test_auth_navigation_preserves_existing_session():
    js = (Path(__file__).resolve().parents[1] / "static" / "app.js").read_text(encoding="utf-8")
    assert 'const tokenKey = "waygo_token"' in js
    assert 'link.href="/account"' in js
    assert 'api("/api/auth/me").then(me=>{location.replace(me.user?.is_admin?"/admin":"/account")})' in js

def test_pages_and_health():
    with TestClient(waygo.app) as client:
        for url in ["/","/catalog","/ticket","/booking","/contacts","/auth","/explore","/account","/profile","/admin"]:
            assert client.get(url).status_code == 200
        assert client.get("/health").json()["status"] == "ok"


def test_auth_page_contains_only_authentication_ui():
    with TestClient(waygo.app) as client:
        page = client.get('/auth').text
        assert 'id="login-form"' in page
        assert 'id="register-form"' in page
        assert 'class="site-header"' not in page
        assert 'class="site-footer"' not in page
        assert 'class="auth-promo"' not in page


def test_account_page_has_profile_and_booking_history():
    with TestClient(waygo.app) as client:
        page = client.get('/account').text
        assert 'id="profile-name"' in page
        assert 'id="profile-email"' in page
        assert 'id="profile-booking-count"' in page
        assert 'id="account-bookings"' in page
        assert 'id="logout-button"' in page


def test_logout_invalidates_session():
    with TestClient(waygo.app) as client:
        email = 'logout-waygo@example.com'
        with waygo.db() as c:
            c.execute('DELETE FROM users WHERE email=?', (email,))
        reg = client.post('/api/auth/register', json={
            'name': 'Logout User', 'email': email, 'password': 'safe-pass-456'
        })
        assert reg.status_code == 201, reg.text
        headers = {'Authorization': f"Bearer {reg.json()['token']}"}
        assert client.get('/api/auth/me', headers=headers).status_code == 200
        assert client.post('/api/auth/logout', headers=headers).status_code == 200
        assert client.get('/api/auth/me', headers=headers).status_code == 401


def test_admin_database_is_protected_and_available_to_admin():
    with TestClient(waygo.app) as client:
        email = "admin-check@example.com"
        with waygo.db() as c:
            c.execute("DELETE FROM users WHERE email=?", (email,))
        reg = client.post("/api/auth/register", json={"name":"Admin Check","email":email,"password":"safe-pass-123"})
        assert reg.status_code == 201
        headers = {"Authorization": f"Bearer {reg.json()['token']}"}
        assert client.get("/api/admin/overview", headers=headers).status_code == 403
        with waygo.db() as c:
            c.execute("UPDATE users SET is_admin=1 WHERE email=?", (email,))
        assert client.get("/api/admin/overview", headers=headers).status_code == 200
        data = client.get("/api/admin/overview", headers=headers).json()
        assert {"users", "bookings", "messages", "trips"} <= set(data["stats"])
        assert "trips" in data and "tables" in data
        assert any(t["name"] == "users" for t in data["tables"])
        assert "password_hash" not in str(data)


def test_demo_admin_account_can_login():
    with TestClient(waygo.app) as client:
        login = client.post("/api/auth/login", json={
            "email": "admin@waygo.app",
            "password": "AdminWayGo123",
        })
        assert login.status_code == 200, login.text
        body = login.json()
        assert body["user"]["is_admin"] is True
        headers = {"Authorization": f"Bearer {body['token']}"}
        overview = client.get("/api/admin/overview", headers=headers)
        assert overview.status_code == 200
        assert 'id="admin-root"' in client.get("/admin").text


def test_weather_and_map_api_validate_city(monkeypatch):
    with TestClient(waygo.app) as client:
        assert client.get("/api/weather?city=x").status_code == 422
        assert client.get("/api/map?city=x").status_code == 422


def test_map_api_returns_coordinates_for_leaflet():
    with TestClient(waygo.app) as client:
        response = client.get("/api/map", params={"city": "Москва"})
        assert response.status_code == 200, response.text
        data = response.json()
        assert "latitude" in data and "longitude" in data
        assert data["place"]["name"]
        assert "embed_url" not in data
