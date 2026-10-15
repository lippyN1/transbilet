document.addEventListener("DOMContentLoaded", () => {
  const animated = document.querySelectorAll(
    ".card, .hero, .item-detail, .order-summary, .feedback, .contact-info"
  );
  animated.forEach(el => el.classList.add("reveal"));

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("reveal--visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    animated.forEach(el => io.observe(el));
  } else {
    animated.forEach(el => el.classList.add("reveal--visible"));
  }

  document.querySelectorAll('a[href$=".html"], a[href*=".html?"]').forEach(link => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      if (!href || link.target === "_blank" || href.startsWith("#")) return;
      if (link.hasAttribute("data-no-transition")) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      document.body.classList.add("page-leaving");
      setTimeout(() => { location.href = href; }, 180);
    });
  });

  requestAnimationFrame(() => document.body.classList.add("page-ready"));
});

function showToast(message, type = "ok") {
  const toast = document.createElement("div");
  toast.className = "toast toast--" + type;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast--visible"));
  setTimeout(() => {
    toast.classList.remove("toast--visible");
    setTimeout(() => toast.remove(), 250);
  }, 2600);
}