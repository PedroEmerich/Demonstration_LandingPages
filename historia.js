/* ==========================================================================
   HISTÓRIA — um único objeto que gira, troca de lado e se transforma
   a cada capítulo conforme o scroll.

   Para mudar o caminho do objeto, edite FORMAS abaixo:
     x   -> posição horizontal (fração da largura da tela, 0 = centro)
     y   -> posição vertical (fração da altura da tela)
     w   -> largura (fração da largura da tela)
     ar  -> proporção largura/altura
     rz  -> inclinação em graus
     r   -> arredondamento dos cantos (px)
   ========================================================================== */
(function () {
  const story = document.querySelector(".story");
  if (!story) return;

  const FORMAS = [
    { x: 0.23, y: 0, w: 0.44, ar: 1.52, rz: -4, r: 14 },   // 0: página no navegador (direita)
    { x: -0.23, y: 0.02, w: 0.40, ar: 1.52, rz: 5, r: 14 }, // 1: outro modelo (esquerda)
    { x: 0.23, y: 0, w: 0.30, ar: 0.92, rz: -3, r: 28 },    // 2: título (direita)
    { x: -0.21, y: 0, w: 0.17, ar: 0.47, rz: -2, r: 44 },   // 3: celular (esquerda)
    { x: 0.23, y: 0, w: 0.30, ar: 0.8, rz: 4, r: 22 },      // 4: conversa (direita)
  ];

  const reduz = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const inner = story.querySelector(".morph__inner");
  const faces = [...story.querySelectorAll(".face")];
  const chapters = [...story.querySelectorAll(".chapter")];
  const rail = [...story.querySelectorAll(".story__rail li")];
  const num = story.querySelector(".story__num");
  const numSpan = num.querySelector("span");
  const glow = story.querySelector(".story__glow");
  const hint = story.querySelector(".story__hint");
  const N = FORMAS.length;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const suave = (t) => t * t * (3 - 2 * t);

  faces.forEach((f, j) => (f.style.transform = `rotateY(${j * 180}deg)`));

  let mobile = false;
  function ladoDosTextos() {
    mobile = innerWidth < 800;
    chapters.forEach((c, i) => {
      c.classList.toggle("side-left", FORMAS[i].x > 0);
      c.classList.toggle("side-right", FORMAS[i].x <= 0);
    });
  }
  ladoDosTextos();
  addEventListener("resize", ladoDosTextos);

  // geometria real (px) de cada forma para o tamanho de tela atual
  function geo(k) {
    const W = innerWidth, H = innerHeight;
    let w, h, x, y;
    if (mobile) {
      const maxH = H * 0.42, maxW = W * 0.78;
      w = Math.min(maxW, maxH * k.ar);
      h = w / k.ar;
      x = k.x * W * 0.12;
      y = Math.max(-H * 0.24, 84 + h / 2 - H / 2); // o mais alto possível sem ficar sob o menu
    } else {
      const maxH = H * 0.68;
      w = k.w * W;
      h = w / k.ar;
      if (h > maxH) { h = maxH; w = h * k.ar; }
      x = k.x * W;
      y = k.y * H;
    }
    return { x, y, w, h, rz: mobile ? k.rz * 0.6 : k.rz, r: k.r };
  }

  let P = 0;              // progresso suavizado (0..N-1)
  let ativo = -1;
  let intro = reduz ? 1 : 0;
  const t0 = performance.now();

  function setAtivo(i) {
    if (i === ativo) return;
    const antes = chapters[ativo];
    if (antes) {
      antes.classList.remove("is-active");
      antes.classList.add("was-active");
      setTimeout(() => {
        // volta as palavras para baixo sem animar (estão escondidas)
        antes.querySelectorAll(".w > span").forEach((s) => (s.style.transition = "none"));
        antes.classList.remove("was-active");
        requestAnimationFrame(() => antes.querySelectorAll(".w > span").forEach((s) => (s.style.transition = "")));
      }, 500);
    }
    chapters[i].classList.remove("was-active");
    chapters[i].classList.add("is-active");
    faces.forEach((f, j) => f.classList.toggle("is-on", j === i));
    rail.forEach((li, j) => li.classList.toggle("is-on", j === i));

    num.classList.add("is-changing");
    setTimeout(() => {
      numSpan.textContent = String(i + 1).padStart(2, "0");
      num.classList.remove("is-changing");
    }, 250);
    ativo = i;
  }

  function frame(now) {
    // progresso bruto do scroll dentro da seção
    const inicio = story.offsetTop;
    const curso = story.offsetHeight - innerHeight;
    const bruto = clamp((scrollY - inicio) / curso) * (N - 1);
    // segura cada capítulo parado e anima só no meio da transição
    const i0 = Math.min(Math.floor(bruto), N - 2);
    const f = bruto - i0;
    const alvo = i0 + suave(clamp((f - 0.28) / 0.5));
    P = reduz ? alvo : lerp(P, alvo, 0.12);
    if (Math.abs(P - alvo) < 0.0005) P = alvo;

    intro = reduz ? 1 : clamp((now - t0 - 150) / 1100);
    const ki = suave(intro);

    const i = Math.min(Math.floor(P), N - 2);
    const t = P - i;
    const a = geo(FORMAS[i]), b = geo(FORMAS[i + 1]);
    const w = lerp(a.w, b.w, t), h = lerp(a.h, b.h, t);
    const x = lerp(a.x, b.x, t), y = lerp(a.y, b.y, t) - Math.sin(t * Math.PI) * 40;
    const rz = lerp(a.rz, b.rz, t);
    const m = window.__mouse || { x: 0, y: 0 };
    const rotY = P * 180 + m.x * 14;
    const rotX = -m.y * 10;
    const escala = (1 - 0.14 * Math.sin(t * Math.PI)) * lerp(0.75, 1, ki);

    inner.style.width = `${w}px`;
    inner.style.height = `${h}px`;
    inner.style.setProperty("--r", `${lerp(a.r, b.r, t)}px`);
    inner.style.opacity = ki;
    inner.style.transform =
      `translate3d(${x - w / 2}px, ${y - h / 2 + (1 - ki) * 60}px, 0) rotateZ(${rz}deg) rotateY(${rotY}deg) rotateX(${rotX}deg) scale(${escala})`;

    // só as duas faces envolvidas na transição ficam visíveis
    faces.forEach((fc, j) => (fc.style.visibility = Math.abs(P - j) < 1 ? "visible" : "hidden"));

    if (glow) glow.style.transform = `translate(${x * 0.6 + m.x * 80}px, ${y * 0.4 + m.y * 80}px)`;
    if (hint) hint.style.opacity = P > 0.08 ? 0 : 1;

    if (intro > 0.3) setAtivo(Math.round(P));
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
