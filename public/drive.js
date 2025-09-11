// drive.js — role-aware, icon buttons restored

const user = JSON.parse(localStorage.getItem("user") || "{}");
const token = localStorage.getItem("token") || "";

const els = {
  userDisplay: document.getElementById("userDisplay"),
  folderList: document.getElementById("folderList"),
  folderActions: document.getElementById("folderActions"),
  currentFolderLabel: document.getElementById("currentFolderLabel"),
  tbody: document.querySelector("#fileTable tbody"),
  previewBox: document.getElementById("previewBox"),
  uploadBtn: document.getElementById("uploadBtn"),
  deleteAllBtn: document.getElementById("deleteAllBtn"),
  fileInput: document.getElementById("fileInput"),
};

els.userDisplay.textContent = `${user.email || "Unknown"} (${user.role})`;

let currentFolder = "";

/* ---------- Helpers ---------- */
function isSubmitter() {
  return user.role === "submitter";
}
function isPreviewer() {
  return user.role === "previewer";
}
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  location.href = "login.html";
}
window.logout = logout;

/* ---------- Folder UI ---------- */
async function loadFolders() {
  const res = await fetch("/api/folders/list");
  const data = await res.json();
  els.folderList.innerHTML = "";

  data.folders.forEach((f) => {
    const row = document.createElement("div");
    row.className = "folder-row" + (f.name === currentFolder ? " active" : "");
    row.onclick = () => {
      currentFolder = f.name;
      els.currentFolderLabel.textContent = currentFolder;
      fetchFiles();
      els.previewBox.textContent = "Select a file to preview";
      els.previewBox.className = "emptyPreview";
    };

    const name = document.createElement("div");
    name.textContent = f.name;

    const actions = document.createElement("div");
    actions.className = "folder-actions";

    if (isSubmitter()) {
      const renameBtn = document.createElement("button");
      renameBtn.className = "iconbtn";
      renameBtn.textContent = "✏️";
      renameBtn.onclick = (e) => {
        e.stopPropagation();
        renameFolder(f.name);
      };
      actions.appendChild(renameBtn);

      const delBtn = document.createElement("button");
      delBtn.className = "iconbtn";
      delBtn.textContent = "🗑️";
      delBtn.onclick = (e) => {
        e.stopPropagation();
        deleteFolder(f.name);
      };
      actions.appendChild(delBtn);
    }

    row.appendChild(name);
    row.appendChild(actions);
    els.folderList.appendChild(row);
  });

  // Submitter-only "+ Folder" button
  els.folderActions.innerHTML = isSubmitter()
    ? `<button class="btn" onclick="addFolder()">+ Folder</button>`
    : "";
}

window.addFolder = async function () {
  const name = prompt("Folder name?");
  if (!name) return;
  await fetch("/api/folders/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folderName: name }),
  });
  loadFolders();
};

async function renameFolder(oldName) {
  const newName = prompt("Rename folder:", oldName);
  if (!newName || newName === oldName) return;
  await fetch("/api/folders/rename", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ oldName, newName }),
  });
  if (currentFolder === oldName) currentFolder = newName;
  loadFolders();
}

async function deleteFolder(name) {
  if (!confirm(`Delete folder "${name}"?`)) return;
  await fetch("/api/folders/delete", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folderName: name }),
  });
  if (currentFolder === name) currentFolder = "";
  loadFolders();
  els.tbody.innerHTML = "";
}

/* ---------- File listing & preview ---------- */
async function fetchFiles() {
  if (!currentFolder) return;
  const res = await fetch(`/api/list/${currentFolder}`);
  const data = await res.json();
  els.tbody.innerHTML = "";

  data.files.forEach((f, i) => {
    const tr = document.createElement("tr");
    let actionBtns = "";

    if (isSubmitter()) {
      actionBtns = `
        <button class="btn" onclick="previewFile('${f.url}','${f.type}')">Preview</button>
        <button class="btn danger" onclick="deleteFile('${f.path}')">Delete</button>
        <a class="btn" href="${f.url}" download>Download</a>`;
    } else if (isPreviewer()) {
      actionBtns = `
        <button class="btn" onclick="previewFile('${f.url}','${f.type}')">Preview</button>
        <a class="btn" href="${f.url}" download>Download</a>`;
    }

    tr.innerHTML = `
      <td>${f.name}</td>
      <td>${f.type}</td>
      <td>${actionBtns}</td>`;
    els.tbody.appendChild(tr);
  });
}

window.previewFile = function (url, type) {
  els.previewBox.className = "";
  if (type.startsWith("image/")) {
    els.previewBox.innerHTML = `<img src="${url}" style="max-width:100%">`;
  } else if (type === "application/pdf") {
    els.previewBox.innerHTML = `<iframe src="${url}" width="100%" height="600"></iframe>`;
  } else if (type.startsWith("text/")) {
    fetch(url)
      .then((r) => r.text())
      .then((txt) => (els.previewBox.innerHTML = `<pre>${txt}</pre>`));
  } else {
    els.previewBox.innerHTML = `<p>No inline preview. <a href="${url}" download>Download</a></p>`;
  }
};

window.deleteFile = async function (path) {
  if (!confirm(`Delete ${path}?`)) return;
  await fetch(`/api/delete/${currentFolder}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filePath: path }),
  });
  fetchFiles();
};

/* ---------- Upload with progress ---------- */
els.uploadBtn?.addEventListener("click", () => {
  if (!isSubmitter()) return alert("Submitter only");
  if (!currentFolder) return alert("Select a folder first");
  els.fileInput.click();
});

els.fileInput?.addEventListener("change", async (e) => {
  const files = e.target.files;
  if (!files.length || !currentFolder) return;
  for (const file of files) {
    await uploadFile(file);
  }
  fetchFiles();
  e.target.value = "";
});

async function uploadFile(file) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/upload/${currentFolder}`);
    const formData = new FormData();
    formData.append("file", file);

    // Optional progress row
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${file.name}</td><td>${file.type}</td>
      <td><progress value="0" max="100"></progress></td>`;
    els.tbody.appendChild(tr);
    const progressEl = tr.querySelector("progress");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) progressEl.value = (e.loaded / e.total) * 100;
    };
    xhr.onload = () => (xhr.status === 200 ? resolve() : reject(xhr.status));
    xhr.onerror = reject;
    xhr.send(formData);
  });
}

/* ---------- Init ---------- */
loadFolders();
