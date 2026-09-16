/**
 * Shapes mirrored from the backend (`../usil backend/server/**`). Only the
 * fields this dashboard actually reads are declared — the API returns more on
 * some rows, and widening a type here without checking the server is how a
 * dashboard starts rendering `undefined`.
 */

export type AccountRole = 'client' | 'vendor' | 'admin' | 'accounts_manager' | 'courier';

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: AccountRole;
  avatarUrl: string;
  emailVerified: boolean;
};

export type PlatformBooking = {
  id: string;
  name: string;
  phone: string;
  email: string;
  serviceName: string;
  notes: string;
  city: string;
  eventDate: string;
  paymentMethod: string;
  settlement: string;
  totalAmount: number;
  bookingMode: 'instant' | 'approval';
  status: string;
  paymentStatus: 'unpaid' | 'paid';
  /** `YYYY-MM-DD HH:mm` — the server trims the ISO string, it is not parseable as-is. */
  createdAt: string;
  moyasarInvoiceId?: string;
  moyasarPaymentId?: string;
  paymentUrl?: string;
};

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export type VendorApplication = {
  id: string;
  firstName: string;
  fatherName: string;
  familyName: string;
  projectName: string;
  nationalId: string;
  email: string;
  phone: string;
  commercialRegister?: string;
  projectType: string;
  bankName: string;
  iban: string;
  accountHolderName: string;
  fulfillment: string[];
  logoUrl?: string;
  status: ApplicationStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectReason?: string;
};

export type CourierApplication = {
  id: string;
  firstName: string;
  familyName: string;
  nationalId: string;
  plateLetters: string;
  plateNumbers: string;
  carType: string;
  carTypeOther?: string;
  fulfillment: string[];
  products: Array<{ name?: string; price?: number }>;
  status: ApplicationStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectReason?: string;
};

export type VendorListing = {
  id: string;
  vendorId: string;
  vendorName?: string;
  title: string;
  category: string;
  shortDesc?: string;
  price: number;
  priceUnit: string;
  cities: string[];
  images: string[];
  fulfillment: string[];
  bookingMode: 'instant' | 'approval';
  createdAt?: string;
  updatedAt?: string;
};

export type DemandStatus = 'new' | 'contacted' | 'matched' | 'closed';

export type CityRequest = {
  id: string;
  name: string;
  phone: string;
  city: string;
  occasion: string;
  eventDate: string;
  notes: string;
  status: DemandStatus;
  createdAt: string;
  updatedAt: string;
};

export type SupportMessage = {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  createdAt: string;
};

export type MoyasarStatus = {
  configured: boolean;
  form: boolean;
  live: boolean;
  secretMasked: string;
  secretSource: 'saved' | 'env' | 'none';
  publishableMasked: string;
  publishableSource: 'saved' | 'env' | 'none';
  webhookUrl: string;
  webhookSecretSet: boolean;
  updatedAt: string | null;
};

export type AiProviderId = 'gemini' | 'anthropic' | 'openai';

export type IntegrationsPayload = {
  defaultProvider: AiProviderId;
  activeProvider: AiProviderId | null;
  providers: Record<
    AiProviderId,
    { configured: boolean; keyMasked: string; keySource: 'saved' | 'env' | 'none'; model: string }
  >;
  cursor: { supported: boolean; note: string };
  updatedAt: string;
};

export type SeoSettings = {
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  keywords: string;
  keywordsEn: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogSiteName: string;
  twitterCard: 'summary' | 'summary_large_image';
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  canonicalBaseUrl: string;
  robotsTxt: string;
  googleSiteVerification: string;
  googleHtmlFileToken: string;
  analyticsId: string;
  updatedAt: string;
};

export type HealthPayload = {
  status: string;
  uptime: number;
  timestamp: string;
  server: string;
  database: string;
  totalBookings: number;
};

export type VendorHub = {
  vendorId: string;
  name: string;
  projectName: string;
  email: string;
  status: ApplicationStatus;
  listingCount: number;
  bookingCount: number;
  isOwn: boolean;
};
