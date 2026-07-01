/* ============================================================
   MLCLIPS — Firebase Layer
   ------------------------------------------------------------
   1. Paste your Firebase project config below (firebaseConfig).
   2. Enable Authentication > Email/Password, and create exactly
      one admin user in the Firebase console.
   3. Enable Cloud Firestore and create a collection named "clips".
   4. If no config is provided, the site runs in DEMO MODE using
      local sample data so you can preview the UI immediately.
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyA4iLdRiIAQ8LJfxBAwB90jgz_t635hb4U",
  authDomain: "frame-vii-clips.firebaseapp.com",
  projectId: "frame-vii-clips",
  storageBucket: "frame-vii-clips.firebasestorage.app",
  messagingSenderId: "545460683808",
  appId: "1:545460683808:web:206b71312ce49d5e912845"
};

const DEMO_MODE = firebaseConfig.apiKey === "YOUR_API_KEY";

/* ---------------- Demo sample data (used only when Firebase isn't configured) ----------------
   Starts empty — upload clips via the Admin panel to populate the library. */
const DEMO_CLIPS = [];

const HERO_LIST = ["Fanny","Lancelot","Ling","Hayabusa","Gusion","Julian","Claude","Beatrix"];

/* Local mutable cache used by both demo and live mode */
let CLIPS_CACHE = [];
let firebaseApp = null, db = null, auth = null;

async function initFirebase(){
  if (DEMO_MODE){
    CLIPS_CACHE = loadLocalClips();
    return { demo: true };
  }
  try{
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
    const firestore = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const authMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
    firebaseApp = initializeApp(firebaseConfig);
    db = firestore.getFirestore(firebaseApp);
    auth = authMod.getAuth(firebaseApp);
    window.__fb = { firestore, authMod, db, auth };
    return { demo: false };
  }catch(err){
    console.warn("Firebase failed to initialize, falling back to demo mode.", err);
    CLIPS_CACHE = loadLocalClips();
    return { demo: true };
  }
}

/* ---------------- LocalStorage-backed "Firestore" for demo mode ---------------- */
function loadLocalClips(){
  try{
    const raw = localStorage.getItem("mlclips_demo_clips");
    if (raw) return JSON.parse(raw);
  }catch(e){}
  localStorage.setItem("mlclips_demo_clips", JSON.stringify(DEMO_CLIPS));
  return JSON.parse(JSON.stringify(DEMO_CLIPS));
}
function saveLocalClips(clips){
  localStorage.setItem("mlclips_demo_clips", JSON.stringify(clips));
}

