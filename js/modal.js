/* ============================================================
   MLCLIPS — Card renderer, Preview (modal or full-page), Favorites, Share
   ============================================================ */

const HERO_ICON_COLORS = {
  Fanny:"#FF6B81", Lancelot:"#9D8CFF", Ling:"#36E0E0", Hayabusa:"#7C3AED",
  Gusion:"#FF2C46", Julian:"#4DA8FF", Claude:"#FFC93C", Beatrix:"#22C55E"
};

function heroInitial(hero){ return (hero || "?").charAt(0).toUpperCase(); }

function heroIconHTML(hero){
  const color = HERO_ICON_COLORS[hero] || "var(--red-bright)";
  return `<span style="width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:${color};color:#000;font-family:var(--f-display);font-weight:700;font-size:.7rem;border:1px solid rgba(255,255,255,.25);">${heroInitial(hero)}</span>`;
}

/* Category badge — same categories used in Admin (Clip / Entrance Animation) */
function categoryBadgeHTML(category){
  const cat = category || "Clip";
  const isEntrance = cat === "Entrance Animation";
  const bg = isEntrance ? "rgba(255,180,0,.14)" : "rgba(225,29,46,.14)";
  const border = isEntrance ? "rgba(255,180,0,.3)" : "rgba(225,29,46,.3)";
  const color = isEntrance ? "#FFBC00" : "var(--red-bright)";
  const label = isEntrance ? "Entrance" : "Clip";
  return `<span class="category-badge" style="display:inline-flex;align-items:center;gap:.3rem;font-family:var(--f-mono);font-size:.66rem;letter-spacing:.05em;text-transform:uppercase;font-weight:600;padding:.2rem .5rem;border-radius:5px;background:${bg};border:1px solid ${border};color:${color};">${label}</span>`;
}

function timeAgo(dateStr){
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  const map = [[31536000,"y"],[2592000,"mo"],[86400,"d"],[3600,"h"],[60,"m"]];
  for (const [secs, label] of map){
    if (diff >= secs) return Math.floor(diff/secs) + label + " ago";
  }
  return "just now";
}

function formatViews(n){
  if (n >= 1000000) return (n/1000000).toFixed(1) + "M";
  if (n >= 1000) return (n/1000).toFixed(1) + "K";
  return String(n);
}

function getFavorites(){
  try{ return JSON.parse(localStorage.getItem("mlclips_favorites") || "[]"); }catch(e){ return []; }
}
function toggleFavorite(id){
  let favs = getFavorites();
  if (favs.includes(id)) favs = favs.filter(f => f !== id);
  else favs.push(id);
  localStorage.setItem("mlclips_favorites", JSON.stringify(favs));
  return favs.includes(id);
}
function isFavorite(id){ return getFavorites().includes(id); }

/* ---------------- Card markup ---------------- */
function clipCardHTML(clip){
  const fav = isFavorite(clip.id);
  return `
  <article class="clip-card" data-id="${clip.id}" tabindex="0" role="button" aria-label="Preview ${escapeHTML(clip.title)}">
    <div class="clip-thumb">
      <img src="${driveThumb(clip.driveId)}" alt="${escapeHTML(clip.title)}" loading="lazy" onerror="this.src='https://placehold.co/480x270/0e0e0e/5c5c5c?text=No+Thumbnail'">
      <button class="fav-btn ${fav ? 'active' : ''}" data-fav="${clip.id}" aria-label="Favorite">
        <svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-10-9.3C0.3 7.8 2.3 4 6 4c2.1 0 3.6 1.2 4.5 2.6.4.6.5.9 1.5.9s1.1-.3 1.5-.9C14.4 5.2 15.9 4 18 4c3.7 0 5.7 3.8 4 7.7C19.5 16.4 12 21 12 21z" stroke-width="1.8"/></svg>
      </button>
      <span class="duration-badge">${clip.duration || "00:00"}</span>
      <span class="hero-badge"><span>${escapeHTML(clip.hero)}</span></span>
      <div class="play-overlay"><div class="circle"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div></div>
    </div>
    <div class="clip-body">
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem;">
        ${categoryBadgeHTML(clip.category)}
      </div>
      <div class="clip-title">${escapeHTML(clip.title)}</div>
      <div class="clip-skin">${escapeHTML(clip.skin || "Default Skin")}</div>
      <div class="clip-meta">
        <span class="clip-owner">${escapeHTML(clip.owner)}</span>
        <span class="clip-stats">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
          ${formatViews(clip.views||0)}
        </span>
      </div>
      <div class="clip-footer-row">
        <span>${timeAgo(clip.uploadDate)}</span>
        <span>${formatViews(clip.downloads||0)} downloads</span>
      </div>
    </div>
  </article>`;
}

