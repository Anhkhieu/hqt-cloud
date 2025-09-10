// api/state.js
let driveState = {
  folders: [
    { id: "1", name: "Folder 1", files: [] },
    { id: "2", name: "Folder 2", files: [] },
  ],
};

export default function handler(req, res) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: "Unauthorized" });

  if (req.method === "GET") {
    return res.json(driveState);
  } else if (req.method === "POST") {
    driveState = req.body;
    return res.json({ ok: true });
  } else {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
}
