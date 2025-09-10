/* drive_previewer.js */

const API = "/api"; // Calls the Vercel serverless functions

const token = localStorage.getItem("token");
let user = null;
try {
  user = JSON.parse(localStorage.getItem("user"));
} catch {}
if (!user || !token || user.role !== "previewer") {
  location.href = "login.html";
}

document.getElementById("userDisplay").textContent = `${user.username} (${user.role})`;

let driveState = { folders: [] };
let currentFolderIndex = 0;

const els = {
  folderList: document.getElementById("folderList"),
  currentFolderLabel: document.getElementById("currentFolderLabel"),
  tbody: document.querySelector("#fileTable tbody"),
  previewBox: document.getElementById("previewBox"),
};

function logout() {
  localStorage.removeItem("user");
  localStorage.removeItem("token");
  location.href = "login.html";
}

async function fetchState() {
  const res = await fetch(API + "/state", {
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) {
    logout();
    return;
  }
  driveState = await res.json();
  if (!driveState.folders || !driveState.folders.length) {
    driveState.folders = [{ id: "1", name: "Folder 1", files: [] }];
  }
  if (currentFolderIndex >= driveState.folders.length) currentFolderIndex = 0;
  renderAll();
}

function renderFolders() {
  els.folderList.innerHTML = "";
  driveState.folders.forEach((f, idx) => {
    const row = document.createElement("div");
    row.className = "folder-row" + (idx === currentFolderIndex ? " active" : "");
    row.onclick = () => { currentFolderIndex = idx; renderAll(); };
    row.textContent = f.name;
    els.folderList.appendChild(row);
  });
  els.currentFolderLabel.textContent = driveState.folders[currentFolderIndex]?.name || "—";
}

function renderFiles() {
  els.tbody.innerHTML = "";
  const files = driveState.folders[currentFolderIndex]?.files || [];
  files.forEach((f, i) => {
    const ext = (f.name || "").split(".").pop().toLowerCase();
    const isPDF = f.type.includes("pdf") || /\.pdf$/i.test(f.name);
    const actions = isPDF
      ? `<button class="btn secondary" onclick="previewFile(${i})">Preview</button>
         <button class="btn" onclick="downloadFile(${i})">Download</button>`
      : `<span class="muted">No access</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${f.name}</td><td>${actions}</td>`;
    els.tbody.appendChild(tr);
  });
}

function previewFile(i) {
  const file = driveState.folders[currentFolderIndex]?.files[i];
  if (!file) return;
  const isPDF = file.type.includes("pdf") || /\.pdf$/i.test(file.name);
  if (!isPDF) {
    els.previewBox.textContent = "Previewer can only view PDFs.";
    els.previewBox.className = "emptyPreview";
    return;
  }
  els.previewBox.innerHTML = `<iframe src="${file.url}"></iframe>`;
  els.previewBox.className = "";
}

function downloadFile(i) {
  const file = driveState.folders[currentFolderIndex]?.files[i];
  if (file) window.open(file.url, "_blank");
}

function renderAll() {
  renderFolders();
  renderFiles();
  els.previewBox.textContent = "Select a PDF to preview";
  els.previewBox.className = "emptyPreview";
}

// expose logout globally (used by header button)
window.logout = logout;

// initial
fetchState();
