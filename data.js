const TRIPS = [
  { id: 1,  from: "Москва",          to: "Тула",            transport: "Автобус", duration: 200, price: 650,  seats: 8,  taken: [3, 6] },
  { id: 2,  from: "Москва",          to: "Санкт-Петербург", transport: "Поезд",   duration: 400, price: 1800, seats: 12, taken: [2, 5, 9] },
  { id: 3,  from: "Москва",          to: "Казань",          transport: "Самолёт", duration: 85,  price: 3200, seats: 20, taken: [1, 7, 12, 15] },
  { id: 4,  from: "Москва",          to: "Ярославль",       transport: "Автобус", duration: 250, price: 800,  seats: 8,  taken: [4] },
  { id: 5,  from: "Москва",          to: "Нижний Новгород", transport: "Поезд",   duration: 235, price: 1400, seats: 10, taken: [2, 8] },
  { id: 6,  from: "Москва",          to: "Сочи",            transport: "Самолёт", duration: 170, price: 4100, seats: 20, taken: [3, 11, 18] },
  { id: 7,  from: "Санкт-Петербург", to: "Москва",          transport: "Поезд",   duration: 390, price: 1750, seats: 12, taken: [1, 6, 10] },
  { id: 8,  from: "Казань",          to: "Екатеринбург",    transport: "Поезд",   duration: 860, price: 2600, seats: 10, taken: [5] },
  { id: 9,  from: "Новосибирск",     to: "Омск",            transport: "Автобус", duration: 555, price: 1100, seats: 8,  taken: [7] },
  { id: 10, from: "Краснодар",       to: "Сочи",            transport: "Автобус", duration: 340, price: 950,  seats: 8,  taken: [2, 4] },
  { id: 11, from: "Екатеринбург",    to: "Москва",          transport: "Самолёт", duration: 155, price: 3900, seats: 20, taken: [9, 14] },
  { id: 12, from: "Владивосток",     to: "Хабаровск",       transport: "Поезд",   duration: 730, price: 2200, seats: 10, taken: [3, 5, 8] }
];

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return m + " мин";
  if (m === 0) return h + " ч";
  return h + " ч " + m + " мин";
}

function formatPrice(value) {
  return value.toLocaleString("ru-RU") + " ₽";
}

function getTripById(id) {
  return TRIPS.find(t => t.id === Number(id)) || null;
}