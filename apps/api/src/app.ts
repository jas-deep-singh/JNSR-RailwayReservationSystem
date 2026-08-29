import express from "express";
import cors from "cors";
import stationRoutes from "./routes/station.routes";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "JNSR Railway API is running",
  });
});

app.use("/api/v1/stations", stationRoutes);

export default app;