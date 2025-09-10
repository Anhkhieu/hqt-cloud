export default async function handler(req, res) {
  const { folderId } = req.query;
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  // For demo: just echo file metadata
  const filename = req.headers["x-filename"];
  const contentType = req.headers["content-type"];

  const folder = folderId ? { id: folderId, name: `Folder ${folderId}`, files: [] } : { id: "1", name: "Folder 1", files: [] };
  folder.files.push({ name: filename, type: contentType, url: `/uploads/${filename}` });

  res.json({ files: folder.files });
}
