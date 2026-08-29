import { prisma } from "../lib/prisma";

export async function getAllStations() {
  return prisma.station.findMany({
    orderBy: {
      name: "asc",
    },
  });
}