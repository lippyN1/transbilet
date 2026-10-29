from contextlib import asynccontextmanager
from pathlib import Path
import hashlib, hmac, secrets, sqlite3
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Header
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr, Field

BASE = Path(__file__).resolve().parent
DB_PATH = Path(__import__("os").environ.get("WAYGO_DB", BASE / "waygo.db"))
PAGES = {"home": "index.html", "catalog": "catalog.html", "ticket": "ticket.html",
         "booking": "booking.html", "contacts": "contacts.html", "auth": "auth.html", "explore": "explore.html"}

TRIPS = [
 {"id":1,"origin":"Москва","destination":"Санкт-Петербург","origin_code":"MOW","destination_code":"LED","transport":"Самолёт","carrier":"Nordwind","depart":"07:15","arrive":"08:45","date":"2026-11-04","duration":"1 ч 30 мин","price":5890,"currency":"₽","badge":"Популярное","color":"violet"},
 {"id":2,"origin":"Москва","destination":"Казань","origin_code":"MOW","destination_code":"KZN","transport":"Самолёт","carrier":"Smartavia","depart":"09:20","arrive":"10:55","date":"2026-11-05","duration":"1 ч 35 мин","price":4290,"currency":"₽","badge":"Выгодно","color":"blue"},
 {"id":3,"origin":"Санкт-Петербург","destination":"Калининград","origin_code":"LED","destination_code":"KGD","transport":"Самолёт","carrier":"Nordwind","depart":"11:40","arrive":"13:15","date":"2026-11-06","duration":"1 ч 35 мин","price":6390,"currency":"₽","badge":"Прямой рейс","color":"orange"},
 {"id":4,"origin":"Москва","destination":"Сочи","origin_code":"MOW","destination_code":"AER","transport":"Самолёт","carrier":"Pobeda","depart":"06:30","arrive":"10:20","date":"2026-11-07","duration":"3 ч 50 мин","price":7290,"currency":"₽","badge":"Популярное","color":"blue"},
 {"id":5,"origin":"Казань","destination":"Москва","origin_code":"KZN","destination_code":"MOW","transport":"Поезд","carrier":"РЖД","depart":"20:10","arrive":"08:30","date":"2026-11-08","duration":"12 ч 20 мин","price":3190,"currency":"₽","badge":"Ночной поезд","color":"green"},
 {"id":6,"origin":"Москва","destination":"Нижний Новгород","origin_code":"MOW","destination_code":"GOJ","transport":"Поезд","carrier":"РЖД","depart":"08:05","arrive":"12:10","date":"2026-11-04","duration":"4 ч 05 мин","price":1890,"currency":"₽","badge":"Быстро","color":"green"},
 {"id":7,"origin":"Санкт-Петербург","destination":"Москва","origin_code":"LED","destination_code":"MOW","transport":"Поезд","carrier":"Сапсан","depart":"07:00","arrive":"10:50","date":"2026-11-05","duration":"3 ч 50 мин","price":3490,"currency":"₽","badge":"Комфорт","color":"green"},
 {"id":8,"origin":"Москва","destination":"Минск","origin_code":"MOW","destination_code":"MSQ","transport":"Самолёт","carrier":"Belavia","depart":"14:25","arrive":"16:00","date":"2026-11-09","duration":"1 ч 35 мин","price":8990,"currency":"₽","badge":"Международный","color":"violet"},
 {"id":9,"origin":"Екатеринбург","destination":"Москва","origin_code":"SVX","destination_code":"MOW","transport":"Самолёт","carrier":"Ural Airlines","depart":"12:15","arrive":"14:35","date":"2026-11-10","duration":"2 ч 20 мин","price":6790,"currency":"₽","badge":"Прямой рейс","color":"orange"},
 {"id":10,"origin":"Москва","destination":"Ярославль","origin_code":"MOW","destination_code":"IAR","transport":"Автобус","carrier":"BusLine","depart":"10:00","arrive":"14:10","date":"2026-11-04","duration":"4 ч 10 мин","price":990,"currency":"₽","badge":"Бюджетно","color":"orange"},
 {"id":11,"origin":"Сочи","destination":"Москва","origin_code":"AER","destination_code":"MOW","transport":"Самолёт","carrier":"Pobeda","depart":"17:30","arrive":"21:15","date":"2026-11-11","duration":"3 ч 45 мин","price":6990,"currency":"₽","badge":"Выгодно","color":"blue"},
 {"id":12,"origin":"Москва","destination":"Санкт-Петербург","origin_code":"MOW","destination_code":"LED","transport":"Поезд","carrier":"Сапсан","depart":"15:00","arrive":"18:55","date":"2026-11-12","duration":"3 ч 55 мин","price":2790,"currency":"₽","badge":"Комфорт","color":"green"},
]

