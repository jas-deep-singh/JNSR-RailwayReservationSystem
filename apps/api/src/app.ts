import express from "express";
import cors from "cors";
import stationRoutes from "./routes/station.routes";
import trainRoutes from "./routes/train.routes";
import seatLockRoutes from "./routes/seat-lock.routes";
import bookingRoutes from "./routes/booking.routes";
import paymentRoutes from "./routes/payment.routes";

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
app.use("/api/v1/trains", trainRoutes);
app.use("/api/v1/seat-locks", seatLockRoutes);
app.use("/api/v1/bookings", bookingRoutes);
app.use("/api/v1/payments", paymentRoutes);

export default app;