import crypto from "node:crypto";

import {
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
} from "./payment-provider";

export class MockPaymentProvider implements PaymentProvider {
  async pay(request: PaymentRequest): Promise<PaymentResult> {
    if (request.amount <= 0) {
      return {
        success: false,
        message: "Payment amount must be greater than zero",
      };
    }

    const transactionId = `MOCK_${crypto
      .randomBytes(8)
      .toString("hex")
      .toUpperCase()}`;

    return {
      success: true,
      transactionId,
      message: "Mock payment successful",
    };
  }
}