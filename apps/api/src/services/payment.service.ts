import { prisma } from "../lib/prisma";
import { MockPaymentProvider } from "../payments/mock-payment.provider";

const paymentProvider = new MockPaymentProvider();

export async function processPayment(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
    },
    include: {
      payment: true,
    },
  });

  if (!booking) {
    throw new Error(`Booking '${bookingId}' not found`);
  }

  if (!booking.payment) {
    throw new Error("Payment record not found for this booking");
  }

  if (booking.status !== "PENDING") {
    throw new Error(
      `Booking cannot be paid because its status is '${booking.status}'`,
    );
  }

  if (booking.payment.status === "SUCCESS") {
    throw new Error("Payment has already been completed");
  }

  const result = await paymentProvider.pay({
    bookingId: booking.id,
    amount: Number(booking.payment.amount),
  });

  if (!result.success || !result.transactionId) {
    await prisma.payment.update({
      where: {
        id: booking.payment.id,
      },
      data: {
        status: "FAILED",
      },
    });

    throw new Error(result.message ?? "Payment failed");
  }

  const updatedBooking = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.update({
      where: {
        id: booking.payment!.id,
      },
      data: {
        status: "SUCCESS",
        transactionId: result.transactionId,
        paidAt: new Date(),
      },
    });

    const updated = await tx.booking.update({
      where: {
        id: booking.id,
      },
      data: {
        status: "CONFIRMED",
      },
      include: {
        payment: true,
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
        train: true,
        sourceStation: true,
        destinationStation: true,
      },
    });

    return {
      booking: updated,
      payment,
    };
  });

  return updatedBooking;
}