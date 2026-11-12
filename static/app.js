const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const tokenKey = "waygo_token";
const money = n => new Intl.NumberFormat("ru-RU").format(n) + " ₽";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function apiErrorDetail(data){
  const d=data?.detail;
  if(typeof d==="string") return d;
  if(Array.isArray(d)) return d.map(item=>item?.msg||item?.detail||String(item)).join("; ");
  if(d && typeof d==="object" && d.msg) return d.msg;
  return "Произошла ошибка";
}
async function api(url, options={}) {
  const headers = {"Content-Type":"application/json", ...(options.headers||{})};
  const token = localStorage.getItem(tokenKey);
  if(token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, {...options, headers});
  const data = await response.json().catch(()=>({detail:"Не удалось прочитать ответ сервера"}));
  if(!response.ok) throw new Error(apiErrorDetail(data));
  return data;
}
function message(el, text, type="") { if(!el) return; el.textContent=text; el.className="form-message"+(type?" "+type:""); }
function weatherDescription(code){const c=Number(code);if(c===0)return "Ясно";if([1,2,3].includes(c))return "Переменная облачность";if([45,48].includes(c))return "Туман";if([51,53,55,56,57].includes(c))return "Морось";if([61,63,65,66,67,80,81,82].includes(c))return "Дождь";if([71,73,75,77,85,86].includes(c))return "Снег";if([95,96,99].includes(c))return "Гроза";return "Погодные условия";}
async function getPlaceWeather(city){return api(`/api/weather?city=${encodeURIComponent(city)}`);}
function weatherMarkup(data){const w=data.weather;const code=Number(w.weather_code);const icon=code===0?"☀":code>=71?"❄":code>=61?"🌧":"☁";return `<div class="weather-icon" aria-hidden="true">${icon}</div><div class="weather-details"><div class="weather-place">${esc(data.place.name)}${data.place.country?`, ${esc(data.place.country)}`:""}</div><div class="weather-temperature">${Math.round(w.temperature_2m)}°C</div><h3>${weatherDescription(code)}</h3><p>Ощущается как ${Math.round(w.apparent_temperature)}°C · Ветер ${Math.round(w.wind_speed_10m)} км/ч · Влажность ${Math.round(w.relative_humidity_2m)}%</p></div>`;}
let leafletReady=null;
const mapInstances={};
function loadLeaflet(){
  if(window.L) return Promise.resolve(window.L);
  if(leafletReady) return leafletReady;
  leafletReady=new Promise((resolve,reject)=>{
    const css=document.createElement("link");
    css.rel="stylesheet";
    css.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    css.integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
    css.crossOrigin="";
    document.head.appendChild(css);
    const script=document.createElement("script");
    script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    script.crossOrigin="";
    script.onload=()=>window.L?resolve(window.L):reject(new Error("Карта не загрузилась"));
    script.onerror=()=>reject(new Error("Не удалось загрузить карту"));
    document.head.appendChild(script);
  });
  return leafletReady;
}
async function renderInteractiveMap(mapId, place, zoom=12){
  const mapEl=document.getElementById(mapId);
  if(!mapEl||!place) return;
  const L=await loadLeaflet();
  if(mapInstances[mapId]){mapInstances[mapId].remove();delete mapInstances[mapId];}
  mapEl.innerHTML="";
  mapEl.classList.add("is-ready");
  const map=L.map(mapEl,{attributionControl:false,zoomControl:true,scrollWheelZoom:true})
    .setView([place.latitude, place.longitude], zoom);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{
    maxZoom:19
  }).addTo(map);
  L.circleMarker([place.latitude, place.longitude],{
    radius:9,color:"#6558e8",weight:2,fillColor:"#6558e8",fillOpacity:.92
  }).addTo(map);
  mapInstances[mapId]=map;
  requestAnimationFrame(()=>{map.invalidateSize();setTimeout(()=>map.invalidateSize(),120);});
  return map;
}
async function renderWeatherMap(city,{weatherHost,mapTitle,summary,mapId="destination-map"}={}){
  const data=await getPlaceWeather(city);
  if(weatherHost) weatherHost.innerHTML=weatherMarkup(data);
  if(summary) summary.textContent=`${Math.round(data.weather.temperature_2m)}°C · ${weatherDescription(data.weather.weather_code)} · ветер ${Math.round(data.weather.wind_speed_10m)} км/ч`;
  if(mapTitle) mapTitle.textContent=`${data.place.name} на карте`;
  const mapEl=document.getElementById(mapId);
  if(mapEl){
    try{
      const mapData=await api(`/api/map?city=${encodeURIComponent(city)}`);
      await renderInteractiveMap(mapId, mapData.place||data.place, mapData.zoom||12);
    }catch(mapErr){
      mapEl.innerHTML=`<p class="empty-state">${esc(mapErr.message||"Карта временно недоступна")}</p>`;
    }
  }
  return data;
}
async function exploreInit(){
  const form=$("#explore-form"); if(!form) return;
  const input=$("#explore-city"), host=$("#explore-weather"), status=$("#explore-status"), mapEl=$("#destination-map");
  const params=new URLSearchParams(location.search);
  if(params.get("city")) input.value=params.get("city");
  const run=async()=>{
    const city=input.value.trim();
    host.innerHTML='<div class="weather-loading">Загружаем прогноз…</div>';
    if(mapEl) mapEl.innerHTML='<div class="weather-loading map-loading">Загружаем карту…</div>';
    message(status,"");
    try{
      const d=await renderWeatherMap(city,{weatherHost:host,mapTitle:$("#explore-map-title")});
      const note=$("#explore-location-note");
      if(note) note.textContent=`${d.place.name}: используй + / − для масштаба карты.`;
    }catch(e){
      host.innerHTML=`<p class="empty-state">${esc(e.message)}</p>`;
      if(mapEl) mapEl.innerHTML=`<p class="empty-state">${esc(e.message)}</p>`;
      message(status,e.message,"error");
    }
  };
  form.addEventListener("submit",e=>{e.preventDefault();run();});
  run();
}
function activeNav(){
 const path=location.pathname==="/"?"home":location.pathname.slice(1);
 $$("[data-nav]").forEach(a=>{if(a.dataset.nav===path)a.classList.add("active")});
 const token=localStorage.getItem(tokenKey), link=$("#account-link");
 // A saved token means the user already has a session: send them to bookings,
 // not back to the login/registration screen on every page.
 if(link && token){link.textContent="Мой аккаунт";link.href="/account";}
}
function mobileNav(){
 const toggle=$(".menu-toggle"), nav=$(".main-nav");
 if(!toggle||!nav)return;
 toggle.addEventListener("click",()=>{const open=nav.classList.toggle("is-open");toggle.setAttribute("aria-expanded",String(open));toggle.textContent=open?"×":"☰";});
}
async function loadFeatured(){
 const host=$("#featured-trips"); if(!host)return;
 try {
   const trips=await api("/api/trips");
   const picks=[trips.find(t=>t.id===12),trips.find(t=>t.id===2),trips.find(t=>t.id===4)].filter(Boolean);
   const classes=["visual-petersburg","visual-kazan","visual-sochi"];
   const labels=["КУЛЬТУРА И АТМОСФЕРА","ВКУС ТРАДИЦИЙ","МОРЕ РЯДОМ"];
   host.innerHTML=picks.map((t,i)=>`<article class="destination-card"><div class="destination-visual ${classes[i]}"><span class="visual-label">${labels[i]}</span></div><div class="destination-info"><div><h3>${esc(t.origin)} <span>→</span> ${esc(t.destination)}</h3><p>${esc(t.transport)} · ${esc(t.duration)}</p></div><span class="price-tag">от ${money(t.price)}</span></div><a class="card-hit" href="/ticket?id=${t.id}" aria-label="Маршрут ${esc(t.origin)} — ${esc(t.destination)}"></a></article>`).join("");
 } catch(e) { /* static fallback cards remain available */ }
}
async function catalogInit(){
 const list=$("#trip-list"); if(!list)return;
 const origin=$("#filter-origin"), destination=$("#filter-destination"), transport=$("#filter-transport"), sort=$("#sort-trips");
 const params=new URLSearchParams(location.search);
 origin.value=params.get("origin")||"";destination.value=params.get("destination")||"";if(params.has("sort"))sort.value=params.get("sort");
 async function render(){
  list.innerHTML='<div class="loading-card">Подбираем маршруты…</div>';
  try {
   const q=new URLSearchParams();
   if(origin.value.trim())q.set("origin",origin.value.trim());
   if(destination.value.trim())q.set("destination",destination.value.trim());
   if(transport.value!=="Все виды")q.set("transport",transport.value);
   const homeDate=new URLSearchParams(location.search).get("date");
   if(homeDate)q.set("date",homeDate);
   q.set("sort",sort.value);
   const trips=await api("/api/trips?"+q.toString());
   $("#results-count").textContent=`Найдено вариантов: ${trips.length}`;
   if(!trips.length){list.innerHTML='<div class="empty-state">По этим параметрам ничего не найдено. Попробуй изменить фильтры.</div>';return}
   list.innerHTML=trips.map(t=>`<article class="trip-card"><div><span class="trip-badge">${esc(t.badge)}</span><div class="trip-mainline"><div class="trip-city"><strong>${esc(t.depart)}</strong><small>${esc(t.origin)} · ${esc(t.origin_code)}</small></div><div class="trip-duration"><div class="duration-line"><span>✈</span></div>${esc(t.duration)}</div><div class="trip-city"><strong>${esc(t.arrive)}</strong><small>${esc(t.destination)} · ${esc(t.destination_code)}</small></div></div><div class="trip-meta"><span>▣ ${esc(t.date)}</span><span>♧ ${esc(t.transport)}</span><span>✦ ${esc(t.carrier)}</span></div></div><div class="trip-price"><div><strong>${money(t.price)}</strong><br><small>за пассажира</small></div><a class="button button-primary" href="/ticket?id=${t.id}">Выбрать →</a></div></article>`).join("");
  } catch(e){list.innerHTML=`<div class="empty-state">${esc(e.message)}. Проверь, что сервер запущен.</div>`}
 }
 [origin,destination,transport,sort].forEach(el=>el.addEventListener(el.tagName==="INPUT"?"input":"change",render));
 $("#reset-filters")?.addEventListener("click",()=>{origin.value="";destination.value="";transport.value="Все виды";sort.value="price_desc";render()});
 render();
}
function homeSearch(){
 const form=$("#home-search"); if(!form)return;
 $("#swap-cities")?.addEventListener("click",()=>{const a=$("#origin"),b=$("#destination");[a.value,b.value]=[b.value,a.value]});
 form.addEventListener("submit",e=>{e.preventDefault();const q=new URLSearchParams();if($("#origin").value.trim())q.set("origin",$("#origin").value.trim());if($("#destination").value.trim())q.set("destination",$("#destination").value.trim());if($("#travel-date").value)q.set("date",$("#travel-date").value);location.href="/catalog?"+q.toString()});
}
async function ticketInit(){
 const host=$("#ticket-detail");if(!host)return;
 const id=new URLSearchParams(location.search).get("id")||"1";
 try{
  const t=await api(`/api/trips/${encodeURIComponent(id)}`);
  host.innerHTML=`<article class="detail-card"><span class="trip-badge">${esc(t.badge)}</span><h2>${esc(t.origin)} — ${esc(t.destination)}</h2><p class="muted">${esc(t.transport)} · ${esc(t.carrier)} · ${esc(t.date)}</p><div class="detail-route"><div class="detail-city"><strong>${esc(t.depart)}</strong><small>${esc(t.origin)} (${esc(t.origin_code)})</small></div><div class="detail-route-center"><span>${esc(t.duration)}</span><div class="line"></div><small>Прямой маршрут</small></div><div class="detail-city"><strong>${esc(t.arrive)}</strong><small>${esc(t.destination)} (${esc(t.destination_code)})</small></div></div><div class="detail-stats"><div class="stat-box"><small>Перевозчик</small><strong>${esc(t.carrier)}</strong></div><div class="stat-box"><small>Дата отправления</small><strong>${esc(t.date)}</strong></div><div class="stat-box"><small>Вид транспорта</small><strong>${esc(t.transport)}</strong></div></div><div class="detail-bottom"><div class="detail-price"><small>Стоимость за пассажира</small><strong>${money(t.price)}</strong></div><button class="button button-primary" id="choose-seat">Выбрать место <span>→</span></button></div><p class="form-footnote">Рейс и цена приведены для демонстрации учебного проекта.</p></article><section class="content-card ticket-weather-block"><div class="eyebrow">ПОГОДА В ПУНКТЕ ПРИБЫТИЯ</div><h2 class="ticket-weather-title">${esc(t.destination)}: перед поездкой</h2><div class="ticket-weather-summary" id="ticket-weather-summary"><div class="weather-loading">Загружаем прогноз…</div></div><div id="ticket-map" class="destination-map ticket-map"></div><a class="text-link" href="/explore?city=${encodeURIComponent(t.destination)}">Открыть подробную карту и прогноз →</a></section>`;
  $("#choose-seat").addEventListener("click",()=>location.href=`/booking?trip=${t.id}`);try{await renderWeatherMap(t.destination,{weatherHost:$("#ticket-weather-summary"),mapTitle:$(".ticket-weather-title"),mapId:"ticket-map"});}catch(err){const w=$("#ticket-weather-summary");if(w)w.innerHTML=`<p class="muted">${esc(err.message)}. Открой <a href="/explore?city=${encodeURIComponent(t.destination)}">карту и погоду</a>.</p>`}
 }catch(e){host.innerHTML=`<div class="empty-state">${esc(e.message)}. Вернись в <a class="text-link" href="/catalog">каталог</a>.</div>`}
}
let selectedSeat=null, selectedTrip=null, selectedTripData=null;
async function bookingInit(){
 const map=$("#seat-map");if(!map)return;
 const params=new URLSearchParams(location.search);selectedTrip=params.get("trip");
 const token=localStorage.getItem(tokenKey);
 if(selectedTrip){
  try{
   selectedTripData=await api(`/api/trips/${encodeURIComponent(selectedTrip)}`);
   $("#booking-route-hint").textContent=`${selectedTripData.origin} → ${selectedTripData.destination} · ${selectedTripData.date}`;
   $("#selected-price").textContent=money(selectedTripData.price);const wh=$("#booking-weather-title"),ws=$("#booking-weather-summary");if(wh)wh.textContent=`Погода в ${selectedTripData.destination}`;if(ws){try{await renderWeatherMap(selectedTripData.destination,{summary:ws});}catch(err){ws.textContent="Прогноз сейчас недоступен. Попробуй открыть карту и погоду.";}}
   const data=await api(`/api/trips/${selectedTrip}/seats`);
   map.innerHTML=data.seats.map(s=>`<button type="button" class="seat" data-seat="${s.seat}" ${s.occupied?"disabled aria-label='Место занято'":`aria-label="Выбрать место ${s.seat}"`}>${s.seat}</button>`).join("");
   $$(".seat:not(:disabled)",map).forEach(b=>b.addEventListener("click",()=>{$$(".seat",map).forEach(x=>x.classList.remove("selected"));b.classList.add("selected");selectedSeat=b.dataset.seat;$("#selected-seat").textContent=selectedSeat;}));
  }catch(e){map.innerHTML=`<p class="empty-state">${esc(e.message)}</p>`}
 }
 $("#booking-form")?.addEventListener("submit",async e=>{
  e.preventDefault();const status=$("#booking-message");
  if(!localStorage.getItem(tokenKey)){message(status,"Сначала войди или зарегистрируйся.","error");setTimeout(()=>location.href="/auth",900);return}
  if(!selectedTripData){message(status,"Сначала выбери маршрут в каталоге.","error");return}
  if(!selectedSeat){message(status,"Выбери свободное место на схеме.","error");return}
  try{const r=await api("/api/bookings",{method:"POST",body:JSON.stringify({trip_id:Number(selectedTrip),seat:selectedSeat,passenger_name:$("#passenger-name").value.trim()})});message(status,`Бронирование №${r.booking.id} создано. Оплата не требуется в демо-версии.`,"success");await renderBookings();const b=map.querySelector(`[data-seat="${selectedSeat}"]`);if(b){b.disabled=true;b.classList.remove("selected")}selectedSeat=null;$("#selected-seat").textContent="Не выбрано";}catch(err){message(status,err.message,"error");if(err.message.includes("занято")){const data=await api(`/api/trips/${selectedTrip}/seats`);const b=map.querySelector(`[data-seat="${selectedSeat}"]`);if(b)b.disabled=true}}
 });
 await renderBookings();
}
async function renderBookings(){
 const host=$("#my-bookings");if(!host)return;
 if(!localStorage.getItem(tokenKey)){host.innerHTML='<p class="muted">Войди, чтобы увидеть свои бронирования.</p><a class="text-link" href="/auth">Войти →</a>';return}
 try{const items=await api("/api/bookings");if(!items.length){host.innerHTML='<p class="muted">Пока нет билетов. Самое время выбрать маршрут!</p><a class="text-link" href="/catalog">Найти билет →</a>';return}
 host.innerHTML=items.map(b=>`<article class="ticket-history"><strong>${esc(b.origin)} → ${esc(b.destination)}</strong><small>${esc(b.date)} · ${esc(b.depart)} · место ${esc(b.seat)}</small><small>${esc(b.transport)} · ${esc(b.carrier)} · бронирование №${b.booking_id}</small><div class="history-price">${money(b.price)}</div></article>`).join("");
 }catch(e){host.innerHTML=`<p class="muted">${esc(e.message)}</p>`}
}
function authInit(){
 const tabs=$$(".auth-tab");if(!tabs.length)return;
 // Reuse a valid session after navigating between pages. If it has expired,
 // discard only that stale token and leave the user on the login tab.
 const savedToken=localStorage.getItem(tokenKey);
 if(savedToken){
  api("/api/auth/me").then(me=>{location.replace(me.user?.is_admin?"/admin":"/account")}).catch(()=>{localStorage.removeItem(tokenKey)});
 }
 tabs.forEach(tab=>tab.addEventListener("click",()=>{tabs.forEach(t=>{t.classList.toggle("is-active",t===tab);t.setAttribute("aria-selected",String(t===tab))});const reg=tab.dataset.mode==="register";const login=$("#login-panel"),register=$("#register-panel");login.hidden=reg;register.hidden=!reg;const active=reg?register:login;active.classList.remove("panel-replay");void active.offsetWidth;active.classList.add("panel-replay");}));
 $("#login-form")?.addEventListener("submit",async e=>{e.preventDefault();const status=$("#login-status");try{const data=await api("/api/auth/login",{method:"POST",body:JSON.stringify({email:$("#login-email").value.trim(),password:$("#login-password").value})});localStorage.setItem(tokenKey,data.token);message(status,"Вход выполнен. Перенаправляем…","success");const next=data.user?.is_admin?"/admin":"/account";setTimeout(()=>location.href=next,350)}catch(err){message(status,err.message,"error")}});
 $("#register-form")?.addEventListener("submit",async e=>{e.preventDefault();const status=$("#register-status");try{const data=await api("/api/auth/register",{method:"POST",body:JSON.stringify({name:$("#register-name").value.trim(),email:$("#register-email").value.trim(),password:$("#register-password").value})});localStorage.setItem(tokenKey,data.token);message(status,"Аккаунт создан. Перенаправляем…","success");setTimeout(()=>location.href="/account",350)}catch(err){message(status,err.message,"error")}});
}
async function accountInit(){
 const host=$("#account-bookings"); if(!host)return;
 const token=localStorage.getItem(tokenKey);
 if(!token){location.replace("/auth");return;}
 try{
  const [me,items]=await Promise.all([api("/api/auth/me"),api("/api/bookings")]);
  const user=me.user||{};
  $("#profile-name").textContent=user.name||"Путешественник WayGo";
  $("#profile-email").textContent=user.email||"";
  $("#profile-avatar").textContent=(user.name||"W").trim().charAt(0).toLocaleUpperCase("ru-RU");
  $("#profile-booking-count").textContent=items.length;
  $("#profile-member-since").textContent="Активен";
  if(user.is_admin){const actions=$(".profile-actions");if(actions&&!$("#admin-panel-link"))actions.insertAdjacentHTML("beforeend",'<a class="button button-outline" id="admin-panel-link" href="/admin">База данных →</a>');}
  if(!items.length){host.innerHTML='<div class="account-empty"><span class="account-empty-icon">✈</span><h3>Пока нет бронирований</h3><p>Самое время запланировать первую поездку.</p><a class="button button-primary" href="/catalog">Посмотреть билеты →</a></div>';}
  else host.innerHTML=items.map(b=>`<article class="ticket-history"><strong>${esc(b.origin)} → ${esc(b.destination)}</strong><small>${esc(b.date)} · отправление ${esc(b.depart)} · место ${esc(b.seat)}</small><small>${esc(b.transport)} · ${esc(b.carrier)} · бронирование №${b.booking_id}</small><div class="history-price">${money(b.price)}</div></article>`).join("");
 }catch(e){if(e.message.includes("Войдите")||e.message.includes("Сессия")){localStorage.removeItem(tokenKey);location.replace("/auth");return;}host.innerHTML=`<p class="empty-state">${esc(e.message)}</p>`;message($("#account-status"),e.message,"error");}
 $("#logout-button")?.addEventListener("click",async()=>{try{await api("/api/auth/logout",{method:"POST"});}catch{}localStorage.removeItem(tokenKey);location.replace("/auth");});
}

