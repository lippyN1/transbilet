document.addEventListener("DOMContentLoaded", () => {
  if (typeof requireAuth === "function") requireAuth("login.html");

  const pending = readPendingOrder();
  const trip    = pending ? getTripById(pending.tripId) : null;

  const summaryBox = document.getElementById("order-summary");
  const form       = document.getElementById("order-form");
  const listBox    = document.getElementById("my-tickets");

  if (trip) {
    summaryBox.innerHTML =
      '<h2>Состав заказа</h2>' +
      '<ul>' +
        '<li>Рейс: ' + trip.from + ' → ' + trip.to + ', ' + trip.transport + '</li>' +
        '<li>Время в пути: ' + formatDuration(trip.duration) + '</li>' +
        '<li>Место: № ' + pending.seat + '</li>' +
      '</ul>' +
      '<p class="total">Итого: <strong>' + formatPrice(trip.price) + '</strong></p>';

    const user = currentUser();
    if (user) {
      form.fio.value   = user.name;
      form.email.value = user.email;
    }
  } else {
    summaryBox.innerHTML = '<p class="note">Сначала выберите рейс и место в <a href="catalog.html">каталоге</a>.</p>';
    form.querySelectorAll("input, select, button").forEach(el => el.disabled = true);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearErrors(form);

    const errors = validateOrderForm(form);
    if (errors.length) {
      errors.forEach(item => showError(form, item.field, item.message));
      showToast("Проверьте заполнение формы", "error");
      return;
    }
    if (!trip) return;

    const ticket = {
      id: Date.now(),
      tripId: trip.id,
      route: trip.from + " → " + trip.to,
      transport: trip.transport,
      seat: pending.seat,
      date: form.date.value,
      fio: form.fio.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      price: trip.price
    };
    const tickets = readTickets();
    tickets.push(ticket);
    localStorage.setItem("transbilet.tickets", JSON.stringify(tickets));
    localStorage.removeItem("transbilet.pendingOrder");

    showToast("Билет оформлен. Место " + ticket.seat, "ok");
    renderTickets();
    form.reset();
  });

  function renderTickets() {
    const tickets = readTickets();
    if (!tickets.length) {
      listBox.innerHTML = '<p class="note">Пока нет оформленных билетов.</p>';
      return;
    }
    listBox.innerHTML =
      '<h2>Мои билеты</h2>' +
      '<div class="table-wrap"><table class="catalog-table"><thead><tr>' +
      '<th>Маршрут</th><th>Транспорт</th><th>Дата</th><th>Место</th><th>Пассажир</th><th>Цена</th>' +
      '</tr></thead><tbody>' +
      tickets.map(t =>
        '<tr><td>' + t.route + '</td><td>' + t.transport + '</td><td>' + t.date + '</td>' +
        '<td>' + t.seat + '</td><td>' + t.fio + '</td><td>' + formatPrice(t.price) + '</td></tr>'
      ).join("") +
      '</tbody></table></div>';
  }

  renderTickets();
});

function validateOrderForm(form) {
  const errors = [];
  if (form.fio.value.trim().length < 5)
    errors.push({ field: "fio", message: "Укажите ФИО полностью." });
  if (!/^\+?[\d\s\-()]{10,}$/.test(form.phone.value.trim()))
    errors.push({ field: "phone", message: "Телефон в формате +7 (900) 000-00-00." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value.trim()))
    errors.push({ field: "email", message: "Некорректный email." });
  if (!form.date.value)
    errors.push({ field: "date", message: "Выберите дату поездки." });
  return errors;
}
function showError(form, name, message) {
  const field = form.elements[name];
  if (!field) return;
  field.setAttribute("aria-invalid", "true");
  const p = document.createElement("p");
  p.className = "field-error";
  p.textContent = message;
  field.insertAdjacentElement("afterend", p);
}
function clearErrors(form) {
  form.querySelectorAll(".field-error").forEach(el => el.remove());
  form.querySelectorAll("[aria-invalid]").forEach(el => el.removeAttribute("aria-invalid"));
}
function readPendingOrder() {
  try { return JSON.parse(localStorage.getItem("transbilet.pendingOrder")); }
  catch { return null; }
}
function readTickets() {
  try { return JSON.parse(localStorage.getItem("transbilet.tickets")) || []; }
  catch { return []; }
}