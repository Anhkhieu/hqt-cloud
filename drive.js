// drive.js
const API = "/api"; // Vercel serverless API
const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");

if (!user || !token) location.href = "login.html";

document.getElementById("userDisplay").textContent = `${user.email} (${user.role})`;

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
  const res = await fetch(`${API}/state`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return logout();
  driveState = await res.json();
  renderAll();
}

function logout() {
  localStorage.removeItem("user");
  localStorage.removeItem("token");
  location.href = "login.html";
}

// Functions: renderFolders, renderFiles, addFolder, renameFolder, deleteFolder, uploadFile, deleteFile, previewFile
// ... same as before, just ensure all fetch requests use `Authorization: Bearer ${token}` and API = "/api"
