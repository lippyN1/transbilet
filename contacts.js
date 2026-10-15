document.addEventListener("DOMContentLoaded", () => {
  const form   = document.getElementById("feedback-form");
  const status = document.getElementById("feedback-status");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    status.textContent = "";
    status.className = "form-status";

    const name    = form.name.value.trim();
    const email   = form.email.value.trim();
    const message = form.message.value.trim();

    const errors = [];
    if (name.length < 2) errors.push("Укажите имя.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Некорректный email.");
    if (message.length < 10) errors.push("Сообщение короче 10 символов.");

    if (errors.length) {
      status.textContent = errors.join(" ");
      status.classList.add("form-status--error");
      showToast("Проверьте форму", "error");
      return;
    }

    status.textContent = "Спасибо, " + name + "! Мы ответим на " + email + ".";
    status.classList.add("form-status--ok");
    showToast("Сообщение отправлено");
    form.reset();
  });
});