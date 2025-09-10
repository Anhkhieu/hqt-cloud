const API = "http://localhost:3000/api"; // replace with Vercel API when deployed
const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");

if (!user || !token) location.href = "login.html";

document.getElementById("userDisplay").textContent = `${user.username} (${user.role})`;

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
  const res = await fetch(API + "/state", { headers: { Authorization: "Bearer " + token } });
  if (!res.ok) return logout();
  driveState = await res.json();
  renderAll();
}

// ---------- Upload with progress ----------
function uploadFileWithProgress(file, folderId, progressCallback) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}/upload/${folderId}`);
    xhr.setRequestHeader("Authorization", "Bearer " + token);
    xhr.setRequestHeader("x-filename", file.name);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && progressCallback) {
        progressCallback(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        resolve(data.files);
      } else reject(`Upload failed: ${xhr.status}`);
    };

    xhr.onerror = () => reject("Upload error");
    xhr.send(file);
  });
}

els.uploadBtn?.addEventListener("click", () => {
  if (!isSubmitter()) return alert("No permission");
  els.fileInput.click();
});

els.fileInput?.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  const folder = driveState.folders[currentFolderIndex];
  const progressContainer = document.createElement("div");
  els.previewBox.innerHTML = "";
  els.previewBox.appendChild(progressContainer);

  for (const file of files) {
    const fileRow = document.createElement("div");
    fileRow.textContent = file.name;
    fileRow.style.marginBottom = "8px";

    const wrapper = document.createElement("div");
    wrapper.style.background = "#ccc";
    wrapper.style.borderRadius = "4px";
    wrapper.style.height = "16px";
    wrapper.style.marginTop = "2px";

    const bar = document.createElement("div");
    bar.style.width = "0%";
    bar.style.height = "100%";
    bar.style.background = "#02807b";
    bar.style.borderRadius = "4px";
    wrapper.appendChild(bar);

    fileRow.appendChild(wrapper);
    progressContainer.appendChild(fileRow);

    try {
      const uploadedFiles = await uploadFileWithProgress(file, folder.id, (percent) => {
        bar.style.width = percent + "%";
      });
      folder.files = uploadedFiles;
    } catch (err) {
      const errMsg = document.createElement("div");
      errMsg.textContent = "Upload failed";
      errMsg.style.color = "red";
      fileRow.appendChild(errMsg);
      console.error(err);
    }
  }

  saveState();
  renderFiles();
  els.previewBox.innerHTML = "Select a file to preview";
  e.target.value = "";
});

async function saveState() {
  await fetch(API + "/state", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify(driveState),
  });
}

async function resetState() {
  if (!confirm("Reset drive for ALL users?")) return;
  await fetch(API + "/reset", { method: "POST", headers: { Authorization: "Bearer " + token } });
  fetchState();
}

// ---------- Folder functions ----------
function renderFolders() {
  els.folderList.innerHTML = "";
  driveState.folders.forEach((f, idx) => {
    const row = document.createElement("div");
    row.className = "folder-row" + (idx === currentFolderIndex ? " active" : "");
    row.onclick = () => { currentFolderIndex = idx; renderAll(); };
    const name = document.createElement("div");
    name.textContent = f.name;

    const actions = document.createElement("div");
    actions.className = "folder-actions";

    if (isSubmitter()) {
      const rn = document.createElement("button");
      rn.className = "iconbtn"; rn.textContent = "✏️"; rn.onclick = (e) => { e.stopPropagation(); renameFolder(idx); };
      const del = document.createElement("button");
      del.className = "iconbtn"; del.textContent = "🗑️"; del.onclick = (e) => { e.stopPropagation(); deleteFolderAt(idx); };
      actions.appendChild(rn); actions.appendChild(del);
    }

    row.appendChild(name); row.appendChild(actions); els.folderList.appendChild(row);
  });

  els.currentFolderLabel.textContent = driveState.folders[currentFolderIndex]?.name || "—";

  if (isSubmitter()) {
    els.folderActions.innerHTML = `<button class="btn" onclick="addFolder()">+ Folder</button>`;
  }
}

function addFolder() {
  const name = prompt("Enter folder name:"); if (!name) return;
  driveState.folders.push({ id: Date.now().toString(), name, files: [] });
  currentFolderIndex = driveState.folders.length - 1;
  saveState(); renderFolders();
}

function renameFolder(idx) {
  const curr = driveState.folders[idx];
  const name = prompt("Rename folder:", curr.name); if (!name) return;
  curr.name = name; saveState(); renderFolders();
}

function deleteFolderAt(idx) {
  if (driveState.folders.length === 1) return alert("At least one folder must remain.");
  if (!confirm("Delete this folder?")) return;
  driveState.folders.splice(idx, 1);
  if (currentFolderIndex >= driveState.folders.length) currentFolderIndex = driveState.folders.length - 1;
  saveState(); renderFolders(); renderFiles();
}

function getCurrentFiles() { return driveState.folders[currentFolderIndex]?.files || []; }

// ---------- Files ----------
function renderFiles() {
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

function downloadFile(i) { const file = getCurrentFiles()[i]; window.open(file.url, "_blank"); }

function previewFile(i) {
  const file = getCurrentFiles()[i]; if (!file) return;
  const isPDF = file.type.includes("pdf") || /\.pdf$/i.test(file.name);
  const isImg = file.type.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(file.name);

  if (isPreviewer() && !isPDF && !isImg) {
    els.previewBox.innerHTML = `<div class="emptyPreview">
      Preview not supported for <strong>${file.name}</strong>.<br/>
      <a class="btn" href="${file.url}" target="_blank">Download</a>
    </div>`;
    return;
  }

  if (isPDF) els.previewBox.innerHTML = `<iframe src="${file.url}"></iframe>`;
  else if (isImg) els.previewBox.innerHTML = `<img src="${file.url}" alt="${file.name}">`;
  else els.previewBox.innerHTML = `<div class="emptyPreview">
    Preview not supported for <strong>${file.name}</strong>.<br/>
    <a class="btn" href="${file.url}" target="_blank">Download</a>
  </div>`;
}

els.deleteAllBtn?.addEventListener("click", () => {
  if (!isSubmitter()) return;
  if (!confirm("Delete all files in this folder?")) return;
  getCurrentFiles().splice(0); saveState(); renderFiles();
});

function fileTypeKey(f) {
  const ext = f.name.split(".").pop().toLowerCase();
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
  const map = {
    pdf: { cls:"b-pdf", label:"PDF" },
    img: { cls:"b-img", label:"IMG" },
    doc: { cls:"b-doc", label:"DOC" },
    xls: { cls:"b-xls", label:"XLS" },
    ppt: { cls:"b-ppt", label:"PPT" },
    txt: { cls:"b-txt", label:"TXT" },
    zip: { cls:"b-zip", label:"ZIP" },
    oth: { cls:"b-oth", label:"FILE" }
  };
  return map[typeKey] || map.oth;
}

function logout() {
  localStorage.removeItem("user"); localStorage.removeItem("token"); location.href = "login.html";
}

function renderAll() {
  renderFolders(); renderFiles();
  els.resetBtnWrapper.innerHTML = isSubmitter() ? '<button class="btn danger" onclick="resetState()">Reset Drive Data</button>' : "";
}

fetchState();
