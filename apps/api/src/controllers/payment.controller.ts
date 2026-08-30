import type { Request, Response } from "express";
import { processPayment } from "../services/payment.service";

export async function payForBooking(
  req: Request,
  res: Response,
) {
  try {
    const { bookingId } = req.params;

    if (typeof bookingId !== "string" || !bookingId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required",
      });
    }

    const result = await processPayment(bookingId);

    return res.status(200).json({
      success: true,
      message: "Payment successful",
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Payment processing failed";

    return res.status(400).json({
      success: false,
      message,
    });
  }
}