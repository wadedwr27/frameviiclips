/* ============================================================
   MLCLIPS — Admin Dashboard Controller (Ainezta-concept)
   ============================================================ */

let ADMIN_CLIPS = [];
let editingId = null;
let selectedCategory = "Clip";
let manageFilter = "all";

/* ── SweetAlert2 toast ── */
function notify(icon, title){
  if (!window.Swal){ showToast(title); return; }
  try {
    Swal.mixin({
      toast: true, position: "top-end", showConfirmButton: false,
      timer: 2600, timerProgressBar: true,
      didOpen(t){
        if (!t) return;
        t.addEventListener("mouseenter", Swal.stopTimer);
        t.addEventListener("mouseleave", Swal.resumeTimer);
      }
    }).fire({ icon, title });
  } catch(e) {
    showToast(title);
  }
}

/* ── View router ── */
function showView(name){
  ["dashboard","upload","manage"].forEach(v => {
    document.getElementById("view-"+v).style.display = v===name ? "" : "none";
  });
  document.querySelectorAll("#admin-nav a").forEach(a => {
    a.classList.toggle("active", a.dataset.view===name);
  });
  const titles = { dashboard:["Dashboard","Overview of your clip library"], upload:["Upload New Clip","Add a clip to the library"], manage:["Manage Clips","Edit or delete existing clips"] };
  document.getElementById("topbar-title").textContent = titles[name][0];
  document.getElementById("topbar-sub").textContent   = titles[name][1];
  const badge = document.getElementById("topbar-badge");
  if(name==="manage"){ badge.textContent=ADMIN_CLIPS.length+" clips"; badge.style.display=""; }
  else badge.style.display="none";
}

document.addEventListener("DOMContentLoaded", async () => {
  await initFirebase();

  const loginScreen = document.getElementById("login-screen");
  const dashboard   = document.getElementById("admin-dashboard");

  AuthAPI.onAuthChange(user => {
    if(user){
      loginScreen.style.display = "none";
      dashboard.style.display   = "flex";
      bootDashboard();
    } else {
      loginScreen.style.display = "flex";
      dashboard.style.display   = "none";
    }
  });

  /* Login */
  const loginForm = document.getElementById("login-form");
  if(loginForm){
    loginForm.addEventListener("submit", async e => {
      e.preventDefault();
      const email = document.getElementById("login-email").value.trim();
      const pass  = document.getElementById("login-password").value;
      const errBox = document.getElementById("login-error");
      const btn = loginForm.querySelector("button[type=submit]");
      btn.disabled=true; btn.textContent="Signing in…";
      try{
        await AuthAPI.login(email, pass);
        errBox.classList.remove("show");
      }catch(err){
        errBox.textContent = err.message||"Login failed.";
        errBox.classList.add("show");
        notify("error", err.message||"Login failed");
      }finally{
        btn.disabled=false; btn.textContent="Sign In";
      }
    });
  }

  document.getElementById("logout-btn")?.addEventListener("click",()=>AuthAPI.logout());

  /* Nav routing */
  document.querySelectorAll("[data-view]").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      const v = a.dataset.view;
      showView(v);
      if(v==="manage" && a.dataset.filter) setManageFilter(a.dataset.filter);
    });
  });

  /* Manage filter bar */
  document.querySelectorAll("[data-mfilter]").forEach(btn => {
    btn.addEventListener("click",()=>{
      setManageFilter(btn.dataset.mfilter);
    });
  });
});

let dashboardBooted = false;
function bootDashboard(){
  if(dashboardBooted) return;
  dashboardBooted = true;

  ClipsAPI.onChange(clips => {
    try {
      ADMIN_CLIPS = clips;
      renderStats(clips);
      renderRecent(clips);
      renderManageTable(clips);
      updateNavCounts(clips);
      const badge = document.getElementById("topbar-badge");
      if(badge && badge.style.display!=="none") badge.textContent = clips.length+" clips";
    } catch(err) {
      console.error("Admin onChange error:", err);
    }
  });

  setupUploadForm();
}

function updateNavCounts(clips){
  const all      = clips.length;
  const entrances= clips.filter(c=>(c.category||"Clip")==="Entrance Animation").length;
  const clipsN   = clips.filter(c=>(c.category||"Clip")==="Clip").length;
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  set("nav-count", all);
  set("nav-all-count", all);
  set("nav-entrance-count", entrances);
  set("nav-clip-count", clipsN);
  set("astat-clips", all);
}

function renderStats(clips){
  const views     = clips.reduce((s,c)=>s+(c.views||0),0);
  const downloads = clips.reduce((s,c)=>s+(c.downloads||0),0);
  const heroes    = new Set(clips.map(c=>c.hero)).size;
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v.toLocaleString(); };
  set("astat-clips", clips.length);
  set("astat-views", views);
  set("astat-downloads", downloads);
  set("astat-heroes", heroes);
}

