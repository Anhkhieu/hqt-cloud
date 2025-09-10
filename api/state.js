let driveState = { folders: [{ id: "1", name: "Folder 1", files: [] }] };

export default function handler(req, res) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send("Unauthorized");

  if (req.method === "GET") {
    return res.json(driveState);
  } else if (req.method === "POST") {
    driveState = req.body; // update state
    return res.json(driveState);
  } else {
    return res.status(405).send("Method Not Allowed");
  }
}
