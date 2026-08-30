import crypto from "node:crypto";

import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";

const LOCK_TTL_SECONDS = 10 * 60;

interface BookingPassengerInput {
  name: string;
  age: number;
  gender: string;
}

interface CreateBookingParams {
  userId: string;
  trainNumber: string;
  seatId: string;
  sourceCode: string;
  destinationCode: string;
  journeyDate: string;
  passengers: BookingPassengerInput[];
  totalAmount: number;
}

function generatePNR(): string {
  return `JNSR${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function createBooking({
  userId,
  trainNumber,
  seatId,
  sourceCode,
  destinationCode,
  journeyDate,
  passengers,
  totalAmount,
}: CreateBookingParams) {
  if (!passengers.length) {
    throw new Error("At least one passenger is required");
  }

  const parsedJourneyDate = new Date(journeyDate);

  if (Number.isNaN(parsedJourneyDate.getTime())) {
    throw new Error("Invalid journey date");
  }

  if (totalAmount < 0) {
    throw new Error("Total amount cannot be negative");
  }

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

  /*
   * The Redis lock key must exactly match the key generated
   * by the seat-lock service.
   */
  const lockKey = [
    "seat-lock",
    seatId,
    sourceRoute.sequence,
    destinationRoute.sequence,
  ].join(":");

  const lockData = await redis.get(lockKey);

  if (!lockData) {
    throw new Error("Seat lock has expired or does not exist");
  }

  let lock: {
    token: string;
    userId: string;
    trainNumber: string;
    seatId: string;
    sourceSequence: number;
    destinationSequence: number;
  };

  try {
    lock = JSON.parse(lockData);
  } catch {
    throw new Error("Invalid seat lock data");
  }

  if (lock.userId !== userId) {
    throw new Error("Seat is locked by another user");
  }

  if (
    lock.trainNumber !== trainNumber ||
    lock.seatId !== seatId ||
    lock.sourceSequence !== sourceRoute.sequence ||
    lock.destinationSequence !== destinationRoute.sequence
  ) {
    throw new Error("Seat lock does not match this booking request");
  }

  /*
   * Check for an existing permanent reservation before
   * creating the booking.
   */
  const existingReservation = await prisma.seatReservation.findFirst({
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

  if (existingReservation) {
    throw new Error("Seat is already reserved for part of this journey");
  }

  /*
   * Create all booking-related records atomically.
   */
  const booking = await prisma.$transaction(async (tx) => {
    let pnr = generatePNR();

    /*
     * Extremely unlikely collision protection.
     */
    while (
      await tx.booking.findUnique({
        where: { pnr },
      })
    ) {
      pnr = generatePNR();
    }

    const createdBooking = await tx.booking.create({
      data: {
        pnr,
        userId,
        trainId: train.id,
        sourceStationId: sourceRoute.stationId,
        destinationStationId: destinationRoute.stationId,
        journeyDate: parsedJourneyDate,
        status: "PENDING",
        totalAmount,
        expiresAt: new Date(Date.now() + LOCK_TTL_SECONDS * 1000),

        passengers: {
          create: passengers.map((passenger) => ({
            name: passenger.name,
            age: passenger.age,
            gender: passenger.gender,
          })),
        },

        seatReservations: {
          create: {
            seatId,
            fromSequence: sourceRoute.sequence,
            toSequence: destinationRoute.sequence,
            status: "ACTIVE",
          },
        },

        payment: {
          create: {
            provider: "MOCK",
            amount: totalAmount,
            status: "PENDING",
          },
        },
      },

      include: {
        passengers: true,
        seatReservations: {
          include: {
            seat: {
              include: {
                coach: true,
              },
            },
          },
        },
        payment: true,
        sourceStation: true,
        destinationStation: true,
        train: true,
      },
    });

    /*
     * The temporary database SeatLock is no longer needed
     * after the permanent SeatReservation is created.
     */
    await tx.seatLock.deleteMany({
      where: {
        seatId,
        userId,
        fromSequence: sourceRoute.sequence,
        toSequence: destinationRoute.sequence,
      },
    });

    return createdBooking;
  });

  /*
   * Delete the Redis lock only after the database
   * transaction has successfully committed.
   *
   * We use the stored token to ensure we don't accidentally
   * delete a lock that belongs to somebody else.
   */
  const currentLockData = await redis.get(lockKey);

  if (currentLockData) {
    try {
      const currentLock = JSON.parse(currentLockData);

      if (currentLock.token === lock.token) {
        await redis.del(lockKey);
      }
    } catch {
      /*
       * The booking itself has already committed.
       * We deliberately don't roll it back because Redis
       * cleanup failure should not undo a successful DB transaction.
       */
    }
  }

  return booking;
}
