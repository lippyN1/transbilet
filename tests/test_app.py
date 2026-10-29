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

def test_pages_and_health():
    with TestClient(waygo.app) as client:
        for url in ["/","/catalog","/ticket","/booking","/contacts","/auth","/explore"]:
            assert client.get(url).status_code == 200
        assert client.get("/health").json()["status"] == "ok"
