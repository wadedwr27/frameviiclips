/* ============================================================
   MLCLIPS — Member Access Gate (client-side shared password)
   ------------------------------------------------------------
   NOTE / IMPORTANT: This is a lightweight deterrent, not real
   security. The password lives in this JS file, so anyone who
   opens dev tools or "view source" can read it. It stops casual
   link-sharing/leaking to non-members, but a determined person
   could still bypass it.
   ============================================================ */

const SITE_ACCESS_PASSWORD = "frame.seven2026#"; // 🔑 shared member password
const ACCESS_STORAGE_KEY   = "mlclips_access_unlocked";

function isSiteUnlocked(){
  return sessionStorage.getItem(ACCESS_STORAGE_KEY) === "true" ||
         localStorage.getItem(ACCESS_STORAGE_KEY) === "true";
}

function unlockSite(remember){
  (remember ? localStorage : sessionStorage).setItem(ACCESS_STORAGE_KEY, "true");
}

function lockSiteNow(){
  localStorage.removeItem(ACCESS_STORAGE_KEY);
  sessionStorage.removeItem(ACCESS_STORAGE_KEY);
  location.reload();
}

function initAccessGate(){
  const gate    = document.getElementById("access-gate");
  const content = document.getElementById("gated-content");
  if (!gate || !content) return;

  if (isSiteUnlocked()){
    gate.style.display    = "none";
    content.style.display = "";
    return;
  }

  // locked: show the full-page password screen, hide the real content
  gate.style.display    = "flex";
  content.style.display = "none";

  const form     = document.getElementById("access-form");
  const input    = document.getElementById("access-password");
  const err      = document.getElementById("access-error");
  const remember = document.getElementById("access-remember");
  const pwToggle = document.getElementById("access-pw-toggle");

  if (pwToggle){
    pwToggle.addEventListener("click", () => {
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      pwToggle.classList.toggle("active", !showing);
      pwToggle.setAttribute("aria-label", showing ? "Show password" : "Hide password");
    });
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    if (input.value === SITE_ACCESS_PASSWORD){
      unlockSite(remember ? remember.checked : true);
      gate.style.display    = "none";
      content.style.display = "";
      err.classList.remove("show");
    } else {
      err.textContent = "Incorrect password.";
      err.classList.add("show");
      input.value = "";
      input.focus();
    }
  });
}

document.addEventListener("DOMContentLoaded", initAccessGate);
