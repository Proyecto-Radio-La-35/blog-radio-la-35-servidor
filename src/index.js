import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";

dotenv.config();

const app = express();

app.use(cors({
  origin: ["http://localhost:3000", "https://radio-la-35.netlify.app"],
  methods: ["GET", "POST"],
  credentials: true,
}));

app.use(express.json());

app.use("/auth", authRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor iniciado en puerto ${PORT}`));
