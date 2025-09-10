/* drive_submitter.js */

const API = "/api"; // Calls the Vercel serverless functions


// --- auth & user ---
const token = localStorage.getItem("token");
let user = null;
try {
  user = JSON.parse(localStorage.getItem("user"));
} catch {}
if (!user || !token || user.role !== "submitter") {
  // if not a submitter, send back to login (or the previewer page if you prefer)
  location.href = "login.html";
}

document.getElementById("userDisplay").textContent = `${user.username} (${user.role})`;

// --- state ---
let driveState = { folders: [] };
let currentFolderIndex = 0;

const els = {
  folderList: document.getElementById("folderList"),
  folderActions: document.getElementById("folderActions"),
  currentFolderLabel: document.getElementById("currentFolderLabel"),
  tbody: document.querySelector("#fileTable tbody"),
  previewBox: document.getElementById("previewBox"),
  uploadBtn: document.getElementById("uploadBtn"),
  deleteAllBtn: document.getElementById("deleteAllBtn"),
  fileInput: document.getElementById("fileInput"),
  resetBtnWrapper: document.getElementById("resetBtnWrapper"),
};

// --- helpers ---
function isSubmitter() { return user?.role === "submitter"; }

function logout() {
  localStorage.removeItem("user");
  localStorage.removeItem("token");
  location.href = "login.html";
}

// --- API calls ---
async function fetchState() {
  const res = await fetch(API + "/state", {
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) {
    logout();
    return;
  }
  driveState = await res.json();
  // ensure at least one folder exists
  if (!driveState.folders || !driveState.folders.length) {
    driveState.folders = [
      { id: "1", name: "Folder 1", files: [] },
      { id: "2", name: "Folder 2", files: [] },
    ];
  }
  if (currentFolderIndex >= driveState.folders.length) currentFolderIndex = 0;
  renderAll();
}

async function saveState() {
  await fetch(API + "/state", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify(driveState),
  });
}

async function resetState() {
  if (!confirm("Reset drive for ALL users?")) return;
  await fetch(API + "/reset", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
  });
  fetchState();
}

// --- render & folder ops ---
function renderFolders() {
  els.folderList.innerHTML = "";
  driveState.folders.forEach((f, idx) => {
    const row = document.createElement("div");
    row.className = "folder-row" + (idx === currentFolderIndex ? " active" : "");
    row.onclick = () => {
      currentFolderIndex = idx;
      renderAll();
      els.previewBox.textContent = "Select a file to preview";
      els.previewBox.className = "emptyPreview";
    };

    const name = document.createElement("div");
    name.textContent = f.name;

    const actions = document.createElement("div");
    actions.className = "folder-actions";

    if (isSubmitter()) {
      const rn = document.createElement("button");
      rn.className = "iconbtn";
      rn.textContent = "✏️";
      rn.onclick = (e) => { e.stopPropagation(); renameFolder(idx); };
      actions.appendChild(rn);

      const del = document.createElement("button");
      del.className = "iconbtn";
      del.textContent = "🗑️";
      del.onclick = (e) => { e.stopPropagation(); deleteFolderAt(idx); };
      actions.appendChild(del);
    }

    row.appendChild(name);
    row.appendChild(actions);
    els.folderList.appendChild(row);
  });

  els.currentFolderLabel.textContent = driveState.folders[currentFolderIndex]?.name || "—";

  if (isSubmitter()) {
    els.folderActions.innerHTML = `<button class="btn" onclick="addFolder()">+ Folder</button>`;
  } else {
    els.folderActions.innerHTML = "";
  }
}

function addFolder() {
  const name = prompt("Enter folder name:");
  if (!name) return;
  driveState.folders.push({ id: Date.now().toString(), name, files: [] });
  currentFolderIndex = driveState.folders.length - 1;
  saveState();
  renderFolders();
}

function renameFolder(idx) {
  const curr = driveState.folders[idx];
  const name = prompt("Rename folder:", curr.name);
  if (!name) return;
  curr.name = name;
  saveState();
  renderFolders();
}

function deleteFolderAt(idx) {
  if (driveState.folders.length === 1) { alert("At least one folder must remain."); return; }
  if (!confirm("Delete this folder?")) return;
  driveState.folders.splice(idx, 1);
  if (currentFolderIndex >= driveState.folders.length) currentFolderIndex = driveState.folders.length - 1;
  saveState();
  renderFolders();
  renderFiles();
}

