import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();
const adminFile = path.resolve("./adminEmails.json");

// Leer admins
function getAdmins() {
  const raw = fs.readFileSync(adminFile, "utf8");
  return JSON.parse(raw).admins || [];
}

// Guardar admins
function saveAdmins(admins) {
  fs.writeFileSync(adminFile, JSON.stringify({ admins }, null, 2));
}

// Middleware simple para verificar super-admin (puedes mejorar esto)
router.use((req, res, next) => {
  const requester = req.headers["x-admin-email"];
  const admins = getAdmins();

  if (!admins.includes(requester)) {
    return res.status(403).json({ error: "No autorizado" });
  }
  next();
});

// Agregar admin
router.post("/add", (req, res) => {
  const { email } = req.body;

  let admins = getAdmins();
  if (admins.includes(email)) {
    return res.status(400).json({ error: "El administrador ya existe" });
  }

  admins.push(email);
  saveAdmins(admins);

  res.json({ success: true, admins });
});

// Eliminar admin
router.post("/remove", (req, res) => {
  const { email } = req.body;

  let admins = getAdmins();
  if (!admins.includes(email)) {
    return res.status(400).json({ error: "El administrador no existe" });
  }

  admins = admins.filter(a => a !== email);
  saveAdmins(admins);

  res.json({ success: true, admins });
});

// Obtener admins
router.get("/list", (req, res) => {
  res.json({ admins: getAdmins() });
});

export default router;
