// ===== Find My theme helpers (2026-11-15): segmented period control + bottom sheet. Uses the existing menu, no data changes. =====
(() => {
  const $ = (id) => document.getElementById(id);
  const menu = $("psum-dd-menu"), per = document.querySelector(".psum-period");
  if (!menu || !per) return;
  const LBL = { today: "Today", yesterday: "Yesterday", "7d": "7D", "30d": "1M", year: "Year" };
  const seg = document.createElement("div"); seg.className = "fm-seg"; seg.setAttribute("role", "tablist"); seg.setAttribute("aria-label", "ช่วงเวลา");
  for (const b of menu.querySelectorAll("[data-period]")) {
    const s = document.createElement("button"); s.type = "button"; s.setAttribute("role", "tab");
    s.dataset.period = b.dataset.period; s.textContent = LBL[b.dataset.period] || b.textContent; s.title = b.textContent.trim();
    s.onclick = (e) => { e.stopPropagation(); b.click(); sync(); };
    seg.appendChild(s);
  }
  const lab = document.createElement("span"); lab.className = "fm-period-label";
  per.appendChild(seg); per.appendChild(lab);
  function sync() {
    for (const s of seg.children) {
      const src = menu.querySelector(`[data-period="${s.dataset.period}"]`);
      s.setAttribute("aria-selected", src && src.getAttribute("aria-selected") === "true" ? "true" : "false");
    }
    lab.textContent = $("psum-dd-btn")?.title || "";
  }
  new MutationObserver(sync).observe(menu, { subtree: true, attributes: true, attributeFilter: ["aria-selected"] });
  new MutationObserver(sync).observe($("psum-dd-btn"), { attributes: true, attributeFilter: ["title"] });
  sync();
  // bottom sheet: tap the grabber area to cycle sizes (phone/tablet only)
  const aside = document.querySelector("aside");
  aside.addEventListener("click", (e) => {
    if (innerWidth >= 1024) return;
    const r = aside.getBoundingClientRect();
    if (e.clientY - r.top > 22) return;
    if (aside.classList.contains("fm-min")) aside.classList.remove("fm-min");
    else if (aside.classList.contains("fm-max")) { aside.classList.remove("fm-max"); aside.classList.add("fm-min"); }
    else aside.classList.add("fm-max");
  });
})();
// ===== v3 (2026-11-15): sliding spring pill for segmented controls (Motion = Framer Motion for vanilla JS) + period fade =====
(() => {
  let animate = null;
  import("https://cdn.jsdelivr.net/npm/motion@14.14.0/+esm").then((m) => { animate = m.animate; document.documentElement.classList.add("fm-motion"); }).catch(() => {});
  const SPRING = { type: "spring", stiffness: 520, damping: 38, mass: 0.9 };
  function pillify(box, sel, isOn) {
    if (!box) return;
    const pill = document.createElement("span"); pill.className = "fm-pill"; box.prepend(pill); box.classList.add("fm-has-pill");
    let first = true, last = null;
    const place = () => {
      const on = [...box.querySelectorAll(sel)].find(isOn); if (!on) { pill.style.opacity = "0"; return; }
      const x = on.offsetLeft, w = on.offsetWidth, h = on.offsetHeight, y = on.offsetTop;
      const key = `${x}|${w}|${h}`; if (key === last) return; last = key;
      pill.style.opacity = "1"; pill.style.height = h + "px"; pill.style.top = y + "px";
      if (first || !animate) { pill.style.transform = `translateX(${x}px)`; pill.style.width = w + "px"; first = false; return; }
      animate(pill, { transform: `translateX(${x}px)`, width: `${w}px` }, SPRING);
    };
    new MutationObserver(() => requestAnimationFrame(place)).observe(box, { subtree: true, attributes: true, attributeFilter: ["aria-selected", "aria-pressed"] });
    addEventListener("resize", () => { first = true; last = null; place(); });
    requestAnimationFrame(place); setTimeout(place, 300);
  }
  pillify(document.querySelector(".fm-seg"), "button", (b) => b.getAttribute("aria-selected") === "true");
  pillify(document.querySelector(".toolbar"), ".tf", (b) => b.getAttribute("aria-pressed") === "true");
  // soft spring-in of numbers and rows when the period changes
  const menu = document.getElementById("psum-dd-menu"); let prev = null;
  if (menu) new MutationObserver(() => {
    const cur = menu.querySelector('[aria-selected="true"]')?.dataset.period;
    if (!cur || cur === prev) return; const firstRun = prev === null; prev = cur; if (firstRun || !animate) return;
    const els = [document.getElementById("psum-net-card"), document.querySelector(".psum-split"), document.querySelector(".psum-foot")].filter(Boolean);
    animate(els, { opacity: [0.35, 1], transform: ["translateY(5px)", "translateY(0px)"] }, { duration: 0.28, ease: [0.22, 1, 0.36, 1] });
    const rows = [...document.querySelectorAll("#trades .trade")].slice(0, 12);
    rows.forEach((r, i) => animate(r, { opacity: [0, 1], transform: ["translateY(6px)", "translateY(0px)"] }, { duration: 0.26, delay: i * 0.018, ease: [0.22, 1, 0.36, 1] }));
  }).observe(menu, { subtree: true, attributes: true, attributeFilter: ["aria-selected"] });
})();
