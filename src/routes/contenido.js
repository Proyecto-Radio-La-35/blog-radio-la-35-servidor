import express from "express";
import { supabase } from "../db/supabaseClient.js";

const router = express.Router();

function getAdmins() {
  try {
    const data = fs.readFileSync(adminFilePath, "utf8");
    const parsedData = JSON.parse(data);
    return parsedData.admins || [];
  } catch (error) {
    console.error("Error al leer el archivo de administradores:", error);
    return [];
  }
}

const ADMIN_EMAILS = getAdmins();

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

// Crear comentario (solo para entradas)
router.post("/:id/comentarios", async (req, res) => {
  const { id } = req.params;
  const { contenido } = req.body;
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Debes iniciar sesión para comentar." });
  }

  if (!contenido || !contenido.trim()) {
    return res.status(400).json({ error: "El comentario no puede estar vacío." });
  }

  try {
    // Verificar usuario
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: "Token inválido o expirado." });
    }

    // Verificar que la publicación existe y es una entrada
    const { data: publicacion, error: pubError } = await supabase
      .from("publicaciones")
      .select("tipo")
      .eq("id_publicacion", id)
      .maybeSingle();

    if (pubError) {
      return res.status(500).json({ error: pubError.message });
    }

    if (!publicacion) {
      return res.status(404).json({ error: "Publicación no encontrada." });
    }

    if (publicacion.tipo !== "entrada") {
      return res.status(403).json({ error: "Solo se pueden comentar entradas de blog." });
    }

    // Insertar comentario
    const { data, error } = await supabase
      .from("comentarios")
      .insert([{
        id_usuario: user.id,
        id_publicacion: id,
        contenido: contenido.trim(),
        fecha_comentario: new Date().toISOString()
      }])
      .select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ 
      success: true, 
      message: "Comentario publicado exitosamente",
      data: data[0] 
    });
  } catch (err) {
    console.error("Error al crear comentario:", err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// Obtener comentarios de una publicación
router.get("/:id/comentarios", async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from("comentarios")
      .select(`
        id_comentario,
        contenido,
        fecha_comentario,
        id_usuario,
        usuarios!inner(nombre_usuario)
      `)
      .eq("id_publicacion", id)
      .order("fecha_comentario", { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Formatear datos para incluir nombre de usuario
    const comentariosFormateados = data.map(comentario => ({
      id_comentario: comentario.id_comentario,
      contenido: comentario.contenido,
      fecha_comentario: comentario.fecha_comentario,
      id_usuario: comentario.id_usuario,
      nombre_usuario: comentario.usuarios.nombre_usuario
    }));

    res.json({ 
      success: true,
      count: comentariosFormateados.length,
      data: comentariosFormateados
    });
  } catch (err) {
    console.error("Error al obtener comentarios:", err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// Eliminar comentario por ID (solo administradores)
router.delete("/comentarios/:id", verificarAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Verificar si existe
    const { data: comentario, error: checkError } = await supabase
      .from("comentarios")
      .select("*")
      .eq("id_comentario", id)
      .maybeSingle();

    if (checkError) {
      return res.status(500).json({ error: checkError.message });
    }

    if (!comentario) {
      return res.status(404).json({ error: "Comentario no encontrado." });
    }

    // Eliminar comentario
    const { error: deleteError } = await supabase
      .from("comentarios")
      .delete()
      .eq("id_comentario", id);

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message });
    }

    res.json({
      success: true,
      message: "Comentario eliminado exitosamente",
      data: comentario
    });
  } catch (err) {
    console.error("Error al eliminar comentario:", err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// Obtener todos los comentarios (solo admins)
router.get("/comentarios/todos", verificarAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("comentarios")
      .select(`
        id_comentario,
        contenido,
        fecha_comentario,
        id_publicacion,
        usuarios(nombre_usuario),
        publicaciones(titulo)
      `)
      .order("fecha_comentario", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (err) {
    console.error(err);
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
                .from("usuarios")
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