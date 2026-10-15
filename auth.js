const AUTH_KEY    = "transbilet.users";
const SESSION_KEY = "transbilet.session";

function readUsers() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || []; }
  catch { return []; }
}
function saveUsers(users) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(users));
}
function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
  catch { return null; }
}
function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    email: user.email, name: user.name, at: Date.now()
  }));
  updateAuthUI();
}
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  updateAuthUI();
}
function weakHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
  return String(h >>> 0);
}

function register({ name, email, password }) {
  const users = readUsers();
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { ok: false, message: "Пользователь с таким email уже зарегистрирован." };
  }
  const user = { name: name, email: email, passwordHash: weakHash(password) };
  users.push(user);
  saveUsers(users);
  saveSession(user);
  return { ok: true, message: "Регистрация прошла успешно." };
}

function login({ email, password }) {
  const users = readUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return { ok: false, message: "Пользователь не найден." };
  if (user.passwordHash !== weakHash(password))
    return { ok: false, message: "Неверный пароль." };
  saveSession(user);
  return { ok: true, message: "Здравствуйте, " + user.name + "!" };
}

function logout() {
  clearSession();
  location.href = "index.html";
}

function currentUser() { return readSession(); }
function isLoggedIn() { return currentUser() !== null; }

function requireAuth(redirect) {
  redirect = redirect || "login.html";
  if (!isLoggedIn()) {
    const back = encodeURIComponent(location.pathname + location.search);
    location.href = redirect + "?next=" + back;
  }
}

function updateAuthUI() {
  const slot = document.querySelector("[data-auth-slot]");
  if (!slot) return;
  const user = currentUser();
  if (user) {
    slot.innerHTML =
      '<span class="user-name">' + user.name + '</span>' +
      '<button type="button" class="btn btn-link" onclick="logout()">Выйти</button>';
  } else {
    slot.innerHTML = '<a href="login.html" class="btn btn-link">Войти</a>';
  }
}

document.addEventListener("DOMContentLoaded", updateAuthUI);