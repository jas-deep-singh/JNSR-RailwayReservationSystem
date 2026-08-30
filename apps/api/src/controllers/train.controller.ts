import type { Request, Response } from "express";
import { searchTrains, getTrainDetails } from "../services/train.service";
import { getTrainAvailability } from "../services/availabilty.service";

export async function searchTrainsController(
  req: Request,
  res: Response,
) {
  try {
    const source = String(req.query.source ?? "")
      .trim()
      .toUpperCase();

    const destination = String(req.query.destination ?? "")
      .trim()
      .toUpperCase();

    if (!source || !destination) {
      return res.status(400).json({
        success: false,
        message: "source and destination are required",
      });
    }

    const trains = await searchTrains(source, destination);

    return res.status(200).json({
      success: true,
      data: trains,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to search trains";

    return res.status(400).json({
      success: false,
      message,
    });
  }
}

export async function getTrainDetailsController(
  req: Request,
  res: Response,
) {
  try {
    const trainNumber = String(req.params.trainNumber ?? "")
      .trim();

    if (!trainNumber) {
      return res.status(400).json({
        success: false,
        message: "Train number is required",
      });
    }

    const train = await getTrainDetails(trainNumber);

    if (!train) {
      return res.status(404).json({
        success: false,
        message: `Train '${trainNumber}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      data: train,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch train details";

    return res.status(500).json({
      success: false,
      message,
    });
  }
}

export async function getTrainAvailabilityController(
  req: Request,
  res: Response,
) {
  try {
    const trainNumber = String(req.params.trainNumber ?? "").trim();
    const sourceCode = String(req.query.source ?? "").trim().toUpperCase();
    const destinationCode = String(req.query.destination ?? "")
      .trim()
      .toUpperCase();

    const dateString = String(req.query.date ?? "").trim();

    if (!trainNumber) {
      return res.status(400).json({
        success: false,
        message: "Train number is required",
      });
    }

    if (!sourceCode || !destinationCode) {
      return res.status(400).json({
        success: false,
        message: "Source and destination stations are required",
      });
    }

    if (!dateString) {
      return res.status(400).json({
        success: false,
        message: "Journey date is required",
      });
    }

    const journeyDate = new Date(`${dateString}T00:00:00.000Z`);

    if (Number.isNaN(journeyDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid journey date",
      });
    }

    const availability = await getTrainAvailability({
      trainNumber,
      sourceCode,
      destinationCode,
      journeyDate,
    });

    return res.status(200).json({
      success: true,
      data: availability,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch train availability";

    return res.status(400).json({
      success: false,
      message,
    });
  }
}