function renderRecent(clips){
  const wrap = document.getElementById("recent-uploads-list");
  if(!wrap) return;
  if(!clips || !clips.length){
    wrap.innerHTML=`<div class="table-empty"><p>No clips uploaded yet.</p></div>`;
    return;
  }
  const sorted = [...clips]
    .sort((a,b)=> (new Date(b.uploadDate||0)) - (new Date(a.uploadDate||0)))
    .slice(0,5);
  wrap.innerHTML = sorted.map(c=>`
    <div class="recent-row">
      <img class="recent-thumb" src="${driveThumb(c.driveId)}" onerror="this.src='https://placehold.co/80x45/161616/5c5c5c?text=N/A'" alt="">
      <div class="recent-info">
        <div class="rt">${escapeHTML(c.title||"Untitled")}</div>
        <div class="rs">${escapeHTML(c.hero||"—")} · ${escapeHTML(c.owner||"—")}</div>
      </div>
      <span class="recent-time">${timeAgo(c.uploadDate||new Date().toISOString())}</span>
    </div>`).join("");
}

/* ── Manage table ── */
function setManageFilter(filter){
  manageFilter = filter;
  document.querySelectorAll("[data-mfilter]").forEach(b=>b.classList.toggle("active",b.dataset.mfilter===filter));
  renderManageTable(ADMIN_CLIPS);
}

function renderManageTable(clips){
  const tbody = document.getElementById("manage-table-body");
  if(!tbody) return;

  let filtered = [...clips];
  if(manageFilter!=="all") filtered = filtered.filter(c=>(c.category||"Clip")===manageFilter);
  filtered.sort((a,b)=>new Date(b.uploadDate)-new Date(a.uploadDate));

  const label = document.getElementById("manage-count-label");
  if(label) label.textContent = filtered.length+" clip"+(filtered.length===1?"":"s")+(manageFilter!=="all"?" · "+manageFilter:"")+" in library";

  if(!filtered.length){
    tbody.innerHTML=`<tr><td colspan="8"><div class="table-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
      <p>No clips found.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c=>{
    const cat = c.category||"Clip";
    const catBadge = cat==="Entrance Animation"
      ? `<span class="badge badge-entrance">▶ Entrance</span>`
      : `<span class="badge badge-clip">▶ Clip</span>`;
    return `<tr data-id="${c.id}">
      <td><img class="t-thumb" src="${driveThumb(c.driveId)}" onerror="this.src='https://placehold.co/120x68/161616/5c5c5c?text=N/A'" alt=""></td>
      <td class="clip-title-cell">
        <span class="clip-t">${escapeHTML(c.title)}</span>
        <span class="clip-s">${escapeHTML(c.skin||"—")}</span>
      </td>
      <td>${catBadge}</td>
      <td><span class="badge badge-hero">${escapeHTML(c.hero)}</span></td>
      <td style="color:var(--text-secondary)">${escapeHTML(c.owner)}</td>
      <td style="color:var(--text-muted);font-family:var(--f-mono);font-size:.8rem;">${escapeHTML(c.duration||"—")}</td>
      <td>
        <a class="act-btn act-btn-src" href="https://drive.google.com/file/d/${c.driveId}/view" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          GDrive
        </a>
      </td>
      <td>
        <div class="action-group">
          <button class="act-btn act-btn-edit edit-btn" data-id="${c.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            Edit
          </button>
          <button class="act-btn act-btn-del delete-btn" data-id="${c.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            Del
          </button>
        </div>
      </td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll(".edit-btn").forEach(btn=>btn.addEventListener("click",()=>openEdit(btn.dataset.id)));
  tbody.querySelectorAll(".delete-btn").forEach(btn=>btn.addEventListener("click",()=>confirmDelete(btn.dataset.id)));
}

/* ── Upload / Edit form ── */
function setupUploadForm(){
  const form = document.getElementById("upload-form");
  if(!form) return;

  /* Hero datalist */
  const heroDatalist = document.getElementById("hero-suggestions");
  if(heroDatalist) heroDatalist.innerHTML = HERO_LIST.map(h=>`<option value="${h}">`).join("");

  /* Drive URL → ID extraction on type */
  const driveUrlInput = document.getElementById("f-drive-url");
  const driveIdDisplay= document.getElementById("drive-id-display");
  const driveIdVal    = document.getElementById("drive-id-val");

  driveUrlInput.addEventListener("input",()=>{
    const raw = driveUrlInput.value.trim();
    if(!raw){ driveIdDisplay.classList.remove("show"); return; }
    const id = extractDriveId(raw);
    driveIdVal.textContent = id;
    driveIdDisplay.classList.add("show");
  });

  /* Category toggle */
  document.querySelectorAll(".cat-btn[data-cat]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      selectedCategory = btn.dataset.cat;
      document.getElementById("f-category").value = selectedCategory;
      document.querySelectorAll(".cat-btn[data-cat]").forEach(b=>b.classList.toggle("active",b===btn));
    });
  });

  /* Drag & drop zone */
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("f-file-input");
  const preview   = document.getElementById("drop-preview");

  ["dragenter","dragover"].forEach(ev=>dropZone.addEventListener(ev,e=>{e.preventDefault();dropZone.classList.add("dragover");}));
  ["dragleave","drop"].forEach(ev=>dropZone.addEventListener(ev,e=>{e.preventDefault();dropZone.classList.remove("dragover");}));
  dropZone.addEventListener("drop",e=>{
    const file = e.dataTransfer.files[0];
    if(file && file.type.startsWith("video/")) previewFile(file);
  });
  fileInput.addEventListener("change",()=>{ if(fileInput.files[0]) previewFile(fileInput.files[0]); });

  function previewFile(file){
    const url = URL.createObjectURL(file);
    preview.src = url;
    dropZone.classList.add("has-file");
  }

  /* Submit */
  form.addEventListener("submit", async e=>{
    e.preventDefault();
    const submitBtn = document.getElementById("submit-btn");
    submitBtn.disabled=true;
    submitBtn.innerHTML=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 1s linear infinite"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>${editingId?"Saving…":"Adding…"}`;

    const driveId = extractDriveId(document.getElementById("f-drive-url").value.trim());

    const data = {
      title:       document.getElementById("f-title").value.trim(),
      owner:       document.getElementById("f-owner").value.trim(),
      hero:        document.getElementById("f-hero").value.trim(),
      skin:        document.getElementById("f-skin").value.trim(),
      category:    document.getElementById("f-category").value,
      description: document.getElementById("f-description").value.trim(),
      driveId,
      duration:    document.getElementById("f-duration").value.trim()||"0:00"
    };

    try{
      if(editingId){
        await ClipsAPI.update(editingId, data);
        notify("success","Clip updated successfully");
      } else {
        await ClipsAPI.add(data);
        notify("success","Clip added to library");
      }
      resetForm();
      showView("manage");
    }catch(err){
      notify("error","Error: "+err.message);
    }finally{
      submitBtn.disabled=false;
      submitBtn.innerHTML=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14m-7-7h14"/></svg>${editingId?"Save Changes":"Add to Library"}`;
    }
  });

  document.getElementById("cancel-edit-btn")?.addEventListener("click",()=>{
    resetForm();
    showView("manage");
  });
}

