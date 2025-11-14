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

// Obtener contenido filtrado por tipo (listado)
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

router.get("/:id", async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Obtener la publicación por ID
        const { data: publicacion, error: pubError } = await supabase
            .from("publicaciones")
            .select("*")
            .eq("id_publicacion", id)
            .maybeSingle();

        if (pubError) {
            return res.status(500).json({ error: pubError.message });
        }

        if (!publicacion) {
            return res.status(404).json({ error: "Contenido no encontrado." });
        }
        
        let autorNombre = publicacion.autor_email;

        if (publicacion.autor_email) {
            const { data: perfil, error: perfilError } = await supabase
                .from("perfiles")
                .select("nombre_usuario") 
                .eq("email", publicacion.autor_email) 
                .maybeSingle();

            if (!perfilError && perfil) {
                autorNombre = perfil.nombre_usuario;
            }
        }
        
        const respuesta = {
            ...publicacion,
            nombre_usuario: autorNombre 
        };

        res.json({ 
            success: true,
            data: respuesta
        });
    } catch (err) {
        console.error("Error al obtener contenido por ID:", err);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

// Eliminar contenido por ID
router.delete("/:id", verificarAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Verificar que la publicación existe
    const { data: publicacion, error: checkError } = await supabase
      .from("publicaciones")
      .select("*")
      .eq("id_publicacion", id)
      .maybeSingle();

    if (checkError) {
      return res.status(500).json({ error: checkError.message });
    }

    if (!publicacion) {
      return res.status(404).json({ error: "Publicación no encontrada." });
    }

    // Eliminar la publicación
    const { error: deleteError } = await supabase
      .from("publicaciones")
      .delete()
      .eq("id_publicacion", id);

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message });
    }

    res.json({ 
      success: true, 
      message: "Publicación eliminada exitosamente",
      data: publicacion
    });
  } catch (err) {
    console.error("Error al eliminar contenido:", err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;