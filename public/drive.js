// drive.js — full updated version

const API = ""; // leave empty for relative calls on Vercel

// Show user info
const user = JSON.parse(localStorage.getItem("user") || "{}");
document.getElementById("userDisplay").textContent = user.email
  ? `${user.email} (${user.role})`
  : "Unknown";

let currentFolder = "";
const fileTableBody = document.querySelector("#fileTable tbody");
const previewBox = document.getElementById("previewBox");

document.getElementById("uploadBtn")?.addEventListener("click", () =>
  document.getElementById("fileInput").click()
);
document.getElementById("fileInput")?.addEventListener("change", handleUpload);

document.getElementById("deleteAllBtn")?.addEventListener("click", async () => {
  if (!currentFolder) return alert("Select a folder first.");
  if (!confirm("Delete ALL files in this folder?")) return;
  await fetch(`/api/delete/${currentFolder}`, { method: "DELETE" });
  fetchState();
});

// Logout
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  location.href = "login.html";
}

// ===== Folder handling =====
async function loadFolders() {
  const res = await fetch("/api/folders/list");
  const data = await res.json();
  const folderList = document.getElementById("folderList");
  const actions = document.getElementById("folderActions");
  folderList.innerHTML = "";
  actions.innerHTML = "";

  data.folders.forEach((f) => {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = f.name;
    btn.onclick = () => {
      currentFolder = f.name;
      document.getElementById("currentFolderLabel").textContent = currentFolder;
      fetchState();
    };
    folderList.appendChild(btn);
  });

  // Create folder
  const createBtn = document.createElement("button");
  createBtn.className = "btn";
  createBtn.textContent = "+ New Folder";
  createBtn.onclick = async () => {
    const name = prompt("Folder name?");
    if (!name) return;
    await fetch("/api/folders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderName: name }),
    });
    loadFolders();
  };
  actions.appendChild(createBtn);

  // Rename folder
  const renameBtn = document.createElement("button");
  renameBtn.className = "btn";
  renameBtn.textContent = "Rename Folder";
  renameBtn.onclick = async () => {
    if (!currentFolder) return alert("Select a folder first.");
    const newName = prompt("New folder name:", currentFolder);
    if (!newName || newName === currentFolder) return;
    await fetch("/api/folders/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldName: currentFolder, newName }),
    });
    currentFolder = newName;
    document.getElementById("currentFolderLabel").textContent = currentFolder;
    loadFolders();
  };
  actions.appendChild(renameBtn);

  // Delete folder
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn danger";
  deleteBtn.textContent = "Delete Folder";
  deleteBtn.onclick = async () => {
    if (!currentFolder) return alert("Select a folder first.");
    if (!confirm(`Delete folder "${currentFolder}"?`)) return;
    await fetch("/api/folders/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderName: currentFolder }),
    });
    currentFolder = "";
    document.getElementById("currentFolderLabel").textContent = "";
    loadFolders();
    fileTableBody.innerHTML = "";
    previewBox.textContent = "Select a file to preview";
  };
  actions.appendChild(deleteBtn);
}

// ===== File list & preview =====
async function fetchState() {
  if (!currentFolder) return;
  const res = await fetch(`/api/list/${currentFolder}`);
  const data = await res.json();

  fileTableBody.innerHTML = "";
  data.files.forEach((f) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${f.name}</td>
      <td>${f.type}</td>
      <td>
        <button class="btn" onclick="previewFile('${f.url}','${f.type}')">Preview</button>
        <button class="btn danger" onclick="deleteFile('${f.path}')">Delete</button>
        <a class="btn" href="${f.url}" download>Download</a>
      </td>`;
    fileTableBody.appendChild(tr);
  });
}

window.previewFile = function (url, type) {
  previewBox.classList.remove("emptyPreview");
  if (type.startsWith("image/")) {
    previewBox.innerHTML = `<img src="${url}" style="max-width:100%">`;
  } else if (type === "application/pdf") {
    previewBox.innerHTML = `<iframe src="${url}" width="100%" height="600px"></iframe>`;
  } else if (type.startsWith("text/")) {
    fetch(url)
      .then((r) => r.text())
      .then((txt) => (previewBox.innerHTML = `<pre>${txt}</pre>`));
  } else {
    previewBox.innerHTML = `<p>No inline preview. <a href="${url}" download>Download file</a></p>`;
  }
};

window.deleteFile = async function (path) {
  if (!confirm(`Delete ${path}?`)) return;
  await fetch(`/api/delete/${currentFolder}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filePath: path }),
  });
  fetchState();
};

// ===== Upload with progress =====
async function handleUpload(e) {
  if (!currentFolder) return alert("Select a folder first.");
  const files = e.target.files;
  if (!files.length) return;

  for (const file of files) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${file.name}</td>
      <td>${file.type}</td>
      <td><progress value="0" max="100"></progress></td>`;
    fileTableBody.appendChild(row);
    const progressEl = row.querySelector("progress");

    await uploadFile(file, progressEl);
  }
  fetchState();
}

async function uploadFile(file, progressEl) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/upload/${currentFolder}`);
    const formData = new FormData();
    formData.append("file", file);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        progressEl.value = (e.loaded / e.total) * 100;
      }
    });

    xhr.onload = () => {
      if (xhr.status === 200) resolve();
      else reject();
    };
    xhr.onerror = reject;
    xhr.send(formData);
  });
}

// ===== Init =====
loadFolders();
