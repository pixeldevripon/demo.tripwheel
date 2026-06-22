// Mirrors backend: src/operators/dto/operator.dto.ts (operator-scoped settings).
// Operators self-manage these. Personal info + social media live in the profile page,
// so they are intentionally NOT modelled here.

export interface OperatorCompanyInfo {
  companyName: string | null;
  companyEmail: string | null;
  companyCountry: string | null;
  companyCity: string | null;
  companyPhone: string | null;
  plannedTripCount: number | null;
  yearlySalesTarget: number | null;
}

export interface UpdateOperatorCompanyInfoPayload {
  companyName?: string;
  companyEmail?: string;
  companyCountry?: string;
  companyCity?: string;
  companyPhone?: string;
  plannedTripCount?: number;
  yearlySalesTarget?: number;
}

/** GET response - secrets are masked by the backend (e.g. "********1234") or null. */
export interface OperatorStripeConfig {
  publishableKey: string;
  secretKey: string | null;
  webhookSecret: string | null;
  paymentMethods: string[];
  isActive: boolean;
}

export interface UpdateOperatorStripeConfigPayload {
  publishableKey?: string;
  /** Omit to keep the existing key; only send when a new value is entered. */
  secretKey?: string;
  webhookSecret?: string;
  paymentMethods?: string[];
  isActive?: boolean;
}

export interface OperatorMollieConfig {
  apiKey: string | null;
  paymentMethods: string[];
  isActive: boolean;
}

export interface UpdateOperatorMollieConfigPayload {
  apiKey?: string;
  paymentMethods?: string[];
  isActive?: boolean;
}
