import { Request, Response } from "express";
import { createSeatLock, releaseSeatLock } from "../services/seat-lock.service";

export async function createSeatLockController(
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
    } = req.body;

    if (
      !userId ||
      !trainNumber ||
      !seatId ||
      !sourceCode ||
      !destinationCode
    ) {
      return res.status(400).json({
        success: false,
        message:
          "userId, trainNumber, seatId, sourceCode and destinationCode are required",
      });
    }

    const seatLock = await createSeatLock({
      userId,
      trainNumber,
      seatId,
      sourceCode,
      destinationCode,
    });

    return res.status(201).json({
      success: true,
      data: seatLock,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create seat lock";

    return res.status(400).json({
      success: false,
      message,
    });
  }
}

export async function releaseSeatLockController(
  req: Request,
  res: Response,
) {
  try {
    const lockId = Array.isArray(req.params.lockId)
      ? req.params.lockId[0]
      : req.params.lockId;
    const { userId } = req.body;

    if (!lockId || !userId) {
      return res.status(400).json({
        success: false,
        message: "lockId and userId are required",
      });
    }

    const releasedLock = await releaseSeatLock({
      lockId,
      userId,
    });

    return res.status(200).json({
      success: true,
      data: releasedLock,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to release seat lock";

    const statusCode =
      message === "Seat lock not found"
        ? 404
        : message ===
            "You are not allowed to release this seat lock"
          ? 403
          : 400;

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
}