import express from "express";
import { supabase } from "../db/supabaseClient.js";

const router = express.Router();

const ADMIN_EMAILS = process.env.ADMIN_EMAILS
  ? process.env.ADMIN_EMAILS.split(",").map(email => email.trim())
  : [];

// Registro
router.post("/register", async (req, res) => {
  const { email, password, userName } = req.body;
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) return res.status(400).json({ error: authError.message });

  const userId = authData.user.id;
  const isAdmin = ADMIN_EMAILS.includes(email);

  if (userId) {
    const { data: usuarioData, error: usuarioError } = await supabase
      .from("usuarios")
      .insert([
        { 
          id_usuario: userId,
          nombre_usuario: userName,
          contrasenia: password,
          email: email,
          fecha_registro: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      ]);

    if (usuarioError) {
      return res.status(500).json({ error: usuarioError.message });
    }
  }

  res.json({ 
    user: authData.user, 
    isAdmin, 
    userName
  });
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return res.status(400).json({ error: error.message });

  const isAdmin = ADMIN_EMAILS.includes(email);
  const userId = data.user.id;
  let userName = null;

  if (userId) {
    const { data: usuario, error: usuarioError } = await supabase
      .from("usuarios")
      .select("nombre_usuario")
      .eq("id_usuario", userId)
      .single();

    if (usuario && !usuarioError) {
      userName = usuario.nombre_usuario;
    }
  }

  res.json({ 
    user: data.user, 
    session: data.session, 
    isAdmin, 
    userName
  });
});

export default router;