/* ---------------- Public data API used by all pages ---------------- */
const ClipsAPI = {
  _listeners: [],

  _emit(){
    const clips = loadLocalClips();
    this._listeners.forEach(cb => {
      try { cb(clips); } catch(e){ console.error("ClipsAPI listener error:", e); }
    });
  },

  async getAll(){
    if (DEMO_MODE){
      return loadLocalClips();
    }
    const { collection, getDocs } = window.__fb.firestore;
    const snap = await getDocs(collection(db, "clips"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  onChange(callback){
    if (DEMO_MODE){
      callback(loadLocalClips());
      this._listeners.push(callback);
      window.addEventListener("storage", () => callback(loadLocalClips()));
      return () => {
        this._listeners = this._listeners.filter(cb => cb !== callback);
      };
    }
    const { collection, onSnapshot } = window.__fb.firestore;
    return onSnapshot(collection(db, "clips"), snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  },

  async add(clip){
    if (DEMO_MODE){
      return new Promise(resolve => {
        setTimeout(() => {
          const clips = loadLocalClips();
          clip.id = String(Date.now());
          clip.views = 0; clip.downloads = 0; clip.favorites = 0;
          clip.uploadDate = new Date().toISOString().slice(0,10);
          clips.unshift(clip);
          saveLocalClips(clips);
          this._emit();
          resolve(clip);
        }, 250);
      });
    }
    const { collection, addDoc, serverTimestamp } = window.__fb.firestore;
    return addDoc(collection(db, "clips"), { ...clip, views:0, downloads:0, favorites:0, uploadDate: new Date().toISOString().slice(0,10), createdAt: serverTimestamp() });
  },

  async update(id, data){
    if (DEMO_MODE){
      return new Promise(resolve => {
        setTimeout(() => {
          const clips = loadLocalClips();
          const idx = clips.findIndex(c => c.id === id);
          if (idx > -1) clips[idx] = { ...clips[idx], ...data };
          saveLocalClips(clips);
          this._emit();
          resolve();
        }, 250);
      });
    }
    const { doc, updateDoc } = window.__fb.firestore;
    return updateDoc(doc(db, "clips", id), data);
  },

  async remove(id){
    if (DEMO_MODE){
      return new Promise(resolve => {
        setTimeout(() => {
          const clips = loadLocalClips().filter(c => c.id !== id);
          saveLocalClips(clips);
          this._emit();
          resolve();
        }, 250);
      });
    }
    const { doc, deleteDoc } = window.__fb.firestore;
    return deleteDoc(doc(db, "clips", id));
  },

  async incrementView(id){
    if (DEMO_MODE){
      const clips = loadLocalClips();
      const c = clips.find(c => c.id === id);
      if (c){ c.views = (c.views||0) + 1; saveLocalClips(clips); this._emit(); }
      return;
    }
    const { doc, updateDoc, increment } = window.__fb.firestore;
    return updateDoc(doc(db, "clips", id), { views: increment(1) });
  },

  async incrementDownload(id){
    if (DEMO_MODE){
      const clips = loadLocalClips();
      const c = clips.find(c => c.id === id);
      if (c){ c.downloads = (c.downloads||0) + 1; saveLocalClips(clips); this._emit(); }
      return;
    }
    const { doc, updateDoc, increment } = window.__fb.firestore;
    return updateDoc(doc(db, "clips", id), { downloads: increment(1) });
  }
};

/* ---------------- Admin Auth API ---------------- */
const AuthAPI = {
  _listeners: [],
  _notify(){
    const user = this.isLoggedIn() ? { uid: "demo-admin" } : null;
    this._listeners.forEach(cb => cb(user));
  },
  async login(email, password){
    if (DEMO_MODE){
      if (email === "frame7@mlclips.gg" && password === "frame7admin2026"){
        sessionStorage.setItem("mlclips_admin", "true");
        this._notify();
        return { uid: "demo-admin", email };
      }
      throw new Error("Invalid email or password.");
    }
    const { signInWithEmailAndPassword } = window.__fb.authMod;
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  },
  async logout(){
    if (DEMO_MODE){
      sessionStorage.removeItem("mlclips_admin");
      this._notify();
      return;
    }
    const { signOut } = window.__fb.authMod;
    return signOut(auth);
  },
  isLoggedIn(){
    if (DEMO_MODE) return sessionStorage.getItem("mlclips_admin") === "true";
    return !!(auth && auth.currentUser);
  },
  onAuthChange(cb){
    if (DEMO_MODE){
      this._listeners.push(cb);
      cb(this.isLoggedIn() ? { uid:"demo-admin" } : null);
      return;
    }
    const { onAuthStateChanged } = window.__fb.authMod;
    onAuthStateChanged(auth, cb);
  }
};

/* ---------------- Drive URL helpers ---------------- */
function driveThumb(id){ return `https://lh3.googleusercontent.com/d/${id}`; }
function drivePreview(id){ return `https://drive.google.com/file/d/${id}/preview`; }
function driveDownload(id){ return `https://drive.google.com/uc?export=download&id=${id}`; }

function extractDriveId(input){
  if (!input) return "";
  const str = input.trim();
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]{10,})/,
    /[?&]id=([a-zA-Z0-9_-]{10,})/,
    /\/d\/([a-zA-Z0-9_-]{10,})/
  ];
  for (const re of patterns){
    const m = str.match(re);
    if (m) return m[1];
  }
  if (/^[a-zA-Z0-9_-]{10,}$/.test(str)) return str;
  return str;
}