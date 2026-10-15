document.addEventListener("DOMContentLoaded", () => {
  const form      = document.getElementById("filters-form");
  const tableBody = document.getElementById("catalog-body");
  const counter   = document.getElementById("catalog-counter");
  const resetBtn  = document.getElementById("filters-reset");

  render(TRIPS);
  form.addEventListener("input", applyFilters);
  form.addEventListener("submit", (e) => { e.preventDefault(); applyFilters(); });
  resetBtn.addEventListener("click", () => {
    form.reset();
    applyFilters();
    showToast("Фильтры сброшены");
  });

  function applyFilters() {
    const from      = form.from.value.trim().toLowerCase();
    const to        = form.to.value.trim().toLowerCase();
    const transport = form.transport.value;
    const sort      = form.sort.value;

    let result = TRIPS.filter(t => {
      const okFrom = !from      || t.from.toLowerCase().indexOf(from) !== -1;
      const okTo   = !to        || t.to.toLowerCase().indexOf(to)     !== -1;
      const okT    = !transport || t.transport === transport;
      return okFrom && okTo && okT;
    });

    if (sort === "price-asc")  result.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") result.sort((a, b) => b.price - a.price);
    if (sort === "time-asc")   result.sort((a, b) => a.duration - b.duration);

    render(result);
  }

  function render(list) {
    if (list.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5">Ничего не найдено. Измените условия поиска.</td></tr>';
      counter.textContent = "Найдено рейсов: 0";
      return;
    }
    tableBody.innerHTML = list.map(trip =>
      '<tr class="row-appear">' +
        '<td>' + trip.from + ' → ' + trip.to + '</td>' +
        '<td>' + trip.transport + '</td>' +
        '<td>' + formatDuration(trip.duration) + '</td>' +
        '<td>' + formatPrice(trip.price) + '</td>' +
        '<td><a href="item.html?id=' + trip.id + '" class="btn btn-small">Выбрать</a></td>' +
      '</tr>'
    ).join("");
    counter.textContent = "Найдено рейсов: " + list.length;
    tableBody.querySelectorAll(".row-appear").forEach((row, i) => {
      row.style.animationDelay = (i * 30) + "ms";
    });
  }
});