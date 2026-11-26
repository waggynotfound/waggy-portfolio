/* =========================================================
   waggy — interactions
   No JS: readable page. Reduced motion: static page.
   ========================================================= */

(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine    = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp   = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp    = (a, b, t) => a + (b - a) * t;
  const raf     = window.requestAnimationFrame.bind(window);

  /* 0. CRT boot sequence: beam -> POST -> degauss -> open -- */
  const html = document.documentElement;
  const bootLines = document.querySelectorAll(".boot-line");
  if (!reduced) {
    html.classList.add("boot");
    bootLines.forEach((l) => { l.textContent = ""; });

    // type each POST line, BIOS style
    let li = 0;
    const typeLine = () => {
      if (li >= bootLines.length) return;
      const line = bootLines[li];
      const text = line.getAttribute("data-boot") || "";
      line.classList.add("typing");
      let ci = 0;
      const typeChar = () => {
        if (ci < text.length) {
          // the OK verdicts land bright
          const cut = text.indexOf(" OK");
          if (cut > -1 && ci >= cut) {
            line.innerHTML = text.slice(0, cut) + "<b>" + text.slice(cut) + "</b>";
          } else {
            line.textContent = text.slice(0, ++ci);
          }
          setTimeout(typeChar, 9);
        } else {
          line.classList.remove("typing");
          line.classList.add("done");
          li++;
          setTimeout(typeLine, 110);
        }
      };
      typeChar();
    };

    setTimeout(() => {
      html.classList.add("boot-type");
      typeLine();
    }, 480);

    // degauss flash, then the overlay lifts and the site jolts alive
    setTimeout(() => html.classList.add("boot-degauss"), 1900);
    setTimeout(() => html.classList.add("boot-open"), 2250);
    setTimeout(() => html.classList.remove("boot", "boot-type", "boot-degauss", "boot-open"), 2850);
  }
  /* 1. hero line reveal ------------------------------------ */
  const hero = document.querySelector(".hero");
  const start = () => hero && hero.classList.add("is-ready");

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => setTimeout(start, 60));
    setTimeout(start, 900);
  } else {
    setTimeout(start, 120);
  }

  /* 2. scroll reveals -------------------------------------- */
  const revealEls = document.querySelectorAll("[data-reveal]");

  if (reduced || !("IntersectionObserver" in window)) {
    revealEls.forEach(el => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });

    revealEls.forEach(el => io.observe(el));
  }

  /* 2b. scrub: reveal progress follows the scroll ---------- */
  // positions are measured once and cached, so the scroll handler
  // is pure math: no rect reads per frame, no layout thrash
  const docTop = (el) => {
    let t = 0;
    while (el) { t += el.offsetTop; el = el.offsetParent; }
    return t;
  };
  const scrubEls = [...document.querySelectorAll("[data-reveal], .work-item, .soc-grid li, .else-list li")]
    .map((el) => ({ el, top: 0 }));
  const measureScrub = () => {
    scrubEls.forEach((s) => { s.top = docTop(s.el); });
  };
  const updateScrub = () => {
    if (reduced || !scrubEls.length) return;
    const vh = window.innerHeight;
    const sy = window.scrollY;
    for (let i = 0; i < scrubEls.length; i++) {
      const s = scrubEls[i];
      s.el.style.setProperty("--p", clamp((vh * 0.94 - (s.top - sy)) / (vh * 0.55), 0, 1).toFixed(3));
    }
  };
  measureScrub();
  updateScrub();

  /* 2b2. scroll velocity skew (CRT wobble) ------------------ */
  const mainEl = document.querySelector("main");
  if (mainEl && !reduced) {
    let lastY = window.scrollY, v = 0, wobRaf = null;
    const wobble = () => {
      wobRaf = null;
      const y = window.scrollY;
      v = lerp(v, clamp((y - lastY) * 0.05, -1.6, 1.6), 0.14);
      lastY = y;
      if (Math.abs(v) < 0.008) {
        if (mainEl.style.transform) mainEl.style.transform = "";
        return;
      }
      mainEl.style.transform = "skewY(" + (v * 0.5).toFixed(3) + "deg)";
      wobRaf = raf(wobble);
    };
    // the loop only runs while there is velocity, then parks itself
    window.addEventListener("scroll", () => {
      if (!wobRaf) wobRaf = raf(wobble);
    }, { passive: true });
  }

  /* 2c. scroll parallax ------------------------------------ */
  const pEls = [...document.querySelectorAll("[data-parallax]")]
    .map((el) => ({ el, top: 0, h: 0, k: parseFloat(el.dataset.parallax || 0) }));
  const measureParallax = () => {
    pEls.forEach((s) => {
      s.top = docTop(s.el);
      s.h = s.el.offsetHeight;
    });
  };
  const updateParallax = () => {
    if (reduced || !pEls.length) return;
    const vh = window.innerHeight;
    const sy = window.scrollY;
    pEls.forEach((s) => {
      const mid = s.top - sy + s.h / 2 - vh / 2;
      s.el.style.setProperty("--py", (-mid * s.k).toFixed(1) + "px");
    });
  };
  measureParallax();
  updateParallax();

  const remeasure = () => { measureScrub(); measureParallax(); updateScrub(); updateParallax(); };
  window.addEventListener("resize", () => {
    clearTimeout(remeasure._t);
    remeasure._t = setTimeout(remeasure, 150);
  }, { passive: true });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => setTimeout(remeasure, 100));
  }
  // opening a project changes layout below it; remeasure after the transition
  document.addEventListener("click", (e) => {
    if (e.target.closest(".work-head")) setTimeout(remeasure, 700);
  });  /* 2d. directional cascade children ----------------------- */
  [".work-list", ".soc-grid", ".else-list"].forEach(sel => {
    const parent = document.querySelector(sel);
    if (!parent) return;
    [...parent.children].forEach((child, i) => {
      child.style.setProperty("--ri", Math.min(i, 6));
    });
  });
  const cEls = document.querySelectorAll(".work-item, .soc-grid li, .else-list li");
  if (reduced || !("IntersectionObserver" in window)) {
    cEls.forEach(el => el.classList.add("rv"));
  } else {
    const cio = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("rv");
        cio.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.1 });
    cEls.forEach(el => cio.observe(el));
  }

  /* 3. pointer-reactive dot field -------------------------- */
  // pre-rendered sprites + drawImage: ~10x cheaper than per-dot arcs,
  // which is what kept the scroll from feeling perfectly smooth
  const canvas = document.getElementById("field");
  const ctx = canvas ? canvas.getContext("2d", { alpha: true }) : null;

  if (ctx && !reduced) {
    const makeSprite = (rgb) => {
      const s = document.createElement("canvas");
      s.width = s.height = 16;
      const g = s.getContext("2d");
      g.fillStyle = rgb;
      g.beginPath();
      g.arc(8, 8, 7, 0, 6.2832);
      g.fill();
      return s;
    };
    const spriteRest = makeSprite("rgb(190, 214, 226)");
    const spriteHot = makeSprite("rgb(155, 107, 255)");

    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
    let W = 0, H = 0, dots = [], spacing = 40, t0 = performance.now();
    let running = true;

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width  = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width  = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      spacing = W < 700 ? 44 : 56;
      const cols = Math.ceil(W / spacing) + 2;
      const rows = Math.ceil(H / spacing) + 2;
      dots = new Array(cols * rows);

      let i = 0;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          dots[i++] = { x: x * spacing, y: y * spacing, seed: x * 0.7 + y * 1.3 };
        }
      }
    };

    const draw = (now) => {
      if (!running) return;
      const time = (now - t0) * 0.001;

      pointer.x += (pointer.tx - pointer.x) * 0.09;
      pointer.y += (pointer.ty - pointer.y) * 0.09;

      ctx.clearRect(0, 0, W, H);

      const RADIUS = 200;
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const px = d.x + Math.sin(time * 0.35 + d.seed) * 1.4;
        const py = d.y + Math.cos(time * 0.28 + d.seed * 1.7) * 1.4;

        let a = 0.085 + 0.05 * Math.sin(time * 0.6 + d.seed * 0.5);
        let scale = 1;
        let hot = 0;

        if (pointer.x > -9000) {
          const ddx = px - pointer.x;
          const ddy = py - pointer.y;
          const dist2 = ddx * ddx + ddy * ddy;
          if (dist2 < RADIUS * RADIUS) {
            const dist = Math.sqrt(dist2);
            const eased = (1 - dist / RADIUS) ** 2;
            a += eased * 0.62;
            scale += eased * 1.4;
            hot = eased;
          }
        }

        const size = 5.2 * scale;
        ctx.globalAlpha = Math.min(a, 0.9);
        ctx.drawImage(hot > 0.5 ? spriteHot : spriteRest, px - size / 2, py - size / 2, size, size);
      }

      ctx.globalAlpha = 1;
      raf(draw);
    };

    build();
    raf(draw);

    window.addEventListener("resize", () => {
      clearTimeout(build._t);
      build._t = setTimeout(build, 150);
    }, { passive: true });

    window.addEventListener("pointermove", (e) => {
      pointer.tx = e.clientX;
      pointer.ty = e.clientY;
    }, { passive: true });

    window.addEventListener("pointerleave", () => {
      pointer.tx = -9999;
      pointer.ty = -9999;
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        running = false;
      } else if (!running) {
        running = true;
        t0 = performance.now();
        raf(draw);
      }
    });
  }
  /* 4. The mouse cursor and its pixel cat share a loop in cursor.js. */

  /* 5. magnetic elements ----------------------------------- */
  document.querySelectorAll("[data-magnet]").forEach(el => {
    if (reduced || !fine) return;
    let frame = null;

    el.addEventListener("pointermove", (e) => {
      const box = el.getBoundingClientRect();
      const mx = e.clientX - (box.left + box.width / 2);
      const my = e.clientY - (box.top + box.height / 2);
      cancelAnimationFrame(frame);
      frame = raf(() => {
        el.style.transform = `translate3d(${clamp(mx * 0.22, -14, 14)}px, ${clamp(my * 0.35, -10, 10)}px, 0) rotate(${clamp(mx * 0.045, -5, 5)}deg)`;
      });
    });

    el.addEventListener("pointerleave", () => {
      cancelAnimationFrame(frame);
      el.style.transform = "";
    });
  });

  /* 6. split headings into letters ------------------------- */
  document.querySelectorAll("[data-split]").forEach(el => {
    const text = (el.textContent || "").trim();
    if (!text) return;
    el.setAttribute("aria-label", text);
    el.textContent = "";

    const frag = document.createDocumentFragment();
    [...text].forEach((ch, i) => {
      const span = document.createElement("span");
      span.className = "ch";
      span.setAttribute("aria-hidden", "true");
      span.style.setProperty("--i", i);
      span.textContent = ch === " " ? "\u00A0" : ch;
      frag.appendChild(span);
    });
    el.appendChild(frag);
  });

  /* 7. boot terminal typing -------------------------------- */
  document.querySelectorAll("[data-type]").forEach(el => {
    const text = el.getAttribute("data-type");
    if (!text) return;

    if (reduced) {
      el.textContent = text;
      return;
    }

    el.textContent = "";
    let i = 0;
    const type = () => {
      if (i < text.length) {
        el.textContent = text.slice(0, ++i);
        setTimeout(type, 18 + Math.random() * 30);
      }
    };
    setTimeout(type, 400);
  });

  /* 8. ticker ---------------------------------------------- */
  const track = document.querySelector(".ticker-track");
  if (track && !reduced) {
    track.innerHTML += track.innerHTML;

    const half = track.scrollWidth / 2;
    if (half) {
      track.animate(
        [{ transform: "translateX(0)" }, { transform: `translateX(-${half}px)` }],
        { duration: (half / 55) * 1000, iterations: Infinity, easing: "linear" }
      );
    }
  }

  /* 9. project accordion ----------------------------------- */
  const items = [...document.querySelectorAll(".work-item")];

  items.forEach(item => {
    const head = item.querySelector(".work-head");
    if (!head) return;

    head.addEventListener("click", () => {
      const isOpen = item.classList.contains("is-open");
      items.forEach(other => {
        if (other === item) return;
        other.classList.remove("is-open");
        const h = other.querySelector(".work-head");
        if (h) h.setAttribute("aria-expanded", "false");
      });
      item.classList.toggle("is-open", !isOpen);
      head.setAttribute("aria-expanded", String(!isOpen));
    });

    head.addEventListener("pointermove", (e) => {
      const box = head.getBoundingClientRect();
      head.style.setProperty("--mx", `${e.clientX - box.left}px`);
      head.style.setProperty("--my", `${e.clientY - box.top}px`);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    items.forEach(item => {
      if (!item.classList.contains("is-open")) return;
      item.classList.remove("is-open");
      const h = item.querySelector(".work-head");
      if (h) { h.setAttribute("aria-expanded", "false"); h.focus(); }
    });
  });

  /* 10. header, progress, active nav ----------------------- */
  const header = document.querySelector(".top");
  const bar = document.querySelector(".progress i");
  let queued = false;

  const onScroll = () => {
    const y = window.scrollY;
    if (header) header.classList.toggle("is-stuck", y > 16);

    if (bar) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;
    }
    updateParallax();
    updateScrub();
    queued = false;
  };

  window.addEventListener("scroll", () => {
    if (queued) return;
    queued = true;
    raf(onScroll);
  }, { passive: true });

  onScroll();

  const navLinks = [...document.querySelectorAll(".nav a")];
  const sections = navLinks
    .map(a => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    const navIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const id = "#" + entry.target.id;
        navLinks.forEach(a => a.classList.toggle("is-active", a.getAttribute("href") === id));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });

    sections.forEach(s => navIO.observe(s));
  }

  /* 11. live clock ----------------------------------------- */
  const clock = document.querySelector("[data-clock]");
  if (clock) {
    const fmt = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit", minute: "2-digit", hour12: false
    });
    const tick = () => { clock.textContent = fmt.format(new Date()); };
    tick();
    setInterval(tick, 15000);
  }

  /* 12. uptime counter ------------------------------------- */
  const up = document.querySelector("[data-uptime]");
  if (up) {
    const t0 = Date.now();
    const pad = (n) => String(n).padStart(2, "0");
    const tick = () => {
      const s = Math.floor((Date.now() - t0) / 1000);
      up.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
    };
    tick();
    setInterval(tick, 1000);
  }

  /* 13. copy email ----------------------------------------- */
  document.querySelectorAll("[data-copy]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const value = btn.getAttribute("data-copy");
      const original = btn.textContent;
      try {
        await navigator.clipboard.writeText(value);
        btn.textContent = "copied";
        btn.classList.add("is-done");
      } catch {
        btn.textContent = "press ctrl+c";
      }
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove("is-done");
      }, 1800);
    });
  });

  /* 13b. phosphor ripple on click -------------------------- */
  document.addEventListener("pointerdown", (e) => {
    if (reduced) return;
    const t = e.target.closest(".btn, .copy, .soc");
    if (!t) return;
    const box = t.getBoundingClientRect();
    const size = Math.max(box.width, box.height) * 2.2;
    const s = document.createElement("span");
    s.className = "ripple";
    s.style.width = s.style.height = size + "px";
    s.style.left = (e.clientX - box.left) + "px";
    s.style.top = (e.clientY - box.top) + "px";
    t.appendChild(s);
    setTimeout(() => s.remove(), 780);
  });

  /* 15. fluid scrolling ------------------------------------ */
  // frame-rate independent exponential smoothing: the glide feels
  // identical at 60Hz, 120Hz or 240Hz, and it is long and even
  if (!reduced) html.classList.add("smooth");

  let scTarget = window.scrollY, scCurrent = scTarget, scRaf = null, scLast = 0;
  const SC_TAU = 150; // ms — higher = longer, silkier glide
  const scMax = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const scLoop = (now) => {
    if (!scLast) scLast = now;
    const dt = Math.min(64, now - scLast);
    scLast = now;
    scCurrent += (scTarget - scCurrent) * (1 - Math.exp(-dt / SC_TAU));
    if (Math.abs(scTarget - scCurrent) < 0.35) {
      scCurrent = scTarget;
      window.scrollTo(0, scCurrent);
      scRaf = null;
      return;
    }
    window.scrollTo(0, scCurrent);
    scRaf = raf(scLoop);
  };
  const scTo = (y) => {
    scTarget = clamp(y, 0, scMax());
    if (!scRaf) { scLast = 0; scRaf = raf(scLoop); }
  };

  if (!reduced) {
    window.addEventListener("wheel", (e) => {
      if (e.ctrlKey) return;
      if (e.target.closest && e.target.closest(".term-panel")) return;
      e.preventDefault();
      const d = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      scTo(scTarget + d);
    }, { passive: false });

    window.addEventListener("scroll", () => {
      if (!scRaf) scTarget = scCurrent = window.scrollY;
    }, { passive: true });

    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const href = a.getAttribute("href");
      if (href.length < 2) return;
      const el = document.querySelector(href);
      if (!el) return;
      e.preventDefault();
      scTo(href === "#top" ? 0 : el.getBoundingClientRect().top + window.scrollY - 76);
      try { history.replaceState(null, "", href); } catch {}
    });
  }
  const goSection = (id) => {
    const el = document.querySelector(id);
    if (!el) return;
    const y = id === "#top" ? 0 : el.getBoundingClientRect().top + window.scrollY - 76;
    if (!reduced) scTo(y); else window.scrollTo(0, y);
  };

  /* 16. toasts + mini terminal ----------------------------- */
  const toasts = document.querySelector(".toasts");
  const showToast = (msg) => {
    if (!toasts) return;
    const t = document.createElement("span");
    t.className = "toast";
    t.textContent = msg;
    toasts.appendChild(t);
    setTimeout(() => t.remove(), 2900);
  };

  const fab = document.querySelector(".term-fab");
  const panel = document.querySelector(".term-panel");
  const termOut = panel && panel.querySelector(".term-out");
  const termIn = panel && panel.querySelector(".term-in");

  if (fab && panel && termIn && termOut) {
    const setOpen = (yes) => {
      panel.hidden = !yes;
      panel.classList.toggle("open", yes);
      fab.setAttribute("aria-expanded", String(yes));
      if (yes) {
        termIn.focus();
        if (!termOut.childElementCount) {
          const p = document.createElement("div");
          p.innerHTML = "waggy terminal — type <span class='cmd'>help</span>";
          termOut.appendChild(p);
        }
      }
    };

    fab.addEventListener("click", () => setOpen(panel.hidden));
    const closeBtn = panel.querySelector(".term-close");
    if (closeBtn) closeBtn.addEventListener("click", () => setOpen(false));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hidden) { setOpen(false); fab.focus(); }
    });

    const cmds = {
      help: () => "try: work, about, elsewhere, socials, spotify, steam, contact, top, uptime, whoami, ls, clear",
      work: () => { goSection("#work"); return "→ mounting /work"; },
      about: () => { goSection("#about"); return "→ mounting /about"; },
      elsewhere: () => { goSection("#elsewhere"); return "→ mounting /elsewhere"; },
      socials: () => { goSection("#socials"); return "→ mounting /socials"; },
      spotify: () => { goSection("#spotify"); return "→ mounting /spotify"; },
      steam: () => { goSection("#steam"); return "→ mounting /steam"; },
      contact: () => { goSection("#contact"); return "→ mounting /contact"; },
      top: () => { goSection("#top"); return "→ back to top"; },
      ls: () => "work/  about/  elsewhere/  socials/  spotify/  steam/  contact/",
      whoami: () => "waggy — solo builder, GMT+5:30",
      uptime: () => {
        const u = document.querySelector("[data-uptime]");
        return "session: " + (u ? u.textContent : "00:00:00");
      },
      clear: () => { termOut.innerHTML = ""; return null; },
      sudo: () => "nice try — this tube runs on trust.",
    };

    const form = panel.querySelector(".term-form");
    if (form) form.addEventListener("submit", (e) => {
      e.preventDefault();
      const raw = termIn.value.trim();
      if (!raw) return;
      const line = document.createElement("div");
      line.className = "cmd";
      line.textContent = "$ " + raw;
      termOut.appendChild(line);
      termIn.value = "";

      const key = raw.toLowerCase().split(/\s+/)[0];
      const fn = cmds[key];
      if (fn) {
        const out = fn();
        if (out) {
          const d = document.createElement("div");
          d.textContent = out;
          termOut.appendChild(d);
        }
      } else {
        const d = document.createElement("div");
        d.className = "err";
        d.textContent = "command not found: " + key + " — try help";
        termOut.appendChild(d);
      }
      termOut.scrollTop = termOut.scrollHeight;
    });
  }

  // Let <picture> choose the still for reduced motion, even without JavaScript.
  const bannerToggle = document.querySelector('.banner-toggle');
  if (bannerToggle) {
    const source = bannerToggle.parentElement.querySelector('source');
    const motion = matchMedia('(prefers-reduced-motion: no-preference)');
    let paused = false;
    const refreshBanner = () => {
      source.media = paused ? 'not all' : motion.media;
      bannerToggle.hidden = !motion.matches;
      bannerToggle.classList.toggle('is-paused', paused);
      bannerToggle.setAttribute('aria-label', paused ? 'Play banner animation' : 'Pause banner animation');
    };
    bannerToggle.addEventListener('click', () => { paused = !paused; refreshBanner(); });
    motion.addEventListener('change', refreshBanner);
    refreshBanner();
  }

  /* 17. now playing - live Last.fm (latest track only) ----- */
  const npTrack = document.querySelector("[data-np]");
  const npLabel = document.querySelector(".np-label");
  if (npTrack) {
    const swapTo = (text) => {
      npTrack.classList.add("np-swap");
      setTimeout(() => {
        npTrack.textContent = text;
        npTrack.title = text;
        npTrack.classList.remove("np-swap");
      }, 320);
    };

    let lastText = "";
    const FM_USER = "waggynotfound";
    const FM_KEY = "18b14514582a4fa439fabdcd5ebe9ca1";
    const refresh = async () => {
      try {
        const res = await fetch("https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=" + FM_USER + "&api_key=" + FM_KEY + "&format=json&limit=1");
        if (!res.ok) return;
        const data = await res.json();
        const raw = (data.recenttracks && data.recenttracks.track) || [];
        const list = Array.isArray(raw) ? raw : [raw];
        const t = list[0];
        if (!t) return;
        const artist = (t.artist && t.artist["#text"]) || "";
        const name = t.name || "";
        if (!artist || !name) return;
        const isNow = t["@attr"] && t["@attr"].nowplaying === "true";
        const text = artist + " — " + name;
        if (text !== lastText) {
          lastText = text;
          swapTo(text);
        }
        if (npLabel) npLabel.textContent = isNow ? "now playing - live" : "last played - live";
      } catch (err) {}
    };
    refresh();
    setInterval(refresh, 20000);
  }
  /* 17b. discord presence via lanyard ---------------------- */
  const DISCORD_ID = "1098532427426693120";
  const dcard = document.getElementById("dcard");
  if (dcard && DISCORD_ID) {
    const DC_COLORS = { online: "#23A55A", idle: "#F0B232", dnd: "#F23F43", offline: "#80848E" };
    const avatars = document.querySelectorAll("[data-discord-avatar]");
    let requestedAvatar = "";
    const dDot = document.getElementById("d-dot");
    const dName = document.getElementById("d-name");
    const dStatus = document.getElementById("d-status");
    const renderPresence = (data) => {
      const u = data.discord_user;
      if (!u || u.id !== DISCORD_ID) return;
      const defaultIndex = Number(u.discriminator) ? Number(u.discriminator) % 5 : Number((BigInt(u.id) >> 22n) % 6n);
      const ext = u.avatar?.startsWith("a_") && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "gif" : "png";
      const url = u.avatar
        ? `https://cdn.discordapp.com/avatars/${DISCORD_ID}/${u.avatar}.${ext}?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
      if (url !== requestedAvatar) {
        requestedAvatar = url;
        // Leave the last good picture in place until its replacement has loaded.
        const preview = new Image();
        preview.onload = () => {
          if (requestedAvatar === url) avatars.forEach(img => { img.src = url; });
        };
        preview.onerror = () => { if (requestedAvatar === url) requestedAvatar = ""; };
        preview.src = url;
      }
      if (dName) dName.textContent = u.global_name || u.username;
      const st = data.discord_status || "offline";
      if (dDot) dDot.style.background = DC_COLORS[st] || DC_COLORS.offline;
      if (dStatus) dStatus.textContent = st;
      const handle = document.getElementById("dcard-handle");
      if (handle) handle.textContent = "@" + u.username;
    };
    const pullPresence = async () => {
      try {
        const res = await fetch("https://api.lanyard.rest/v1/users/" + DISCORD_ID, { cache: "no-store" });
        if (!res.ok) return;
        const out = await res.json();
        if (out && out.success && out.data) renderPresence(out.data);
      } catch (err) {}
    };
    pullPresence();
    setInterval(pullPresence, 30000);
  }
  /* 17c. background music — the full song, crossfade-looped  */
  const BGM_URL = "assets/bgm.m4a";
  const bgmVol = document.getElementById("bgm-vol");
  const bgmBtn = document.getElementById("bgm-toggle");
  let bgmStarted = false, bgmMuted = false, bgmLevel = 0.15;
  const bgmPair = [];
  let bgmLead = 0;

  const bgmApply = () => {
    bgmPair.forEach((a, i) => {
      const target = i === bgmLead ? (bgmMuted ? 0 : bgmLevel) : 0;
      if (Math.abs(a.volume - target) > 0.01) a.volume = target;
    });
  };

  const bgmFadeTo = (a, target, ms) => {
    const from = a.volume;
    const t0 = performance.now();
    const step = (now) => {
      const k = clamp((now - t0) / ms, 0, 1);
      a.volume = from + (target - from) * k;
      if (k < 1) raf(step);
    };
    raf(step);
  };

  const startBgm = () => {
    if (bgmStarted) return;
    bgmStarted = true;
    const mk = (muted) => {
      const a = new Audio(BGM_URL);
      a.preload = "auto";
      a.volume = muted ? 0 : bgmLevel;
      return a;
    };
    bgmPair.push(mk(false), mk(true));
    bgmPair[0].play().catch(() => {});
    setInterval(() => {
      const cur = bgmPair[bgmLead];
      const nxt = bgmPair[1 - bgmLead];
      if (cur.duration && cur.currentTime > cur.duration - 2.2) {
        nxt.play().catch(() => {});
        const oldLead = bgmLead;
        bgmLead = 1 - bgmLead;
        bgmFadeTo(bgmPair[bgmLead], bgmMuted ? 0 : bgmLevel, 1600);
        bgmFadeTo(bgmPair[oldLead], 0, 1600);
        setTimeout(() => {
          const done = bgmPair[oldLead];
          done.pause();
          done.currentTime = 0;
        }, 1700);
      }
    }, 300);
  };

  if (bgmVol) bgmVol.addEventListener("input", () => {
    bgmLevel = bgmVol.value / 100;
    if (!bgmMuted) bgmFadeTo(bgmPair[bgmLead], bgmLevel, 180);
    bgmPair.forEach((a, i) => { if (i !== bgmLead) a.volume = 0; });
  });
  if (bgmBtn) bgmBtn.addEventListener("click", () => {
    bgmMuted = !bgmMuted;
    bgmBtn.classList.toggle("is-muted", bgmMuted);
    bgmBtn.setAttribute("aria-pressed", String(bgmMuted));
    bgmFadeTo(bgmPair[bgmLead], bgmMuted ? 0 : bgmLevel, 300);
    bgmPair.forEach((a, i) => { if (i !== bgmLead) a.volume = 0; });
  });

  const armBgm = () => {
    startBgm();
    document.removeEventListener("pointerdown", armBgm);
    document.removeEventListener("keydown", armBgm);
  };
  if (!reduced) {
    document.addEventListener("pointerdown", armBgm, { once: true });
    document.addEventListener("keydown", armBgm, { once: true });
  }
  /* 19. count-up stats ------------------------------------- */
  const nums = document.querySelectorAll("[data-count]");
  if (nums.length && "IntersectionObserver" in window && !reduced) {
    const nio = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        nio.unobserve(el);
        const target = parseInt(el.dataset.count, 10) || 0;
        const t0 = performance.now();
        const dur = 1500;
        const step = (now) => {
          const p = clamp((now - t0) / dur, 0, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased).toLocaleString();
          if (p < 1) raf(step);
        };
        raf(step);
      });
    }, { threshold: 0.4 });
    nums.forEach((el) => nio.observe(el));
  } else {
    nums.forEach((el) => {
      el.textContent = (parseInt(el.dataset.count, 10) || 0).toLocaleString();
    });
  }

})();