function escapeHTML(str){
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

function attachCardEvents(container){
  container.querySelectorAll(".clip-card").forEach(card => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".fav-btn")) return;
      openModal(card.dataset.id);
    });
    card.addEventListener("keypress", (e) => {
      if (e.key === "Enter") openModal(card.dataset.id);
    });
  });
  container.querySelectorAll(".fav-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const active = toggleFavorite(btn.dataset.fav);
      btn.classList.toggle("active", active);
      showToast(active ? "Added to favorites" : "Removed from favorites");
      if (typeof applyFilters === "function") applyFilters();
    });
  });
}

/* ---------------- Preview content builder (shared by both modes) ---------------- */
let __modalClips = [];
function registerClipsForModal(clips){ __modalClips = clips; }

function buildPreviewInnerHTML(clip){
  const fav = isFavorite(clip.id);
  return `
    <div class="modal-video"><iframe src="${drivePreview(clip.driveId)}" allow="autoplay" allowfullscreen></iframe></div>
    <div class="modal-video-fallback">
      Video not loading? <a href="https://drive.google.com/file/d/${clip.driveId}/view" target="_blank" rel="noopener">Open it directly in Google Drive</a>
    </div>
    <div class="modal-body">
      <div class="modal-tags">
        ${categoryBadgeHTML(clip.category)}
        <span class="tag hero-tag">${escapeHTML(clip.hero)}</span>
        <span class="tag skin-tag">${escapeHTML(clip.skin || "Default Skin")}</span>
      </div>
      <h2>${escapeHTML(clip.title)}</h2>
      <p class="modal-desc">${escapeHTML(clip.description || "No description provided for this clip.")}</p>
      <div class="modal-info-grid">
        <div class="info"><div class="l">Owner</div><div class="v">${escapeHTML(clip.owner)}</div></div>
        <div class="info"><div class="l">Uploaded</div><div class="v">${escapeHTML(clip.uploadDate)}</div></div>
        <div class="info"><div class="l">Views</div><div class="v">${formatViews(clip.views||0)}</div></div>
        <div class="info"><div class="l">Downloads</div><div class="v">${formatViews(clip.downloads||0)}</div></div>
      </div>
      <div class="modal-actions">
        <a class="mbtn primary" id="modal-download-btn" href="${driveDownload(clip.driveId)}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/></svg>
          Download
        </a>
        <button class="mbtn secondary" id="modal-copy-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy Drive Link
        </button>
        <button class="mbtn secondary" id="modal-share-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 3.9M15.4 6.6L8.6 10.5"/></svg>
          Share
        </button>
        <button class="mbtn fav ${fav ? 'active' : ''}" id="modal-fav-btn" aria-label="Favorite">
          <svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-10-9.3C0.3 7.8 2.3 4 6 4c2.1 0 3.6 1.2 4.5 2.6.4.6.5.9 1.5.9s1.1-.3 1.5-.9C14.4 5.2 15.9 4 18 4c3.7 0 5.7 3.8 4 7.7C19.5 16.4 12 21 12 21z" stroke-width="1.8"/></svg>
        </button>
      </div>
    </div>`;
}

function wirePreviewActions(root, clip){
  ClipsAPI.incrementView(clip.id);

  root.querySelector("#modal-download-btn").addEventListener("click", () => ClipsAPI.incrementDownload(clip.id));

  root.querySelector("#modal-copy-btn").addEventListener("click", async () => {
    const link = `https://drive.google.com/file/d/${clip.driveId}/view`;
    try{
      await navigator.clipboard.writeText(link);
      showToast("Drive link copied to clipboard");
    }catch(e){
      const ta = document.createElement("textarea");
      ta.value = link; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
      showToast("Drive link copied to clipboard");
    }
  });

  root.querySelector("#modal-share-btn").addEventListener("click", async () => {
    const shareData = { title: clip.title, text: `Check out this ${clip.hero} clip on MLCLIPS`, url: location.href.split("?")[0] + `?clip=${clip.id}` };
    if (navigator.share){
      try{ await navigator.share(shareData); }catch(e){}
    } else {
      await navigator.clipboard.writeText(shareData.url);
      showToast("Share link copied to clipboard");
    }
  });

  root.querySelector("#modal-fav-btn").addEventListener("click", function(){
    const active = toggleFavorite(clip.id);
    this.classList.toggle("active", active);
    document.querySelectorAll(`.fav-btn[data-fav="${clip.id}"]`).forEach(b => b.classList.toggle("active", active));
    showToast(active ? "Added to favorites" : "Removed from favorites");
    if (typeof applyFilters === "function") applyFilters();
  });
}

