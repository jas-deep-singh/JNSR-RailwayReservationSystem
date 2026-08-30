import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  BerthType,
  CoachType,
} from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const pool = new Pool({
  connectionString,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

const stations = [
  {
    code: "NDLS",
    name: "New Delhi",
    city: "New Delhi",
    state: "Delhi",
  },
  {
    code: "AGC",
    name: "Agra Cantt",
    city: "Agra",
    state: "Uttar Pradesh",
  },
  {
    code: "GWL",
    name: "Gwalior Junction",
    city: "Gwalior",
    state: "Madhya Pradesh",
  },
  {
    code: "JHS",
    name: "Jhansi Junction",
    city: "Jhansi",
    state: "Uttar Pradesh",
  },
  {
    code: "BPL",
    name: "Bhopal Junction",
    city: "Bhopal",
    state: "Madhya Pradesh",
  },
  {
    code: "NGP",
    name: "Nagpur Junction",
    city: "Nagpur",
    state: "Maharashtra",
  },
  {
    code: "CSMT",
    name: "Chhatrapati Shivaji Maharaj Terminus",
    city: "Mumbai",
    state: "Maharashtra",
  },
];

async function seedStations() {
  console.log("Seeding stations...");

  for (const station of stations) {
    await prisma.station.upsert({
      where: {
        code: station.code,
      },
      update: {
        name: station.name,
        city: station.city,
        state: station.state,
      },
      create: station,
    });
  }

  console.log(`Seeded ${stations.length} stations`);
}

const trains = [
  {
    trainNumber: "12951",
    name: "JNSR Central Express",
    stops: [
      { code: "NDLS", arrivalTime: null, departureTime: "06:00", dayOffset: 0 },
      {
        code: "AGC",
        arrivalTime: "07:55",
        departureTime: "08:00",
        dayOffset: 0,
      },
      {
        code: "GWL",
        arrivalTime: "09:50",
        departureTime: "09:55",
        dayOffset: 0,
      },
      {
        code: "JHS",
        arrivalTime: "11:20",
        departureTime: "11:30",
        dayOffset: 0,
      },
      {
        code: "BPL",
        arrivalTime: "15:00",
        departureTime: "15:10",
        dayOffset: 0,
      },
    ],
  },

  {
    trainNumber: "12137",
    name: "JNSR Mumbai Express",
    stops: [
      { code: "NDLS", arrivalTime: null, departureTime: "05:30", dayOffset: 0 },
      {
        code: "AGC",
        arrivalTime: "07:20",
        departureTime: "07:25",
        dayOffset: 0,
      },
      {
        code: "GWL",
        arrivalTime: "09:05",
        departureTime: "09:10",
        dayOffset: 0,
      },
      {
        code: "JHS",
        arrivalTime: "10:40",
        departureTime: "10:50",
        dayOffset: 0,
      },
      {
        code: "BPL",
        arrivalTime: "14:20",
        departureTime: "14:30",
        dayOffset: 0,
      },
      {
        code: "NGP",
        arrivalTime: "19:30",
        departureTime: "19:40",
        dayOffset: 0,
      },
      { code: "CSMT", arrivalTime: "06:30", departureTime: null, dayOffset: 1 },
    ],
  },

  {
    trainNumber: "12952",
    name: "JNSR Return Express",
    stops: [
      { code: "CSMT", arrivalTime: null, departureTime: "20:00", dayOffset: 0 },
      {
        code: "NGP",
        arrivalTime: "06:00",
        departureTime: "06:10",
        dayOffset: 1,
      },
      {
        code: "BPL",
        arrivalTime: "11:00",
        departureTime: "11:10",
        dayOffset: 1,
      },
      {
        code: "JHS",
        arrivalTime: "14:40",
        departureTime: "14:50",
        dayOffset: 1,
      },
      {
        code: "GWL",
        arrivalTime: "16:20",
        departureTime: "16:25",
        dayOffset: 1,
      },
      {
        code: "AGC",
        arrivalTime: "18:15",
        departureTime: "18:20",
        dayOffset: 1,
      },
      { code: "NDLS", arrivalTime: "20:30", departureTime: null, dayOffset: 1 },
    ],
  },
];

async function seedTrains() {
  console.log("Seeding trains...");

  const stationMap = new Map(
    (
      await prisma.station.findMany({
        select: {
          id: true,
          code: true,
        },
      })
    ).map((station) => [station.code, station.id]),
  );

  for (const trainData of trains) {
    const train = await prisma.train.upsert({
      where: {
        trainNumber: trainData.trainNumber,
      },
      update: {
        name: trainData.name,
        active: true,
      },
      create: {
        trainNumber: trainData.trainNumber,
        name: trainData.name,
        active: true,
      },
    });

    await prisma.trainRoute.deleteMany({
      where: {
        trainId: train.id,
      },
    });

    await prisma.trainRoute.createMany({
      data: trainData.stops.map((stop, index) => {
        const stationId = stationMap.get(stop.code);

        if (!stationId) {
          throw new Error(
            `Station ${stop.code} was not found while seeding train ${trainData.trainNumber}`,
          );
        }

        return {
          trainId: train.id,
          stationId,
          sequence: index + 1,
          arrivalTime: stop.arrivalTime,
          departureTime: stop.departureTime,
          dayOffset: stop.dayOffset,
        };
      }),
    });
  }

  console.log(`Seeded ${trains.length} trains`);
}

const coachTemplates = [
  {
    type: CoachType.SL,
    coachNumbers: ["S1", "S2"],
    seatsPerCoach: 12,
  },
  {
    type: CoachType.THREE_A,
    coachNumbers: ["B1", "B2"],
    seatsPerCoach: 12,
  },
  {
    type: CoachType.TWO_A,
    coachNumbers: ["A1"],
    seatsPerCoach: 8,
  },
];

function getBerthType(coachType: CoachType, seatNumber: number): BerthType {
  if (coachType === CoachType.TWO_A) {
    const position = (seatNumber - 1) % 8;

    const berthTypes: BerthType[] = [
      BerthType.LOWER,
      BerthType.UPPER,
      BerthType.LOWER,
      BerthType.UPPER,
      BerthType.SIDE_LOWER,
      BerthType.SIDE_UPPER,
      BerthType.SIDE_LOWER,
      BerthType.SIDE_UPPER,
    ];

    return berthTypes[position]!;
  }

  const position = (seatNumber - 1) % 12;

  const berthTypes: BerthType[] = [
    BerthType.LOWER,
    BerthType.MIDDLE,
    BerthType.UPPER,
    BerthType.LOWER,
    BerthType.MIDDLE,
    BerthType.UPPER,
    BerthType.SIDE_LOWER,
    BerthType.SIDE_UPPER,
    BerthType.LOWER,
    BerthType.MIDDLE,
    BerthType.UPPER,
    BerthType.SIDE_LOWER,
  ];

  return berthTypes[position]!;
}

async function seedCoachesAndSeats() {
  console.log("Seeding coaches and seats...");

  const trainsFromDb = await prisma.train.findMany({
    select: {
      id: true,
      trainNumber: true,
    },
  });

  for (const train of trainsFromDb) {
    for (const template of coachTemplates) {
      for (const coachNumber of template.coachNumbers) {
        const coach = await prisma.coach.upsert({
          where: {
            trainId_coachNumber: {
              trainId: train.id,
              coachNumber,
            },
          },
          update: {
            type: template.type,
          },
          create: {
            trainId: train.id,
            coachNumber,
            type: template.type,
          },
        });

        for (
          let seatNumber = 1;
          seatNumber <= template.seatsPerCoach;
          seatNumber++
        ) {
          await prisma.seat.upsert({
            where: {
              coachId_seatNumber: {
                coachId: coach.id,
                seatNumber: String(seatNumber),
              },
            },
            update: {
              berthType: getBerthType(template.type, seatNumber),
            },
            create: {
              coachId: coach.id,
              seatNumber: String(seatNumber),
              berthType: getBerthType(template.type, seatNumber),
            },
          });
        }
      }
    }

    console.log(`Seeded coaches and seats for train ${train.trainNumber}`);
  }
}

async function main() {
  await seedStations();
  await seedTrains();
  await seedCoachesAndSeats();
}

main()
  .then(async () => {
    console.log("Seeding test user...");

    await prisma.user.upsert({
      where: {
        email: "test@jnsr.local",
      },
      update: {},
      create: {
        name: "JNSR Test User",
        email: "test@jnsr.local",
        passwordHash: "development-only-password",
        role: "USER",
      },
    });

    console.log("Test user seeded");
    console.log("Seed completed successfully");
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);

    await prisma.$disconnect();
    await pool.end();

    process.exit(1);
  });
