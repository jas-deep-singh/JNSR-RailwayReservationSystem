import { Router } from "express";
import { searchTrainsController, getTrainDetailsController, getTrainAvailabilityController } from "../controllers/train.controller";

const router = Router();

router.get("/search", searchTrainsController);
router.get("/:trainNumber/availability", getTrainAvailabilityController);
router.get("/:trainNumber", getTrainDetailsController);

export default router;