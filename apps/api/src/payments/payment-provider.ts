export interface PaymentRequest {
  bookingId: string;
  amount: number;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  message?: string;
}

export interface PaymentProvider {
  pay(request: PaymentRequest): Promise<PaymentResult>;
}