async function adminInit(){
 const root=$("#admin-root");if(!root)return;
 const token=localStorage.getItem(tokenKey);if(!token){location.replace("/auth");return;}
 try{
  const me=await api("/api/auth/me");if(!me.user?.is_admin){root.innerHTML='<section class="content-card"><h2>Нет доступа</h2><p>Эта страница доступна только администратору.</p><a class="button button-primary" href="/account">Вернуться в профиль</a></section>';return;}
  const data=await api("/api/admin/overview");
  const stats=Object.entries(data.stats).map(([k,v])=>`<div class="admin-stat"><strong>${v}</strong><span>${({users:"Пользователи",bookings:"Бронирования",messages:"Сообщения",trips:"Маршруты"})[k]||k}</span></div>`).join("");
  const table=(headers,rows)=>`<div class="admin-table-wrap"><table class="admin-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows||`<tr><td colspan="${headers.length}">Нет записей</td></tr>`}</tbody></table></div>`;
  const panels={
   users: `<h2>Пользователи</h2>${table(["ID","Имя","Почта","Создан","Роль"],data.users.map(u=>`<tr><td>${u.id}</td><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc((u.created_at||"").slice(0,10))}</td><td>${u.is_admin?"Администратор":"Пользователь"}</td></tr>`).join(""))}`,
   bookings: `<h2>Бронирования</h2>${table(["№","Пользователь","Маршрут","Дата","Место","Цена"],data.bookings.map(b=>`<tr><td>${b.booking_id}</td><td>${esc(b.email)}</td><td>${esc(b.origin)} → ${esc(b.destination)}</td><td>${esc(b.date)}</td><td>${esc(b.seat)}</td><td>${money(b.price)}</td></tr>`).join(""))}`,
   messages: `<h2>Сообщения</h2>${table(["ID","Имя","Почта","Сообщение","Дата"],data.messages.map(m=>`<tr><td>${m.id}</td><td>${esc(m.name)}</td><td>${esc(m.email)}</td><td>${esc(m.message)}</td><td>${esc((m.created_at||"").slice(0,10))}</td></tr>`).join(""))}`,
   db: `<h2>База данных</h2><p class="muted admin-db-note">Таблицы SQLite и содержимое маршрутов. Хеши паролей и токены сессий не показываются.</p><div class="admin-db-tables">${(data.tables||[]).map(t=>`<div class="admin-db-chip"><strong>${esc(t.name)}</strong><span>${t.rows} записей</span></div>`).join("")}</div><h3 class="admin-subheading">Маршруты (trips)</h3>${table(["ID","Откуда","Куда","Транспорт","Перевозчик","Дата","Время","Цена"],(data.trips||[]).map(t=>`<tr><td>${t.id}</td><td>${esc(t.origin)} (${esc(t.origin_code)})</td><td>${esc(t.destination)} (${esc(t.destination_code)})</td><td>${esc(t.transport)}</td><td>${esc(t.carrier)}</td><td>${esc(t.date)}</td><td>${esc(t.depart)}–${esc(t.arrive)}</td><td>${money(t.price)}</td></tr>`).join(""))}`
  };
  root.innerHTML=`<div class="admin-stats">${stats}</div><div class="admin-tabs" role="tablist" aria-label="Разделы панели">${[["users","Пользователи"],["bookings","Бронирования"],["messages","Сообщения"],["db","БД"]].map(([id,label],i)=>`<button type="button" class="admin-tab${i===0?" is-active":""}" role="tab" aria-selected="${i===0}" data-admin-tab="${id}">${label}</button>`).join("")}</div><section class="content-card admin-section" id="admin-panel">${panels.users}</section>`;
  const panel=$("#admin-panel");
  $$(".admin-tab",root).forEach(tab=>tab.addEventListener("click",()=>{
   $$(".admin-tab",root).forEach(t=>{const on=t===tab;t.classList.toggle("is-active",on);t.setAttribute("aria-selected",String(on));});
   panel.innerHTML=panels[tab.dataset.adminTab]||"";
  }));
 }catch(e){if(e.message.includes("Войдите")||e.message.includes("Сессия")){localStorage.removeItem(tokenKey);location.replace("/auth");return;}root.innerHTML=`<section class="content-card"><h2>Не удалось загрузить базу</h2><p>${esc(e.message)}</p></section>`;}
}

function contactInit(){
 const form=$("#contact-form");if(!form)return;
 form.addEventListener("submit",async e=>{e.preventDefault();const status=$("#contact-status");try{const data=await api("/api/contacts",{method:"POST",body:JSON.stringify({name:$("#contact-name").value.trim(),email:$("#contact-email").value.trim(),message:$("#contact-message").value.trim()})});message(status,data.message,"success");form.reset()}catch(err){message(status,err.message,"error")}});
}
async function externalCurrency(){
 const target=$("#currency-demo");if(!target)return;
 try{const r=await fetch("https://api.frankfurter.app/latest?from=EUR&to=RUB");if(!r.ok)throw new Error("API недоступен");const d=await r.json();target.textContent=`Ориентировочный курс: 1 € ≈ ${Number(d.rates.RUB).toLocaleString("ru-RU",{maximumFractionDigits:2})} ₽`;target.dataset.source="Frankfurter API";}
 catch{target.textContent="Конвертация валюты временно недоступна";target.dataset.source="fallback";}
}
document.addEventListener("DOMContentLoaded",()=>{activeNav();mobileNav();homeSearch();loadFeatured();catalogInit();ticketInit();bookingInit();authInit();accountInit();contactInit();externalCurrency();exploreInit();adminInit()});
