import { Router } from "express";
import { payForBooking } from "../controllers/payment.controller";

const router = Router();

router.post("/:bookingId/pay", payForBooking);

export default router;