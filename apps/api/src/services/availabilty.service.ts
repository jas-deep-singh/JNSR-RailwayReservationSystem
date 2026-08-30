import { prisma } from "../lib/prisma";

interface AvailabilityParams {
  trainNumber: string;
  sourceCode: string;
  destinationCode: string;
  journeyDate: Date;
}

export async function getTrainAvailability({
  trainNumber,
  sourceCode,
  destinationCode,
  journeyDate,
}: AvailabilityParams) {
  const train = await prisma.train.findUnique({
    where: {
      trainNumber,
    },
    include: {
      routes: {
        include: {
          station: true,
        },
        orderBy: {
          sequence: "asc",
        },
      },
      coaches: {
        include: {
          seats: {
            orderBy: {
              seatNumber: "asc",
            },
          },
        },
        orderBy: {
          coachNumber: "asc",
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
    throw new Error(
      "Source station must come before destination station",
    );
  }

  const seats = train.coaches.flatMap((coach) =>
    coach.seats.map((seat) => ({
      id: seat.id,
      coachId: coach.id,
      coachNumber: coach.coachNumber,
      coachType: coach.type,
      seatNumber: seat.seatNumber,
      berthType: seat.berthType,
    })),
  );

  const activeReservations = await prisma.seatReservation.findMany({
    where: {
      status: "ACTIVE",
      seat: {
        coach: {
          trainId: train.id,
        },
      },
      fromSequence: {
        lt: destinationRoute.sequence,
      },
      toSequence: {
        gt: sourceRoute.sequence,
      },
    },
    select: {
      seatId: true,
    },
  });

  const now = new Date();

  const activeLocks = await prisma.seatLock.findMany({
    where: {
      expiresAt: {
        gt: now,
      },
      seat: {
        coach: {
          trainId: train.id,
        },
      },
      fromSequence: {
        lt: destinationRoute.sequence,
      },
      toSequence: {
        gt: sourceRoute.sequence,
      },
    },
    select: {
      seatId: true,
    },
  });

  const unavailableSeatIds = new Set([
    ...activeReservations.map((reservation) => reservation.seatId),
    ...activeLocks.map((lock) => lock.seatId),
  ]);

  const availableSeats = seats.filter(
    (seat) => !unavailableSeatIds.has(seat.id),
  );

  return {
    train: {
      trainNumber: train.trainNumber,
      name: train.name,
    },
    journey: {
      source: {
        code: sourceRoute.station.code,
        name: sourceRoute.station.name,
        sequence: sourceRoute.sequence,
        departureTime: sourceRoute.departureTime,
      },
      destination: {
        code: destinationRoute.station.code,
        name: destinationRoute.station.name,
        sequence: destinationRoute.sequence,
        arrivalTime: destinationRoute.arrivalTime,
      },
      journeyDate,
    },
    totalSeats: seats.length,
    availableSeats: availableSeats.length,
    seats: availableSeats,
  };
}