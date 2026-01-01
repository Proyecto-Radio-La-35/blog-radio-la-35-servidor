import express from "express";
import { supabase } from "../db/supabaseClient.js";
import { supabaseAdmin } from "../db/supabaseAdmin.js";

const router = express.Router();

// Registro
router.post("/register", async (req, res) => {
  const { email, password, userName } = req.body;

  const { data: authData, error: authError } =
    await supabase.auth.signUp({ email, password });

  if (authError) {
    return res.status(400).json({ error: authError.message });
  }

  const userId = authData.user.id;

  await supabase.from("usuarios").insert({
    id_usuario: userId,
    nombre_usuario: userName,
    email,
    fecha_registro: new Date().toISOString()
  });

  res.json({
    user: authData.user,
    isAdmin: false,
    userName
  });
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const { data, error } =
    await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nombre_usuario")
    .eq("id_usuario", data.user.id)
    .maybeSingle();

  const { data: admin } = await supabaseAdmin
    .from("administradores")
    .select("id_administrador")
    .eq("id_administrador", data.user.id)
    .maybeSingle();

  res.json({
    user: data.user,
    session: data.session,
    userName: usuario?.nombre_usuario ?? null,
    isAdmin: !!admin
  });
});

export default router;
