import type { Request, Response } from "express";
import { getAllStations } from "../services/station.service";

export async function listStations(
  _req: Request,
  res: Response,
) {
  try {
    const stations = await getAllStations();

    res.status(200).json({
      success: true,
      data: stations,
    });
  } catch (error) {
    console.error("Failed to fetch stations:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch stations",
    });
  }
}