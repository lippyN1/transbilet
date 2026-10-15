document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search);
  const id     = Number(params.get("id")) || 1;
  const trip   = getTripById(id);

  if (!trip) {
    document.getElementById("trip-title").textContent = "Рейс не найден";
    return;
  }

  document.getElementById("trip-title").textContent = trip.transport + " " + trip.from + " → " + trip.to;
  document.getElementById("trip-from").textContent  = trip.from;
  document.getElementById("trip-to").textContent    = trip.to;
  document.getElementById("trip-dur").textContent   = formatDuration(trip.duration);
  document.getElementById("trip-price").textContent = formatPrice(trip.price);

  const seatMap       = document.getElementById("seat-map");
  const selectedLabel = document.getElementById("selected-seat");
  const checkoutBtn   = document.getElementById("checkout-btn");
  let selectedSeat = null;

  for (let n = 1; n <= trip.seats; n++) {
    const taken = trip.taken.indexOf(n) !== -1;
    const seat  = document.createElement("button");
    seat.type = "button";
    seat.className = "seat" + (taken ? " taken" : "");
    seat.textContent = n;
    seat.disabled = taken;
    seat.setAttribute("aria-label", taken ? "Место " + n + ", занято" : "Место " + n + ", свободно");

    if (!taken) {
      seat.addEventListener("click", () => {
        seatMap.querySelectorAll(".seat.selected").forEach(s => s.classList.remove("selected"));
        seat.classList.add("selected");
        selectedSeat = n;
        selectedLabel.textContent = "Выбрано место: " + n;
        checkoutBtn.disabled = false;
        checkoutBtn.classList.remove("btn--disabled");
      });
    }
    seatMap.appendChild(seat);
  }

  checkoutBtn.addEventListener("click", () => {
    if (!selectedSeat) return;
    if (typeof isLoggedIn === "function" && !isLoggedIn()) {
      showToast("Чтобы оформить билет, войдите или зарегистрируйтесь", "error");
      const next = encodeURIComponent("item.html?id=" + trip.id);
      setTimeout(() => location.href = "login.html?next=" + next, 700);
      return;
    }
    localStorage.setItem("transbilet.pendingOrder", JSON.stringify({
      tripId: trip.id, seat: selectedSeat
    }));
    location.href = "action.html";
  });

  loadWeather(trip.to);
  loadMap(trip.to);
});

// =============== Погода (Open-Meteo) ===============
async function loadWeather(city) {
  const box = document.getElementById("weather-box");
  if (!box) return;
  box.textContent = "Загружаем погоду…";

  try {
    const geoRes = await fetch(
      "https://geocoding-api.open-meteo.com/v1/search?name=" +
      encodeURIComponent(city) + "&count=1&language=ru&format=json"
    );
    if (!geoRes.ok) throw new Error("geocoder");
    const geo = await geoRes.json();

    if (!geo.results || geo.results.length === 0) {
      box.textContent = "Не удалось определить координаты города " + city + ".";
      return;
    }
    const g = geo.results[0];

    const wxRes = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=" + g.latitude +
      "&longitude=" + g.longitude + "&current=temperature_2m,wind_speed_10m"
    );
    if (!wxRes.ok) throw new Error("weather");
    const wx = await wxRes.json();

    box.innerHTML =
      "<strong>" + g.name + ", " + g.country + "</strong><br>" +
      "Температура: " + wx.current.temperature_2m + " °C, " +
      "ветер: " + wx.current.wind_speed_10m + " м/с";
  } catch (err) {
    console.error(err);
    box.textContent = "Погода временно недоступна.";
  }
}

// =============== Карта (MapLibre GL) ===============
async function loadMap(city) {
  const container = document.getElementById("map");
  if (!container) return;

  try {
    const geoRes = await fetch(
      "https://geocoding-api.open-meteo.com/v1/search?name=" +
      encodeURIComponent(city) + "&count=1&language=ru&format=json"
    );
    if (!geoRes.ok) throw new Error("geocoder");
    const geo = await geoRes.json();

    if (!geo.results || geo.results.length === 0) {
      container.textContent = "Карта недоступна: город не найден.";
      return;
    }
    const g = geo.results[0];

    const map = new maplibregl.Map({
      container: "map",
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors"
          }
        },
        layers: [
          { id: "osm", type: "raster", source: "osm" }
        ]
      },
      center: [g.longitude, g.latitude],
      zoom: 12
    });

    map.addControl(new maplibregl.NavigationControl());

    new maplibregl.Marker()
      .setLngLat([g.longitude, g.latitude])
      .setPopup(
        new maplibregl.Popup({ offset: 25 })
          .setHTML("<strong>Автостанция</strong><br>" + g.name)
      )
      .addTo(map)
      .togglePopup();

  } catch (err) {
    console.error(err);
    container.textContent = "Карта временно недоступна.";
  }
}