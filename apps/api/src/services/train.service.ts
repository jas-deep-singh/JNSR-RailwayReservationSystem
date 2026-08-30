import { prisma } from "../lib/prisma";

export async function searchTrains(
  sourceCode: string,
  destinationCode: string,
) {
  const source = await prisma.station.findUnique({
    where: {
      code: sourceCode,
    },
  });

  const destination = await prisma.station.findUnique({
    where: {
      code: destinationCode,
    },
  });

  if (!source) {
    throw new Error(`Source station '${sourceCode}' not found`);
  }

  if (!destination) {
    throw new Error(`Destination station '${destinationCode}' not found`);
  }

  if (source.id === destination.id) {
    throw new Error("Source and destination stations cannot be the same");
  }

  const trains = await prisma.train.findMany({
    where: {
      active: true,
      routes: {
        some: {
          stationId: source.id,
        },
      },
      AND: {
        routes: {
          some: {
            stationId: destination.id,
          },
        },
      },
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
    },
    orderBy: {
      trainNumber: "asc",
    },
  });

  return trains
    .map((train) => {
      const sourceRoute = train.routes.find(
        (route) => route.stationId === source.id,
      );

      const destinationRoute = train.routes.find(
        (route) => route.stationId === destination.id,
      );

      if (!sourceRoute || !destinationRoute) {
        return null;
      }

      
      if (sourceRoute.sequence >= destinationRoute.sequence) {
        return null;
      }

      return {
        id: train.id,
        trainNumber: train.trainNumber,
        name: train.name,
        source: {
          code: source.code,
          name: source.name,
          sequence: sourceRoute.sequence,
          departureTime: sourceRoute.departureTime,
          dayOffset: sourceRoute.dayOffset,
        },
        destination: {
          code: destination.code,
          name: destination.name,
          sequence: destinationRoute.sequence,
          arrivalTime: destinationRoute.arrivalTime,
          dayOffset: destinationRoute.dayOffset,
        },
      };
    })
    .filter((train) => train !== null);
}

export async function getTrainDetails(trainNumber: string) {
  return prisma.train.findUnique({
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
}