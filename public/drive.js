// public/drive.js — updated (use relative API endpoints)
const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");
if (!token || !user) location.href = "login.html";

document.getElementById("userDisplay").textContent = `${user.email || user.username || "User"} (${user.role})`;

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

let currentFolderId = null;

function isSubmitter() { return user.role === "submitter"; }
function isPreviewer() { return user.role === "previewer"; }

async function loadFolders() {
  const res = await fetch("/api/folders/list");
  const data = await res.json();
  els.folderList.innerHTML = "";
  els.folderActions.innerHTML = "";

  (data.folders || []).forEach(f => {
    const row = document.createElement("div");
    row.className = "folder-row" + (f.id === currentFolderId ? " active" : "");
    row.onclick = () => { currentFolderId = f.id; els.currentFolderLabel.textContent = f.name; loadFiles(); };

    const name = document.createElement("div");
    name.textContent = f.name;

    const actions = document.createElement("div");
    actions.className = "folder-actions";

    if (isSubmitter()) {
      const rn = document.createElement("button"); rn.className = "iconbtn"; rn.textContent = "✏️";
      rn.onclick = (e) => { e.stopPropagation(); renameFolder(f.id, f.name); };
      const del = document.createElement("button"); del.className = "iconbtn"; del.textContent = "🗑️";
      del.onclick = (e) => { e.stopPropagation(); deleteFolder(f.id, f.name); };
      actions.appendChild(rn); actions.appendChild(del);
    }

    row.appendChild(name); row.appendChild(actions); els.folderList.appendChild(row);
  });

  if (isSubmitter()) {
    const createBtn = document.createElement("button"); createBtn.className = "btn"; createBtn.textContent = "+ Folder";
    createBtn.onclick = async () => {
      const name = prompt("Folder name:");
      if (!name) return;
      await fetch("/api/folders/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folderName: name }) });
      await loadFolders();
    };
    els.folderActions.appendChild(createBtn);
  }
}

async function renameFolder(id, oldName) {
  const newName = prompt("New folder name:", oldName);
  if (!newName || newName === oldName) return;
  await fetch("/api/folders/rename", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, newName }) });
  await loadFolders();
  // if renamed folder was current, update label
  if (currentFolderId === id) els.currentFolderLabel.textContent = newName;
}

async function deleteFolder(id, name) {
  if (!confirm(`Delete folder "${name}" and all its files?`)) return;
  await fetch("/api/folders/delete", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  currentFolderId = null;
  els.currentFolderLabel.textContent = "—";
  els.tbody.innerHTML = "";
  await loadFolders();
}

// --- files ---
async function loadFiles() {
  if (!currentFolderId) return;
  const res = await fetch(`/api/list/${currentFolderId}`);
  const data = await res.json();
  els.tbody.innerHTML = "";
  (data.files || []).forEach(f => {
    const tr = document.createElement("tr");
    let actions = "";
    if (isSubmitter()) {
      actions = `<button class="btn" onclick="previewFile('${f.url}','${f.mime}')">Preview</button>
                 <button class="btn danger" onclick="deleteFile('${f.id}')">Delete</button>
                 <a class="btn" href="${f.url}" download>Download</a>`;
    } else if (isPreviewer()) {
      actions = `<button class="btn" onclick="previewFile('${f.url}','${f.mime}')">Preview</button>
                 <a class="btn" href="${f.url}" download>Download</a>`;
    }
    tr.innerHTML = `<td>${f.name}</td><td>${f.mime}</td><td>${actions}</td>`;
    els.tbody.appendChild(tr);
  });
}

window.previewFile = (url, mime) => {
  if (!url) return alert("No preview url");
  els.previewBox.className = "";
  if (mime && mime.startsWith("image/")) els.previewBox.innerHTML = `<img src="${url}" style="max-width:100%">`;
  else if (mime === "application/pdf") els.previewBox.innerHTML = `<iframe src="${url}" width="100%" height="600"></iframe>`;
  else if (mime && mime.startsWith("text/")) fetch(url).then(r=>r.text()).then(t=>els.previewBox.innerHTML=`<pre>${t}</pre>`);
  else els.previewBox.innerHTML = `<div class="emptyPreview">No inline preview. <a class="btn" href="${url}" download>Download</a></div>`;
};

window.deleteFile = async (fileId) => {
  if (!confirm("Delete file?")) return;
  await fetch(`/api/delete/${currentFolderId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId }) });
  await loadFiles();
};

// upload
els.uploadBtn?.addEventListener("click", () => {
  if (!isSubmitter()) return alert("Only submitters can upload");
  if (!currentFolderId) return alert("Select a folder first");
  els.fileInput.click();
});

els.fileInput?.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length || !currentFolderId) return;
  for (const file of files) {
    // add row with progress
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${file.name}</td><td>${file.type}</td><td><progress value="0" max="100"></progress></td>`;
    els.tbody.appendChild(tr);
    const p = tr.querySelector("progress");
    await uploadFile(file, p);
  }
  await loadFiles();
  e.target.value = "";
});

async function uploadFile(file, progressEl) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/upload/${currentFolderId}`);
    const form = new FormData();
    form.append("file", file);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && progressEl) progressEl.value = (e.loaded / e.total) * 100;
    };

    xhr.onload = () => {
      if (xhr.status === 200) resolve();
      else reject(xhr.responseText || xhr.status);
    };
    xhr.onerror = () => reject("Upload network error");
    xhr.send(form);
  });
}

// Delete all files in current folder (submitter only)
els.deleteAllBtn?.addEventListener("click", async () => {
  if (!isSubmitter()) return alert("Only submitter");
  if (!currentFolderId) return alert("Select a folder first");
  if (!confirm("Delete ALL files in this folder?")) return;
  // fetch files, delete them one by one
  const res = await fetch(`/api/list/${currentFolderId}`);
  const data = await res.json();
  for (const f of data.files || []) {
    await fetch(`/api/delete/${currentFolderId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId: f.id }),
    });
  }
  loadFiles();
});

// init
loadFolders();