/* ── Edit ── */
function openEdit(id){
  const clip = ADMIN_CLIPS.find(c=>c.id===id);
  if(!clip) return;
  editingId = id;

  showView("upload");
  document.getElementById("upload-form-title").textContent = "Edit Clip";
  document.getElementById("upload-form-sub").textContent   = "Update clip details below";
  document.getElementById("submit-btn").innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>Save Changes`;
  document.getElementById("cancel-edit-btn").style.display = "inline-flex";

  document.getElementById("f-title").value       = clip.title;
  document.getElementById("f-owner").value       = clip.owner;
  document.getElementById("f-hero").value        = clip.hero;
  document.getElementById("f-skin").value        = clip.skin||"";
  document.getElementById("f-description").value = clip.description||"";
  document.getElementById("f-drive-url").value   = clip.driveId;
  document.getElementById("f-duration").value    = clip.duration||"";

  selectedCategory = clip.category||"Clip";
  document.getElementById("f-category").value = selectedCategory;
  document.querySelectorAll(".cat-btn[data-cat]").forEach(b=>b.classList.toggle("active",b.dataset.cat===selectedCategory));

  /* Show extracted ID */
  document.getElementById("drive-id-val").textContent = clip.driveId;
  document.getElementById("drive-id-display").classList.add("show");

  window.scrollTo({top:0,behavior:"smooth"});
}

function resetForm(){
  editingId = null;
  document.getElementById("upload-form").reset();
  document.getElementById("f-category").value = "Clip";
  selectedCategory = "Clip";
  document.querySelectorAll(".cat-btn[data-cat]").forEach(b=>b.classList.toggle("active",b.dataset.cat==="Clip"));
  document.getElementById("drive-id-display").classList.remove("show");
  document.getElementById("drop-zone").classList.remove("has-file");
  document.getElementById("upload-form-title").textContent = "Upload New Clip";
  document.getElementById("upload-form-sub").textContent   = "Add a clip to the library";
  const cancelBtn = document.getElementById("cancel-edit-btn");
  if(cancelBtn) cancelBtn.style.display="none";
  const submitBtn = document.getElementById("submit-btn");
  submitBtn.innerHTML=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14m-7-7h14"/></svg>Add to Library`;
}

/* ── Delete ── */
function confirmDelete(id){
  const clip = ADMIN_CLIPS.find(c=>c.id===id);
  if(!clip) return;

  if(window.Swal){
    Swal.fire({
      title:"Delete Clip?",
      html:`<b>${escapeHTML(clip.title)}</b><br>This removes it from the database permanently.`,
      icon:"warning",
      showCancelButton:true,
      confirmButtonText:"Delete",
      cancelButtonText:"Cancel",
      reverseButtons:true,
      focusCancel:true
    }).then(async result=>{
      if(!result.isConfirmed) return;
      try{
        await ClipsAPI.remove(id);
        notify("success","Clip deleted");
      }catch(err){
        notify("error","Could not delete: "+err.message);
      }
    });
  } else {
    if(confirm(`Delete "${clip.title}"?`)){
      ClipsAPI.remove(id).then(()=>showToast("Clip deleted"));
    }
  }
}