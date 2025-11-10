import express from "express";
import { supabase } from "../db/supabaseClient.js";

const router = express.Router();

const ADMIN_EMAILS = process.env.ADMIN_EMAILS
  ? process.env.ADMIN_EMAILS.split(",").map(email => email.trim())
  : [];

// Middleware para verificar admin
const verificarAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  
  if (!token) {
    return res.status(401).json({ error: "No autorizado. Token requerido." });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: "Token inválido o expirado." });
    }

    if (!ADMIN_EMAILS.includes(user.email)) {
      return res.status(403).json({ error: "Acceso denegado. Solo administradores." });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({ error: "Error al verificar credenciales." });
  }
};

// Crear contenido (noticia, entrada o evento)
router.post("/crear", verificarAdmin, async (req, res) => {
  const { tipo, titulo, contenido, imagen } = req.body;

  if (!["noticia", "entrada", "evento"].includes(tipo)) {
    return res.status(400).json({ error: "Tipo inválido." });
  }

  if (!titulo || !titulo.trim()) {
    return res.status(400).json({ error: "El título es requerido." });
  }

  if (!contenido || !contenido.trim()) {
    return res.status(400).json({ error: "El contenido es requerido." });
  }

  try {
    const datosInsertar = {
      tipo,
      titulo: titulo.trim(),
      contenido: contenido.trim(),
      imagen: imagen || "/radio_la_35.png",
      autor_email: req.user.email,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("publicaciones")
      .insert([datosInsertar])
      .select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ 
      success: true, 
      message: "Contenido creado exitosamente",
      data: data[0] 
    });
  } catch (err) {
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// Obtener contenido filtrado por tipo
router.get("/", async (req, res) => {
  const { tipo } = req.query;

  try {
    let query = supabase
      .from("publicaciones")
      .select("*")
      .order("created_at", { ascending: false });

    if (tipo && ["noticia", "entrada", "evento"].includes(tipo)) {
      query = query.eq("tipo", tipo);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ 
      success: true,
      count: data.length,
      data 
    });
  } catch (err) {
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;