def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    with db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS trips (
          id INTEGER PRIMARY KEY, origin TEXT NOT NULL, destination TEXT NOT NULL,
          origin_code TEXT NOT NULL, destination_code TEXT NOT NULL, transport TEXT NOT NULL,
          carrier TEXT NOT NULL, depart TEXT NOT NULL, arrive TEXT NOT NULL, date TEXT NOT NULL,
          duration TEXT NOT NULL, price INTEGER NOT NULL, currency TEXT NOT NULL,
          badge TEXT NOT NULL, color TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS bookings (
          id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
          trip_id INTEGER NOT NULL REFERENCES trips(id), seat TEXT NOT NULL,
          passenger_name TEXT NOT NULL, created_at TEXT NOT NULL,
          UNIQUE(trip_id, seat)
        );
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL,
          message TEXT NOT NULL, created_at TEXT NOT NULL
        );
        """)
        count = c.execute("SELECT COUNT(*) FROM trips").fetchone()[0]
        if count == 0:
            c.executemany("""INSERT INTO trips VALUES
              (:id,:origin,:destination,:origin_code,:destination_code,:transport,:carrier,:depart,:arrive,:date,:duration,:price,:currency,:badge,:color)""", TRIPS)

@asynccontextmanager
async def lifespan(app):
    init_db()
    yield

app = FastAPI(title="WayGo — билеты на транспорт", version="1.0.0", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=BASE / "static"), name="static")

def page(name):
    return FileResponse(BASE / PAGES[name])

@app.get("/", include_in_schema=False)
def home(): return page("home")
@app.get("/catalog", include_in_schema=False)
def catalog(): return page("catalog")
@app.get("/ticket", include_in_schema=False)
def ticket_page(): return page("ticket")
@app.get("/booking", include_in_schema=False)
def booking_page(): return page("booking")
@app.get("/explore", include_in_schema=False)
def explore_page(): return page("explore")
@app.get("/contacts", include_in_schema=False)
def contacts_page(): return page("contacts")
@app.get("/auth", include_in_schema=False)
def auth_page(): return page("auth")

@app.get("/health")
def health(): return {"status":"ok","service":"WayGo"}

@app.get("/api/trips")
def list_trips(origin: Optional[str]=None, destination: Optional[str]=None,
               transport: Optional[str]=None, date: Optional[str]=None, sort: str="price_desc"):
    with db() as c:
        rows = [dict(r) for r in c.execute("SELECT * FROM trips").fetchall()]
    if origin:
        rows = [t for t in rows if origin.lower() in t["origin"].lower()]
    if destination:
        rows = [t for t in rows if destination.lower() in t["destination"].lower()]
    if transport and transport != "Все виды":
        rows = [t for t in rows if t["transport"] == transport]
    if date:
        rows = [t for t in rows if t["date"] == date]
    if sort == "price": rows.sort(key=lambda t:t["price"])
    elif sort == "price_desc": rows.sort(key=lambda t:t["price"], reverse=True)
    elif sort == "duration": rows.sort(key=lambda t:int(t["duration"].split()[0]) if t["duration"].split()[0].isdigit() else 999)
    return rows

@app.get("/api/trips/{trip_id}")
def get_trip(trip_id: int):
    with db() as c:
        row = c.execute("SELECT * FROM trips WHERE id=?", (trip_id,)).fetchone()
    if not row: raise HTTPException(404, "Рейс не найден")
    return dict(row)

@app.get("/api/trips/{trip_id}/seats")
def seats(trip_id: int):
    with db() as c:
        exists = c.execute("SELECT id FROM trips WHERE id=?", (trip_id,)).fetchone()
        if not exists: raise HTTPException(404, "Рейс не найден")
        occupied = {r["seat"] for r in c.execute("SELECT seat FROM bookings WHERE trip_id=?", (trip_id,))}
    return {"trip_id":trip_id, "seats":[{"seat":f"{row}{letter}","occupied":f"{row}{letter}" in occupied}
       for row in range(1,7) for letter in "ABCDEF"]}

class RegisterBody(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
class BookingBody(BaseModel):
    trip_id: int
    seat: str = Field(pattern=r"^[1-6][A-F]$")
    passenger_name: str = Field(min_length=2, max_length=100)
class ContactBody(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    message: str = Field(min_length=10, max_length=2000)

def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 180_000).hex()
    return f"{salt}${digest}"

def verify_password(password, stored):
    try:
        salt, digest = stored.split("$",1)
        return hmac.compare_digest(password_hash(password, salt).split("$",1)[1], digest)
    except ValueError: return False

def current_user(authorization: Optional[str]):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Войдите в аккаунт, чтобы продолжить")
    token = authorization[7:]
    with db() as c:
        row = c.execute("""SELECT users.id, users.name, users.email FROM users
          JOIN sessions ON sessions.user_id=users.id WHERE sessions.token=? AND sessions.expires_at>?""",
          (token, datetime.now(timezone.utc).isoformat())).fetchone()
    if not row: raise HTTPException(401, "Сессия истекла. Войдите снова")
    return dict(row)

@app.post("/api/auth/register", status_code=201)
def register(body: RegisterBody):
    with db() as c:
        if c.execute("SELECT id FROM users WHERE email=?", (body.email.lower(),)).fetchone():
            raise HTTPException(409, "Аккаунт с этой почтой уже существует")
        cur = c.execute("INSERT INTO users(name,email,password_hash,created_at) VALUES(?,?,?,?)",
          (body.name.strip(), body.email.lower(), password_hash(body.password), datetime.now(timezone.utc).isoformat()))
        user_id = cur.lastrowid
        token = secrets.token_urlsafe(32)
        c.execute("INSERT INTO sessions VALUES(?,?,?)", (token,user_id,(datetime.now(timezone.utc)+timedelta(days=7)).isoformat()))
    return {"token":token,"user":{"id":user_id,"name":body.name.strip(),"email":body.email.lower()}}

@app.post("/api/auth/login")
def login(body: LoginBody):
    with db() as c:
        row = c.execute("SELECT * FROM users WHERE email=?", (body.email.lower(),)).fetchone()
        if not row or not verify_password(body.password,row["password_hash"]):
            raise HTTPException(401, "Неверная почта или пароль")
        token = secrets.token_urlsafe(32)
        c.execute("INSERT INTO sessions VALUES(?,?,?)", (token,row["id"],(datetime.now(timezone.utc)+timedelta(days=7)).isoformat()))
    return {"token":token,"user":{"id":row["id"],"name":row["name"],"email":row["email"]}}

@app.get("/api/auth/me")
def me(authorization: Optional[str]=Header(default=None)):
    return {"user":current_user(authorization)}

@app.post("/api/auth/logout")
def logout(authorization: Optional[str]=Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        with db() as c: c.execute("DELETE FROM sessions WHERE token=?", (authorization[7:],))
    return {"ok":True}

@app.post("/api/bookings", status_code=201)
def create_booking(body: BookingBody, authorization: Optional[str]=Header(default=None)):
    user = current_user(authorization)
    with db() as c:
        trip = c.execute("SELECT * FROM trips WHERE id=?", (body.trip_id,)).fetchone()
        if not trip: raise HTTPException(404,"Рейс не найден")
        try:
            cur = c.execute("INSERT INTO bookings(user_id,trip_id,seat,passenger_name,created_at) VALUES(?,?,?,?,?)",
              (user["id"],body.trip_id,body.seat,body.passenger_name.strip(),datetime.now(timezone.utc).isoformat()))
        except sqlite3.IntegrityError:
            raise HTTPException(409,"Это место уже занято. Выберите другое")
        booking = c.execute("SELECT * FROM bookings WHERE id=?", (cur.lastrowid,)).fetchone()
    return {"booking":dict(booking),"trip":dict(trip),"total":trip["price"]}

@app.get("/api/bookings")
def my_bookings(authorization: Optional[str]=Header(default=None)):
    user = current_user(authorization)
    with db() as c:
        rows = c.execute("""SELECT b.id AS booking_id,b.seat,b.passenger_name,b.created_at,
          t.origin,t.destination,t.date,t.depart,t.arrive,t.carrier,t.transport,t.price,t.currency
          FROM bookings b JOIN trips t ON t.id=b.trip_id WHERE b.user_id=? ORDER BY b.id DESC""",(user["id"],)).fetchall()
    return [dict(r) for r in rows]

@app.post("/api/contacts", status_code=201)
def send_contact(body: ContactBody):
    with db() as c:
        c.execute("INSERT INTO messages(name,email,message,created_at) VALUES(?,?,?,?)",
          (body.name.strip(),body.email.lower(),body.message.strip(),datetime.now(timezone.utc).isoformat()))
    return {"ok":True,"message":"Сообщение сохранено. Спасибо!"}