function getCurrentFiles() {
  return driveState.folders[currentFolderIndex]?.files || [];
}

function renderFiles() {
  els.tbody.innerHTML = "";
  const files = getCurrentFiles();
  files.forEach((f, i) => {
    const typeKey = fileTypeKey(f);
    const badge = badgeFor(typeKey);
    const tr = document.createElement("tr");

    const actions = `
      <button class="btn secondary" onclick="previewFile(${i})">Preview</button>
      <button class="btn danger" onclick="deleteFile(${i})">Delete</button>
      <button class="btn" onclick="downloadFile(${i})">Download</button>
    `;

    tr.innerHTML = `
      <td><span class="file-badge ${badge.cls}">${badge.label}</span>${f.name}</td>
      <td>${typeKey.toUpperCase()}</td>
      <td>${actions}</td>
    `;
    els.tbody.appendChild(tr);
  });
}

// --- file ops ---
function deleteFile(i) {
  if (!confirm("Delete this file?")) return;
  getCurrentFiles().splice(i, 1);
  saveState();
  renderFiles();
}

els.uploadBtn.onclick = () => {
  if (!isSubmitter()) { alert("No permission"); return; }
  els.fileInput.click();
};

els.fileInput.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  const folder = driveState.folders[currentFolderIndex];
  for (const f of files) {
    const res = await fetch(`${API}/upload/${folder.id}`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": f.type,
        "x-filename": f.name,
      },
      body: await f.arrayBuffer(),
    });
    const data = await res.json();
    // server returns the updated file list
    folder.files = data.files;
  }
  saveState();
  renderFiles();
  e.target.value = "";
});

function downloadFile(i) {
  const file = getCurrentFiles()[i];
  if (file) window.open(file.url, "_blank");
}

function previewFile(i) {
  const file = getCurrentFiles()[i];
  if (!file) return;
  const isPDF = file.type.includes("pdf") || /\.pdf$/i.test(file.name);
  const isImg = file.type.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(file.name);

  if (!isPDF && !isImg) {
    els.previewBox.innerHTML = `
      <div class="emptyPreview">
        Preview not supported for <strong>${file.name}</strong>.<br/>
        Please <a class="btn" href="${file.url}" target="_blank">Download</a>
      </div>`;
    els.previewBox.className = "";
    return;
  }

  if (isPDF) {
    els.previewBox.innerHTML = `<iframe src="${file.url}"></iframe>`;
    els.previewBox.className = "";
  } else if (isImg) {
    els.previewBox.innerHTML = `<img src="${file.url}" alt="${file.name}">`;
    els.previewBox.className = "";
  }
}

els.deleteAllBtn.onclick = () => {
  if (!isSubmitter()) return;
  if (!confirm("Delete all files in this folder?")) return;
  getCurrentFiles().splice(0);
  saveState();
  renderFiles();
};

// --- util ---
function fileTypeKey(f) {
  const ext = (f.name || "").split(".").pop().toLowerCase();
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "img";
  if (["doc", "docx"].includes(ext)) return "doc";
  if (["xls", "xlsx", "csv"].includes(ext)) return "xls";
  if (["ppt", "pptx"].includes(ext)) return "ppt";
  if (["txt", "md", "log"].includes(ext)) return "txt";
  if (["zip", "rar", "7z"].includes(ext)) return "zip";
  return "oth";
}

function badgeFor(typeKey) {
  const map = {
    pdf: { cls: "b-pdf", label: "PDF" },
    img: { cls: "b-img", label: "IMG" },
    doc: { cls: "b-doc", label: "DOC" },
    xls: { cls: "b-xls", label: "XLS" },
    ppt: { cls: "b-ppt", label: "PPT" },
    txt: { cls: "b-txt", label: "TXT" },
    zip: { cls: "b-zip", label: "ZIP" },
    oth: { cls: "b-oth", label: "FILE" },
  };
  return map[typeKey] || map.oth;
}

function renderAll() {
  renderFolders();
  renderFiles();
  els.previewBox.textContent = "Select a file to preview";
  els.previewBox.className = "emptyPreview";
  els.resetBtnWrapper.innerHTML = isSubmitter()
    ? ' | <button class="btn danger" onclick="resetState()">Reset Drive Data</button>'
    : "";
}

// initial load
fetchState();

