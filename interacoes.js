/* ==========================================================================
   INTERAÇÕES COMUNS — scroll e cursor (index + catálogo)
   Respeita "reduzir movimento" do sistema e desativa efeitos de mouse no toque.
   ========================================================================== */
(function () {
  const reduz = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mouse = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const lerp = (a, b, t) => a + (b - a) * t;
  window.__mouse = { x: 0, y: 0 }; // compartilhado com historia.js

  /* ---------- Divide títulos em palavras ([data-split]) ---------- */
  $$("[data-split]").forEach((el) => {
    let i = 0;
    const quebra = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((parte) => {
            if (!parte) return;
            if (/^\s+$/.test(parte)) return frag.append(" ");
            const w = document.createElement("span");
            w.className = "w";
            const s = document.createElement("span");
            s.style.setProperty("--i", i++);
            s.textContent = parte;
            w.append(s);
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") quebra(n);
      });
    };
    quebra(el);
  });

  /* ---------- Revelar ao rolar ---------- */
  const revela = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.classList.add("is-in");
      el.querySelectorAll("[data-count-modelos]").forEach(conta);
      if (el.classList.contains("card")) setTimeout(() => el.classList.add("revealed"), 1100);
      revela.unobserve(el);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -50px 0px" });

  const observa = (el) => (reduz ? el.classList.add("is-in", "revealed") : revela.observe(el));
  $$("[data-reveal]").forEach(observa);
  $$("[data-split]").forEach((el) => { if (!el.closest(".chapter")) observa(el); });

  // cards do catálogo são recriados pelos filtros
  const grid = $("#grid");
  const preparaCards = () =>
    $$(".card:not([data-reveal])", grid).forEach((c, i) => {
      c.setAttribute("data-reveal", "");
      c.style.setProperty("--d", `${(i % 3) * 90}ms`);
      observa(c);
    });
  if (grid) { preparaCards(); new MutationObserver(preparaCards).observe(grid, { childList: true }); }

  /* ---------- Contador de modelos ---------- */
  function conta(el) {
    if (el.dataset.done) return;
    el.dataset.done = 1;
    const fim = parseInt(el.textContent, 10) || 0;
    const fmt = (v) => String(Math.round(v)).padStart(2, "0");
    if (reduz) return (el.textContent = fmt(fim));
    const t0 = performance.now();
    const passo = (t) => {
      const k = Math.min(1, (t - t0) / 1400);
      el.textContent = fmt(fim * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }

  /* ---------- Loop: barra de progresso + fileiras da vitrine ---------- */
  const barra = $(".progress");
  const rows = $$(".row").map((row) => ({
    row, track: $(".row__track", row), dir: +row.dataset.dir || -1, pos: 0, vel: 1, alvo: 1,
  }));
  rows.forEach((r) => {
    r.row.addEventListener("mouseenter", () => (r.alvo = 0.15));
    r.row.addEventListener("mouseleave", () => (r.alvo = 1));
  });
  let ultimoY = scrollY, impulso = 0;

  (function tick() {
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    barra?.style.setProperty("--p", max > 0 ? y / max : 0);

    if (!reduz && rows.length) {
      impulso = lerp(impulso, Math.min(Math.abs(y - ultimoY), 80), 0.08);
      rows.forEach((r) => {
        r.vel = lerp(r.vel, r.alvo, 0.06);
        r.pos += r.dir * (0.5 + impulso * 0.35) * r.vel;
        const metade = r.track.scrollWidth / 2;
        if (metade > 0) {
          if (r.pos <= -metade) r.pos += metade;
          if (r.pos > 0) r.pos -= metade;
        }
        r.track.style.transform = `translate3d(${r.pos}px,0,0)`;
      });
    }
    ultimoY = y;
    requestAnimationFrame(tick);
  })();

  /* ==================== Efeitos de mouse ==================== */
  if (!mouse || reduz) return;

  document.documentElement.classList.add("has-cursor");
  const dot = $(".cursor");
  const ring = $(".cursor-ring");
  let cx = innerWidth / 2, cy = innerHeight / 2, rx = cx, ry = cy;

  addEventListener("mousemove", (e) => {
    cx = e.clientX; cy = e.clientY;
    window.__mouse.x = cx / innerWidth - 0.5;
    window.__mouse.y = cy / innerHeight - 0.5;
    ring?.classList.remove("is-hidden");
  });
  document.addEventListener("mouseleave", () => ring?.classList.add("is-hidden"));

  (function segue() {
    rx = lerp(rx, cx, 0.18);
    ry = lerp(ry, cy, 0.18);
    if (dot) dot.style.transform = `translate(${cx}px, ${cy}px)`;
    if (ring) ring.style.transform = `translate(${rx}px, ${ry}px)`;
    requestAnimationFrame(segue);
  })();

  document.addEventListener("mouseover", (e) => {
    const ver = e.target.closest(".card, .tile");
    const link = e.target.closest("a, button");
    ring?.classList.toggle("is-view", !!ver);
    ring?.classList.toggle("is-link", !ver && !!link);
  });

  // botões magnéticos
  $$(".btn, .whats-float").forEach((b) => {
    b.addEventListener("mousemove", (e) => {
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
    });
    b.addEventListener("mouseleave", () => (b.style.transform = ""));
  });

  // tilt 3D nos cards do catálogo
  if (grid) {
    grid.addEventListener("mousemove", (e) => {
      const c = e.target.closest(".card");
      if (!c) return;
      const r = c.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      c.classList.add("is-tilting");
      c.style.transform = `translateY(-6px) rotateX(${-py * 7}deg) rotateY(${px * 9}deg)`;
      const t = $(".thumb", c), tr = t.getBoundingClientRect();
      t.style.setProperty("--mx", `${e.clientX - tr.left}px`);
      t.style.setProperty("--my", `${e.clientY - tr.top}px`);
    });
    grid.addEventListener("mouseout", (e) => {
      const c = e.target.closest(".card");
      if (!c || c.contains(e.relatedTarget)) return;
      c.classList.remove("is-tilting");
      c.style.transform = "";
    });
  }
})();
