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
