import { Router } from "express";
import { createSeatLockController, releaseSeatLockController } from "../controllers/seat-lock.controller";

const router = Router();

router.post("/", createSeatLockController);
router.delete("/:lockId", releaseSeatLockController);

export default router;