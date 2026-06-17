// ── Elements ──────────────────────────────────────────────
const webcam      = document.getElementById("webcam");
const cap         = document.getElementById("cap");
const ctx         = cap.getContext("2d");
const btnStart    = document.getElementById("btn-start");
const btnStop     = document.getElementById("btn-stop");
const btnClear    = document.getElementById("btn-clear");
const camIdle     = document.getElementById("cam-idle");
const resultBadge = document.getElementById("result-badge");
const badgeIcon   = document.getElementById("badge-icon");
const badgeText   = document.getElementById("badge-text");
const confPill    = document.getElementById("conf-pill");
const pillConf    = document.getElementById("pill-conf");
const fallAlert   = document.getElementById("fall-alert");
const statStatus  = document.getElementById("stat-status");
const statConf    = document.getElementById("stat-conf");
const statFrames  = document.getElementById("stat-frames");
const statAlerts  = document.getElementById("stat-alerts");
const confBar     = document.getElementById("conf-bar");
const logBody     = document.getElementById("log-body");
const liveDot     = document.getElementById("live-dot");
const navStatus   = document.getElementById("nav-status");
const navBadge    = document.querySelector(".nav-badge");

// Upload
const uploadZone    = document.getElementById("upload-zone");
const uploadIdle    = document.getElementById("upload-idle");
const uploadPreview = document.getElementById("upload-preview");
const uploadResult  = document.getElementById("upload-result");
const uploadLoading = document.getElementById("upload-loading");
const resultCard    = document.getElementById("result-card");
const resultIcon    = document.getElementById("result-icon");
const resultLabel   = document.getElementById("result-label");
const resultConfVal = document.getElementById("result-conf-val");
const uploadConfBar = document.getElementById("upload-conf-bar");
const btnRetry      = document.getElementById("btn-retry");
const fileInput     = document.getElementById("file-input");
const uploadLink    = document.getElementById("upload-link");

// ── Live detection state ──────────────────────────────────
let ws = null, stream = null, running = false;
let frameCount = 0, alertCount = 0, frameInterval = null, alertTimeout = null;
const FPS_MS = 500;

// ── Start ─────────────────────────────────────────────────
btnStart.addEventListener("click", async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
    webcam.srcObject = stream;
    await webcam.play();
    camIdle.style.display = "none";

    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${proto}//${location.host}/ws`);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      setNavLive(true);
      running = true;
      btnStart.classList.add("hidden");
      btnStop.classList.remove("hidden");
      resultBadge.classList.remove("hidden");
      confPill.classList.remove("hidden");
      startFrames();
    };

    ws.onmessage = e => handleLive(JSON.parse(e.data));
    ws.onclose   = () => { setNavLive(false); stopAll(); };
    ws.onerror   = () => stopAll();

  } catch(err) {
    alert("Camera error: " + err.message);
  }
});

btnStop.addEventListener("click", stopAll);

function stopAll() {
  running = false;
  clearInterval(frameInterval);
  if (ws)     { ws.close(); ws = null; }
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  btnStop.classList.add("hidden");
  btnStart.classList.remove("hidden");
  resultBadge.classList.add("hidden");
  confPill.classList.add("hidden");
  fallAlert.classList.add("hidden");
  camIdle.style.display = "";
  setNavLive(false);
  statStatus.textContent = "Inactive";
  statStatus.className   = "stat-big";
}

function startFrames() {
  frameInterval = setInterval(() => {
    if (!running || !ws || ws.readyState !== WebSocket.OPEN) return;
    cap.width = cap.height = 224;
    ctx.drawImage(webcam, 0, 0, 224, 224);
    cap.toBlob(blob => { if (blob) blob.arrayBuffer().then(b => { ws.send(b); frameCount++; statFrames.textContent = frameCount; }); }, "image/jpeg", 0.8);
  }, FPS_MS);
}

