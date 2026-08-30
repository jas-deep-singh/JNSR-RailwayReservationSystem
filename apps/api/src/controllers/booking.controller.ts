import type { Request, Response } from "express";
import { createBooking } from "../services/booking.service";

export async function createBookingController(
  req: Request,
  res: Response,
) {
  try {
    const {
      userId,
      trainNumber,
      seatId,
      sourceCode,
      destinationCode,
      journeyDate,
      passengers,
      totalAmount,
    } = req.body;

    if (
      !userId ||
      !trainNumber ||
      !seatId ||
      !sourceCode ||
      !destinationCode ||
      !journeyDate ||
      !passengers ||
      totalAmount === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required booking fields",
      });
    }

    const booking = await createBooking({
      userId,
      trainNumber,
      seatId,
      sourceCode,
      destinationCode,
      journeyDate,
      passengers,
      totalAmount,
    });

    return res.status(201).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create booking";

    return res.status(400).json({
      success: false,
      message,
    });
  }
}