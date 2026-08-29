import { Router } from "express";
import { listStations } from "../controllers/station.controller";

const router = Router();

router.get("/", listStations);

export default router;