// public/drive.js
const API = "/api"; // serverless endpoints on Vercel
const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");

if (!user || !token) {
  location.href = "login.html";
}

document.getElementById("userDisplay") && (document.getElementById("userDisplay").textContent = `${user.email || user.username || user.username} (${user.role})`);

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

let driveState = { folders: [] };
let currentFolderIndex = 0;

function isSubmitter() { return user.role === "submitter"; }
function isPreviewer() { return user.role === "previewer"; }

async function fetchState() {
  const res = await fetch(`${API}/state`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return logout();
  driveState = await res.json();
  renderAll();
}

// minimal upload: sends metadata to /api/upload and expects updated files array
async function uploadFileWithProgress(file, folderId, progressCb) {
  // For demo: we POST metadata with a placeholder URL; in real app you'll upload to Supabase Storage
  // but to show progress bar we simulate progress (since we're not uploading bytes here).
  return new Promise((resolve) => {
    let percent = 0;
    const interval = setInterval(() => {
      percent += Math.floor(Math.random() * 20) + 10;
      if (percent >= 100) percent = 100;
      progressCb(percent);
      if (percent === 100) {
        clearInterval(interval);
        // post metadata to /api/upload to add file to state
        fetch(`${API}/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            folderId,
            name: file.name,
            type: file.type,
            url: `/uploads/${Date.now()}-${file.name}`,
          }),
        })
          .then((r) => r.json())
          .then((data) => resolve(data.files))
          .catch(() => resolve(null));
      }
    }, 300);
  });
}

els.uploadBtn && els.uploadBtn.addEventListener("click", () => {
  if (!isSubmitter()) return alert("No permission");
  els.fileInput && els.fileInput.click();
});

els.fileInput && els.fileInput.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  const folder = driveState.folders[currentFolderIndex];

  const progressContainer = document.createElement("div");
  els.previewBox.innerHTML = "";
  els.previewBox.appendChild(progressContainer);

  for (const f of files) {
    const row = document.createElement("div");
    row.textContent = f.name;
    row.style.marginBottom = "8px";

    const wrapper = document.createElement("div");
    wrapper.style.background = "#ccc";
    wrapper.style.borderRadius = "4px";
    wrapper.style.height = "12px";
    wrapper.style.marginTop = "6px";

    const bar = document.createElement("div");
    bar.style.width = "0%";
    bar.style.height = "100%";
    bar.style.background = "#02807b";
    bar.style.borderRadius = "4px";
    wrapper.appendChild(bar);

    row.appendChild(wrapper);
    progressContainer.appendChild(row);

    try {
      const uploadedFiles = await uploadFileWithProgress(f, folder.id, (pct) => {
        bar.style.width = pct + "%";
      });
      if (uploadedFiles) folder.files = uploadedFiles;
    } catch (err) {
      const errEl = document.createElement("div");
      errEl.style.color = "red";
      errEl.textContent = "Upload failed";
      row.appendChild(errEl);
    }
  }

  saveState();
  renderFiles();
  els.previewBox.innerHTML = "Select a file to preview";
  e.target.value = "";
});

async function saveState() {
  await fetch(`${API}/state`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(driveState),
  });
}

function renderFolders() {
  if (!els.folderList) return;
  els.folderList.innerHTML = "";
  driveState.folders.forEach((f, idx) => {
    const row = document.createElement("div");
    row.className = "folder-row" + (idx === currentFolderIndex ? " active" : "");
    row.onclick = () => { currentFolderIndex = idx; renderAll(); };
    const name = document.createElement("div"); name.textContent = f.name;

    const actions = document.createElement("div");
    actions.className = "folder-actions";
    if (isSubmitter()) {
      const rn = document.createElement("button"); rn.className = "iconbtn"; rn.textContent = "✏️";
      rn.onclick = (e) => { e.stopPropagation(); renameFolder(idx); };
      const del = document.createElement("button"); del.className = "iconbtn"; del.textContent = "🗑️";
      del.onclick = (e) => { e.stopPropagation(); deleteFolderAt(idx); };
      actions.appendChild(rn); actions.appendChild(del);
    }

    row.appendChild(name); row.appendChild(actions); els.folderList.appendChild(row);
  });

  if (els.currentFolderLabel) els.currentFolderLabel.textContent = driveState.folders[currentFolderIndex]?.name || "—";
  if (els.folderActions) els.folderActions.innerHTML = isSubmitter() ? '<button class="btn" onclick="addFolder()">+ Folder</button>' : "";
}

function addFolder() {
  const name = prompt("Enter folder name:");
  if (!name) return;
  driveState.folders.push({ id: Date.now().toString(), name, files: [] });
  currentFolderIndex = driveState.folders.length - 1;
  saveState(); renderFolders();
}

function renameFolder(idx) {
  const curr = driveState.folders[idx];
  const name = prompt("Rename folder:", curr.name);
  if (!name) return;
  curr.name = name;
  saveState(); renderFolders();
}

function deleteFolderAt(idx) {
  if (driveState.folders.length === 1) { alert("At least one folder must remain."); return; }
  if (!confirm("Delete this folder?")) return;
  driveState.folders.splice(idx, 1);
  if (currentFolderIndex >= driveState.folders.length) currentFolderIndex = driveState.folders.length - 1;
  saveState(); renderFolders(); renderFiles();
}

function getCurrentFiles() { return driveState.folders[currentFolderIndex]?.files || []; }

function renderFiles() {
  if (!els.tbody) return;
  els.tbody.innerHTML = "";
  getCurrentFiles().forEach((f, i) => {
    const typeKey = fileTypeKey(f);
    const badge = badgeFor(typeKey);

    let actions = "";
    if (isSubmitter()) {
      actions = `<button class="btn secondary" onclick="previewFile(${i})">Preview</button>
                 <button class="btn danger" onclick="deleteFile(${i})">Delete</button>
                 <button class="btn" onclick="downloadFile(${i})">Download</button>`;
    } else if (isPreviewer()) {
      actions = `<button class="btn secondary" onclick="previewFile(${i})">Preview</button>
                 <button class="btn" onclick="downloadFile(${i})">Download</button>`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `<td><span class="file-badge ${badge.cls}">${badge.label}</span>${f.name}</td>
                    <td>${typeKey.toUpperCase()}</td>
                    <td>${actions}</td>`;
    els.tbody.appendChild(tr);
  });
}

function deleteFile(i) { if (!confirm("Delete this file?")) return; getCurrentFiles().splice(i, 1); saveState(); renderFiles(); }

function downloadFile(i) { const file = getCurrentFiles()[i]; if (file) window.open(file.url, "_blank"); }

function previewFile(i) {
  const file = getCurrentFiles()[i];
  if (!file) return;
  const isPDF = file.type?.includes("pdf") || /\.pdf$/i.test(file.name);
  const isImg = file.type?.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name);

  if (isPreviewer() && !isPDF && !isImg) {
    els.previewBox.innerHTML = `<div class="emptyPreview">
      Preview not supported for <strong>${file.name}</strong>.<br/>
      <a class="btn" href="${file.url}" target="_blank">Download</a>
    </div>`;
    return;
  }

  if (isPDF) els.previewBox.innerHTML = `<iframe src="${file.url}"></iframe>`;
  else if (isImg) els.previewBox.innerHTML = `<img src="${file.url}" alt="${file.name}">`;
  else els.previewBox.innerHTML = `<div class="emptyPreview">Preview not supported for <strong>${file.name}</strong>.<br/><a class="btn" href="${file.url}" target="_blank">Download</a></div>`;

  els.previewBox.className = "";
}

function fileTypeKey(f) {
  const ext = (f.name || "").split(".").pop().toLowerCase();
  if (!ext) return "oth";
  if (ext === "pdf") return "pdf";
  if (["png","jpg","jpeg","gif","webp","svg"].includes(ext)) return "img";
  if (["doc","docx"].includes(ext)) return "doc";
  if (["xls","xlsx","csv"].includes(ext)) return "xls";
  if (["ppt","pptx"].includes(ext)) return "ppt";
  if (["txt","md","log"].includes(ext)) return "txt";
  if (["zip","rar","7z"].includes(ext)) return "zip";
  return "oth";
}

function badgeFor(typeKey) {
  const map = { pdf:{cls:"b-pdf",label:"PDF"}, img:{cls:"b-img",label:"IMG"}, doc:{cls:"b-doc",label:"DOC"}, xls:{cls:"b-xls",label:"XLS"}, ppt:{cls:"b-ppt",label:"PPT"}, txt:{cls:"b-txt",label:"TXT"}, zip:{cls:"b-zip",label:"ZIP"}, oth:{cls:"b-oth",label:"FILE"}};
  return map[typeKey] || map.oth;
}

function logout() { localStorage.removeItem("user"); localStorage.removeItem("token"); location.href = "login.html"; }

function renderAll() { renderFolders(); renderFiles(); els.previewBox && (els.previewBox.textContent = "Select a file to preview"); els.resetBtnWrapper && (els.resetBtnWrapper.innerHTML = isSubmitter()?'<button class="btn danger" onclick="resetState()">Reset Drive Data</button>':''); }

async function resetState() {
  if (!confirm("Reset drive for ALL users?")) return;
  await fetch(`${API}/state`, { method: "POST", headers: { Authorization:`Bearer ${token}`, "Content-Type":"application/json" }, body: JSON.stringify({ folders: [{ id:"1", name:"Folder 1", files:[] }] }) });
  fetchState();
}

// expose some functions globally for inline handlers used in markup
window.addFolder = addFolder;
window.renameFolder = renameFolder;
window.deleteFolderAt = deleteFolderAt;
window.previewFile = previewFile;
window.deleteFile = deleteFile;
window.downloadFile = downloadFile;
window.resetState = resetState;
window.logout = logout;

// initial fetch
fetchState();
