/* ============================================================
   MLCLIPS — Global Script (nav, ripple, counters, page fx)
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("page-fade");

  /* ---- Ctrl/Cmd+K quick search ---- */
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k"){
      e.preventDefault();
      const localSearch = document.getElementById("search-input");
      if (localSearch){ localSearch.focus(); }
      else { window.location.href = "clips.html"; }
    }
  });

  /* ---- Sticky nav shrink ---- */
  const nav = document.querySelector(".site-nav");
  if (nav){
    window.addEventListener("scroll", () => {
      nav.classList.toggle("scrolled", window.scrollY > 24);
    }, { passive:true });
  }

  /* ---- Mobile nav toggle ---- */
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links){
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("mobile-open");
      toggle.classList.toggle("open", open);
      if (open){
        links.style.cssText = "display:flex;flex-direction:column;position:fixed;top:70px;left:0;right:0;background:rgba(0,0,0,0.97);padding:1.5rem 2rem;gap:1.2rem;border-bottom:1px solid var(--line);backdrop-filter:blur(20px);";
      } else {
        links.removeAttribute("style");
      }
    });
  }

  /* ---- Ripple effect on buttons ---- */
  document.querySelectorAll(".btn, .nav-cta, .chip, .mbtn").forEach(btn => {
    btn.style.position = btn.style.position || "relative";
    btn.style.overflow = "hidden";
    btn.addEventListener("click", function(e){
      const rect = this.getBoundingClientRect();
      const ripple = document.createElement("span");
      ripple.className = "ripple";
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + "px";
      ripple.style.left = (e.clientX - rect.left - size/2) + "px";
      ripple.style.top = (e.clientY - rect.top - size/2) + "px";
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 650);
    });
  });

  /* ---- Animated stat counters (Intersection Observer) ---- */
  const counters = document.querySelectorAll("[data-count]");
  if (counters.length){
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting){
          animateCount(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    counters.forEach(el => obs.observe(el));
  }

  /* ---- Scroll reveal for feature cards / sections ---- */
  const revealEls = document.querySelectorAll(".feature-card, .section-head, .info-card");
  if (revealEls.length){
    revealEls.forEach(el => { el.style.opacity = "0"; el.style.transform = "translateY(24px)"; el.style.transition = `opacity 600ms cubic-bezier(.16,1,.3,1), transform 600ms cubic-bezier(.16,1,.3,1)`; });
    const revealObs = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting){
          setTimeout(() => {
            entry.target.style.opacity = "1";
            entry.target.style.transform = "translateY(0)";
          }, i * 60);
          revealObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(el => revealObs.observe(el));
  }

  /* ---- Populate live homepage stats from data layer ---- */
  if (document.getElementById("stat-clips")){
    initFirebase().then(() => {
      ClipsAPI.getAll().then(clips => {
        const totalViews = clips.reduce((s,c) => s + (c.views||0), 0);
        const totalDownloads = clips.reduce((s,c) => s + (c.downloads||0), 0);
        const heroes = new Set(clips.map(c => c.hero)).size;
        setCount("stat-clips", clips.length);
        setCount("stat-heroes", heroes || HERO_LIST.length);
        setCount("stat-downloads", totalDownloads);
        renderLatestUploads(clips);
      });
    });
  }
});

function setCount(id, value){
  const el = document.getElementById(id);
  if (el) el.setAttribute("data-count", value);
}

function animateCount(el){
  const target = parseInt(el.getAttribute("data-count"), 10) || 0;
  const duration = 1400;
  const start = performance.now();
  function tick(now){
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(eased * target).toLocaleString();
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = target.toLocaleString();
  }
  requestAnimationFrame(tick);
}

function renderLatestUploads(clips){
  const wrap = document.getElementById("latest-uploads");
  if (!wrap) return;
  const sorted = [...clips].sort((a,b) => new Date(b.uploadDate) - new Date(a.uploadDate)).slice(0,3);
  wrap.innerHTML = sorted.map(c => clipCardHTML(c)).join("");
  attachCardEvents(wrap);
}