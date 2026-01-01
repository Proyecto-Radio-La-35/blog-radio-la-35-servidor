import express from "express";
import { supabaseAdmin } from "../db/supabaseAdmin.js";

const router = express.Router();

const verificarAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Token requerido" });
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: "Token inválido" });
  }

  const { data: admin } = await supabaseAdmin
    .from("administradores")
    .select("id_administrador")
    .eq("id_administrador", user.id)
    .maybeSingle();

  if (!admin) {
    return res.status(403).json({ error: "Solo administradores" });
  }

  req.user = user;
  next();
};

router.get("/list", verificarAdmin, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("administradores")
    .select("email")
    .order("created_at", { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ admins: data.map(a => a.email) });
});

router.post("/add", verificarAdmin, async (req, res) => {
  const { email } = req.body;

  const { data: user } = await supabaseAdmin
    .from("usuarios")
    .select("id_usuario, email")
    .eq("email", email)
    .maybeSingle();

  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const { data: existingAdmin } = await supabaseAdmin
    .from("administradores")
    .select("id_administrador")
    .eq("id_administrador", user.id_usuario)
    .maybeSingle();

  if (existingAdmin) {
    return res.status(400).json({ error: "El usuario ya es administrador" });
  }

  const { error } = await supabaseAdmin
    .from("administradores")
    .insert({
      id_administrador: user.id_usuario,
      email: user.email
    });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const { data: admins } = await supabaseAdmin
    .from("administradores")
    .select("email")
    .order("created_at");

  res.json({ admins: admins.map(a => a.email) });
});

router.post("/remove", verificarAdmin, async (req, res) => {
  const { email } = req.body;

  if (email === req.user.email) {
    return res.status(400).json({
      error: "No puedes eliminar tu propio usuario administrador"
    });
  }

  const { data: admins } = await supabaseAdmin
    .from("administradores")
    .select("id_administrador");

  if (admins.length <= 1) {
    return res.status(400).json({
      error: "No se puede eliminar el último administrador"
    });
  }

  const { error } = await supabaseAdmin
    .from("administradores")
    .delete()
    .eq("email", email);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

export default router;