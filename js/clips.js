/* ============================================================
   MLCLIPS — Clips Page Controller
   ============================================================ */

let ALL_CLIPS = [];
let activeHero = "All";
let activeCategory = "All";
let activeSort = "newest";
let activeQuery = "";

document.addEventListener("DOMContentLoaded", async () => {
  renderSkeletons();

  await initFirebase();
  ClipsAPI.onChange(clips => {
    ALL_CLIPS = clips;
    registerClipsForModal(clips);
    renderAllFilters();
    applyFilters();
  });

  setupSearch();
  setupSort();
  handleDeepLink();
});

/* ---------------- Combined filter row: Category chips + divider + Hero chips ---------------- */
function renderAllFilters(){
  const wrap = document.getElementById("all-filters");
  if (!wrap) return;

  const categories = ["All", "Clip", "Entrance Animation"];
  const catLabels = { "All": "All", "Clip": "Clips", "Entrance Animation": "Entrances" };

  const uniqueHeroes = [...new Set(ALL_CLIPS.map(c => c.hero).filter(Boolean))].sort((a,b) => a.localeCompare(b));
  if (!uniqueHeroes.includes(activeHero)) activeHero = "All";

  const catChipsHTML = categories.map(cat =>
    `<button class="chip ${cat === activeCategory ? 'active' : ''}" data-cat="${escapeHTML(cat)}"><span class="dot"></span>${escapeHTML(catLabels[cat])}</button>`
  ).join("");

  const heroChipsHTML = ["All", ...uniqueHeroes].map(h =>
    `<button class="chip ${h === activeHero ? 'active' : ''}" data-hero="${escapeHTML(h)}"><span class="dot"></span>${escapeHTML(h)}</button>`
  ).join("");

  wrap.innerHTML = `
    ${catChipsHTML}
    <span class="chip-divider" aria-hidden="true"></span>
    ${heroChipsHTML}
  `;

  wrap.querySelectorAll("[data-cat]").forEach(chip => {
    chip.addEventListener("click", () => {
      activeCategory = chip.dataset.cat;
      renderAllFilters();
      applyFilters();
    });
  });
  wrap.querySelectorAll("[data-hero]").forEach(chip => {
    chip.addEventListener("click", () => {
      activeHero = chip.dataset.hero;
      renderAllFilters();
      applyFilters();
    });
  });
}

/* ---------------- Search + suggestions ---------------- */
function setupSearch(){
  const input = document.getElementById("search-input");
  const clearBtn = document.getElementById("search-clear");
  const suggestBox = document.getElementById("search-suggestions");
  if (!input) return;

  let debounceTimer;
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      activeQuery = input.value.trim().toLowerCase();
      clearBtn.classList.toggle("show", activeQuery.length > 0);
      renderSuggestions(activeQuery);
      applyFilters();
    }, 180);
  });

  input.addEventListener("focus", () => { if (activeQuery) renderSuggestions(activeQuery); });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) suggestBox.classList.remove("show");
  });

  clearBtn.addEventListener("click", () => {
    input.value = ""; activeQuery = "";
    clearBtn.classList.remove("show");
    suggestBox.classList.remove("show");
    applyFilters();
    input.focus();
  });

  function renderSuggestions(q){
    if (!q){ suggestBox.classList.remove("show"); return; }
    const matches = [];
    const seen = new Set();
    ALL_CLIPS.forEach(c => {
      [["title", c.title], ["owner", c.owner], ["hero", c.hero], ["skin", c.skin]].forEach(([field, val]) => {
        if (val && val.toLowerCase().includes(q) && !seen.has(field+":"+val)){
          seen.add(field+":"+val);
          matches.push({ field, val });
        }
      });
    });
    const top = matches.slice(0, 6);
    if (!top.length){ suggestBox.classList.remove("show"); return; }
    suggestBox.innerHTML = top.map(m =>
      `<li data-val="${escapeHTML(m.val)}"><span class="tag">${m.field}</span><b>${escapeHTML(m.val)}</b></li>`
    ).join("");
    suggestBox.classList.add("show");
    suggestBox.querySelectorAll("li").forEach(li => {
      li.addEventListener("click", () => {
        input.value = li.dataset.val;
        activeQuery = li.dataset.val.toLowerCase();
        clearBtn.classList.add("show");
        suggestBox.classList.remove("show");
        applyFilters();
      });
    });
  }
}

/* ---------------- Sort ---------------- */
function setupSort(){
  const select = document.getElementById("sort-select");
  if (!select) return;
  select.addEventListener("change", () => {
    activeSort = select.value;
    applyFilters();
  });
}

/* ---------------- Filter + sort + render ---------------- */
function applyFilters(){
  let result = [...ALL_CLIPS];

  if (activeHero !== "All"){
    result = result.filter(c => c.hero === activeHero);
  }

  if (activeCategory !== "All"){
    result = result.filter(c => (c.category || "Clip") === activeCategory);
  }

  if (activeQuery){
    result = result.filter(c => {
      const haystack = [c.title, c.owner, c.hero, c.skin, c.description].join(" ").toLowerCase();
      return haystack.includes(activeQuery);
    });
  }

  switch (activeSort){
    case "newest": result.sort((a,b) => new Date(b.uploadDate) - new Date(a.uploadDate)); break;
    case "oldest": result.sort((a,b) => new Date(a.uploadDate) - new Date(b.uploadDate)); break;
    case "views": result.sort((a,b) => (b.views||0) - (a.views||0)); break;
    case "az": result.sort((a,b) => a.title.localeCompare(b.title)); break;
    case "za": result.sort((a,b) => b.title.localeCompare(a.title)); break;
  }

  renderGrid(result);
  const countEl = document.getElementById("result-count");
  if (countEl) countEl.textContent = `${result.length} clip${result.length === 1 ? "" : "s"} found`;
}

function renderGrid(clips){
  const grid = document.getElementById("clips-grid");
  if (!grid) return;
  if (!clips.length){
    grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
        <h3>No clips found</h3>
        <p>Try a different hero or search term.</p>
      </div>`;
    return;
  }
  grid.innerHTML = clips.map(clipCardHTML).join("");
  attachCardEvents(grid);
}

function renderSkeletons(){
  const grid = document.getElementById("clips-grid");
  if (!grid) return;
  grid.innerHTML = Array.from({length: 8}).map(() => `
    <div class="skeleton-card">
      <div class="skeleton"></div>
      <div class="skeleton sk-line"></div>
      <div class="skeleton sk-line short"></div>
    </div>`).join("");
}

/* ---------------- Deep link ?clip=ID ---------------- */
function handleDeepLink(){
  const params = new URLSearchParams(location.search);
  const id = params.get("clip");
  if (id){
    const tryOpen = setInterval(() => {
      if (ALL_CLIPS.length){
        clearInterval(tryOpen);
        openModal(id);
      }
    }, 200);
    setTimeout(() => clearInterval(tryOpen), 4000);
  }
}