/* ---------------- Entry point ---------------- */
function openModal(id){
  const clip = __modalClips.find(c => String(c.id) === String(id));
  if (!clip) return;

  const previewScreen = document.getElementById("clip-preview-screen");
  const browseView    = document.getElementById("browse-view");

  if (previewScreen && browseView){
    openPreviewFullPage(clip, previewScreen, browseView);
  } else {
    openPreviewOverlay(clip);
  }
}

/* ---------------- Mode 1: non-overlay full page (used on clips.html) ---------------- */
function openPreviewFullPage(clip, previewScreen, browseView){
  const mount = document.getElementById("preview-content-mount");
  mount.innerHTML = buildPreviewInnerHTML(clip);

  browseView.style.display    = "none";
  previewScreen.style.display = "block";
  window.scrollTo(0, 0);

  wirePreviewActions(mount, clip);

  const backLink = document.getElementById("preview-back-link");
  const onBack = (e) => { e.preventDefault(); closePreviewFullPage(); };
  backLink.addEventListener("click", onBack, { once: true });
}

function closePreviewFullPage(){
  const previewScreen = document.getElementById("clip-preview-screen");
  const browseView    = document.getElementById("browse-view");
  const mount         = document.getElementById("preview-content-mount");
  if (!previewScreen || !browseView) return;
  mount.querySelector("iframe")?.setAttribute("src", "");
  previewScreen.style.display = "none";
  browseView.style.display    = "";
  window.scrollTo(0, 0);
}

/* ---------------- Mode 2: fixed overlay fallback (used on index.html) ---------------- */
function openPreviewOverlay(clip){
  let overlay = document.getElementById("preview-modal");
  if (!overlay){
    overlay = document.createElement("div");
    overlay.id = "preview-modal";
    overlay.className = "modal-overlay";
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" aria-label="${escapeHTML(clip.title)}">
      <button class="modal-close" aria-label="Close preview"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      ${buildPreviewInnerHTML(clip)}
    </div>`;

  document.body.classList.add("modal-locked");
  requestAnimationFrame(() => overlay.classList.add("open"));

  wirePreviewActions(overlay, clip);

  overlay.querySelector(".modal-close").addEventListener("click", closePreviewOverlay);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closePreviewOverlay(); });

  document.addEventListener("keydown", escClose);
}

function escClose(e){ if (e.key === "Escape") closePreviewOverlay(); }

function closePreviewOverlay(){
  const overlay = document.getElementById("preview-modal");
  if (!overlay) return;
  overlay.classList.remove("open");
  document.body.classList.remove("modal-locked");
  document.removeEventListener("keydown", escClose);
  setTimeout(() => { overlay.querySelector(".modal-video iframe")?.setAttribute("src",""); }, 320);
}

/* ---------------- Toast (fallback for pages without SweetAlert2) ---------------- */
function showToast(message){
  if (window.Swal){
    try {
      Swal.mixin({
        toast: true, position: "top-end", showConfirmButton: false,
        timer: 2200, timerProgressBar: true,
        didOpen(t){ if(t){ t.addEventListener("mouseenter",Swal.stopTimer); t.addEventListener("mouseleave",Swal.resumeTimer); } }
      }).fire({ icon: "success", title: message });
      return;
    } catch(e) { /* fall through to native toast */ }
  }
  let toast = document.getElementById("global-toast");
  if (!toast){
    toast = document.createElement("div");
    toast.id = "global-toast";
    toast.className = "toast";
    toast.innerHTML = `<span class="ico">✓</span><span id="toast-msg"></span>`;
    document.body.appendChild(toast);
  }
  toast.querySelector("#toast-msg").textContent = message;
  toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove("show"), 2600);
}