function handleLive(data) {
  const isFall = data.label === "fall";

  // Badge
  resultBadge.className = "result-badge " + (isFall ? "fall" : "safe");
  badgeIcon.textContent = isFall ? "⚠️" : "✅";
  badgeText.textContent = isFall ? "FALL" : "SAFE";

  // Conf pill
  pillConf.textContent = data.confidence + "%";

  // Stats
  statStatus.textContent = isFall ? "FALL" : "Safe";
  statStatus.className   = "stat-big " + data.label;
  statConf.textContent   = data.confidence + "%";
  confBar.style.width    = data.confidence + "%";
  confBar.className      = "conf-bar " + data.label;

  if (isFall) {
    // Flash banner
    fallAlert.classList.remove("hidden");
    clearTimeout(alertTimeout);
    alertTimeout = setTimeout(() => fallAlert.classList.add("hidden"), 2000);
    // Count + log
    alertCount++;
    statAlerts.textContent = alertCount;
    addLog(data.confidence);
    beep();
  } else {
    fallAlert.classList.add("hidden");
  }
}

function addLog(conf) {
  const empty = logBody.querySelector(".log-empty");
  if (empty) empty.remove();
  const t = new Date().toLocaleTimeString();
  const el = document.createElement("div");
  el.className = "log-entry";
  el.innerHTML = `<span class="log-time">${t}</span><span class="log-msg">⚠️ Fall detected</span><span class="log-conf-val">${conf}%</span>`;
  logBody.prepend(el);
  const all = logBody.querySelectorAll(".log-entry");
  if (all.length > 20) all[all.length-1].remove();
}

btnClear.addEventListener("click", () => {
  logBody.innerHTML = '<p class="log-empty">No alerts recorded</p>';
  alertCount = 0; statAlerts.textContent = "0";
});

function setNavLive(live) {
  liveDot.className  = "live-dot" + (live ? " active" : "");
  navStatus.textContent = live ? "Live" : "Offline";
  navBadge.className = "nav-badge" + (live ? " live" : "");
}

function beep() {
  try {
    const a = new (window.AudioContext || window.webkitAudioContext)();
    const o = a.createOscillator(), g = a.createGain();
    o.connect(g); g.connect(a.destination);
    o.type = "sine"; o.frequency.value = 880;
    g.gain.setValueAtTime(0.3, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.4);
    o.start(); o.stop(a.currentTime + 0.4);
  } catch(e) {}
}

// ── Upload detection ──────────────────────────────────────
uploadZone.addEventListener("click",     () => fileInput.click());
uploadLink.addEventListener("click",     e  => { e.stopPropagation(); fileInput.click(); });
uploadZone.addEventListener("dragover",  e  => { e.preventDefault(); uploadZone.classList.add("dragover"); });
uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("dragover"));
uploadZone.addEventListener("drop", e => {
  e.preventDefault(); uploadZone.classList.remove("dragover");
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith("image/")) doUpload(f);
});
fileInput.addEventListener("change", e => { if (e.target.files[0]) doUpload(e.target.files[0]); });

function doUpload(file) {
  const reader = new FileReader();
  reader.onload = e => {
    uploadPreview.src = e.target.result;
    uploadIdle.classList.add("hidden");
    uploadPreview.classList.remove("hidden");
  };
  reader.readAsDataURL(file);

  uploadResult.classList.add("hidden");
  uploadLoading.classList.remove("hidden");

  const fd = new FormData();
  fd.append("file", file);
  fetch("/predict", { method: "POST", body: fd })
    .then(r => r.json())
    .then(showUploadResult)
    .catch(err => { uploadLoading.classList.add("hidden"); alert("Error: " + err.message); });
}

function showUploadResult(data) {
  uploadLoading.classList.add("hidden");
  if (data.error) { alert("Error: " + data.error); return; }

  const isFall = data.label === "fall";
  resultCard.className   = "result-card " + data.label;
  resultIcon.textContent = isFall ? "⚠️" : "✅";
  resultLabel.textContent= isFall ? "Fall Detected" : "No Fall Detected";
  resultLabel.className  = "result-label " + data.label;
  resultConfVal.textContent = data.confidence + "%";
  uploadConfBar.className   = "conf-bar " + data.label;
  setTimeout(() => { uploadConfBar.style.width = data.confidence + "%"; }, 100);

  uploadResult.classList.remove("hidden");
}

btnRetry.addEventListener("click", () => {
  uploadResult.classList.add("hidden");
  uploadIdle.classList.remove("hidden");
  uploadPreview.classList.add("hidden");
  uploadPreview.src = "";
  fileInput.value   = "";
  uploadConfBar.style.width = "0%";
});
