import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import crypto from "node:crypto";

const LOCK_TTL_SECONDS = 10 * 60;

interface CreateSeatLockParams {
  userId: string;
  trainNumber: string;
  seatId: string;
  sourceCode: string;
  destinationCode: string;
}

export async function createSeatLock({
  userId,
  trainNumber,
  seatId,
  sourceCode,
  destinationCode,
}: CreateSeatLockParams) {
  const train = await prisma.train.findUnique({
    where: {
      trainNumber,
    },
    include: {
      routes: {
        include: {
          station: true,
        },
      },
    },
  });

  if (!train) {
    throw new Error(`Train '${trainNumber}' not found`);
  }

  const sourceRoute = train.routes.find(
    (route) => route.station.code === sourceCode,
  );

  const destinationRoute = train.routes.find(
    (route) => route.station.code === destinationCode,
  );

  if (!sourceRoute) {
    throw new Error(`Source station '${sourceCode}' not found on this train`);
  }

  if (!destinationRoute) {
    throw new Error(
      `Destination station '${destinationCode}' not found on this train`,
    );
  }

  if (sourceRoute.sequence >= destinationRoute.sequence) {
    throw new Error("Source station must come before destination station");
  }

  const seat = await prisma.seat.findFirst({
    where: {
      id: seatId,
      coach: {
        trainId: train.id,
      },
    },
  });

  if (!seat) {
    throw new Error("Seat not found on this train");
  }

  const overlappingReservation = await prisma.seatReservation.findFirst({
    where: {
      seatId,
      status: "ACTIVE",
      fromSequence: {
        lt: destinationRoute.sequence,
      },
      toSequence: {
        gt: sourceRoute.sequence,
      },
    },
  });

  if (overlappingReservation) {
    throw new Error("Seat is already reserved for part of this journey");
  }

  const lockToken = crypto.randomUUID();

  const lockKey = `seat-lock:${seatId}:${sourceRoute.sequence}:${destinationRoute.sequence}`;

  // Find existing Redis locks for this seat.
  const existingKeys = await redis.keys(`seat-lock:${seatId}:*`);

  for (const existingKey of existingKeys) {
    const existingLock = await redis.get(existingKey);

    if (!existingLock) {
      continue;
    }

    const parsedLock = JSON.parse(existingLock) as {
      sourceSequence: number;
      destinationSequence: number;
    };

    const overlaps =
      parsedLock.sourceSequence < destinationRoute.sequence &&
      parsedLock.destinationSequence > sourceRoute.sequence;

    if (overlaps) {
      throw new Error("Seat is currently locked for part of this journey");
    }
  }

  const acquired = await redis.set(
    lockKey,
    JSON.stringify({
      token: lockToken,
      userId,
      trainNumber,
      seatId,
      sourceSequence: sourceRoute.sequence,
      destinationSequence: destinationRoute.sequence,
    }),
    "EX",
    LOCK_TTL_SECONDS,
    "NX",
  );

  if (acquired !== "OK") {
    throw new Error("Seat is currently locked by another user");
  }

  try {
    const expiresAt = new Date(Date.now() + LOCK_TTL_SECONDS * 1000);

    const seatLock = await prisma.seatLock.create({
      data: {
        seatId,
        userId,
        fromSequence: sourceRoute.sequence,
        toSequence: destinationRoute.sequence,
        expiresAt,
      },
    });

    return {
      id: seatLock.id,
      seatId,
      trainNumber,
      source: sourceCode,
      destination: destinationCode,
      expiresAt,
    };
  } catch (error) {
    await redis.del(lockKey);
    throw error;
  }
}


export async function releaseSeatLock({
  lockId,
  userId,
}: {
  lockId: string;
  userId: string;
}) {
  const seatLock = await prisma.seatLock.findUnique({
    where: {
      id: lockId,
    },
    include: {
      seat: true,
    },
  });

  if (!seatLock) {
    throw new Error("Seat lock not found");
  }

  if (seatLock.userId !== userId) {
    throw new Error("You are not allowed to release this seat lock");
  }

  const lockKey = [
    "seat-lock",
    seatLock.seatId,
    seatLock.fromSequence,
    seatLock.toSequence,
  ].join(":");

  await redis.del(lockKey);

  await prisma.seatLock.delete({
    where: {
      id: lockId,
    },
  });

  return {
    id: lockId,
    seatId: seatLock.seatId,
    released: true,
  };
}
