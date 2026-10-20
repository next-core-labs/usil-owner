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
  /** Set when the order was cancelled or rejected; `refundHalalas` is what is owed back. */
  cancellation?: {
    cancelledBy: 'client' | 'vendor' | 'admin';
    refundPercent: number;
    refundHalalas: number;
    refundStatus: 'pending' | 'none' | 'not_applicable';
    note: string;
  };
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
  /** `quick`: signed up in the vendor console and completed the file from the dashboard. */
  signup?: 'quick';
  /** Products in the applicant's workspace — reviewable under «المنتجات» before approval. */
  listingCount?: number;
  /** What still blocks approval (`missingForApproval` on the server). */
  missing?: Array<{ key: string; label: string }>;
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
  email?: string;
  phone?: string;
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
  /** The vendor is still awaiting approval, so this product is not public yet. */
  vendorPending?: boolean;
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

/* ── WhatsApp (shared inbox on the Cloud API) — mirrors server/whatsapp ── */

export type WaSettings = {
  configured: boolean;
  phoneNumberId: string;
  businessAccountId: string;
  tokenMasked: string;
  appSecretSet: boolean;
  verifyToken: string;
  webhookUrl: string;
  displayPhone?: string;
  verifiedName?: string;
  graphVersion?: string;
};

export type WaSettingsDraft = {
  accessToken?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  appSecret?: string;
};

export type WaPerson = { id: string; name: string };

export type WaConversation = {
  waId: string;
  name: string;
  phone: string;
  lastMessage: { text: string; type: string; direction: 'in' | 'out'; at: string } | null;
  lastInboundAt: string | null;
  /** WhatsApp only allows free-form replies within 24h of the customer's last message. */
  windowOpen: boolean;
  unread: number;
  assignedTo: WaPerson | null;
  status: 'open' | 'closed';
  updatedAt: string;
};

export type WaMessageStatus = 'received' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export type WaMessage = {
  id: string;
  wamid: string;
  direction: 'in' | 'out';
  type: string;
  text: string;
  caption?: string;
  mediaId?: string;
  mimeType?: string;
  fileName?: string;
  location: { latitude: number; longitude: number; name?: string; address?: string } | null;
  status: WaMessageStatus;
  error: string | null;
  at: string;
  sentBy: WaPerson | null;
  via: 'dashboard' | 'phone' | 'customer';
  template: { name: string; language: string } | null;
};

export type WaTemplate = { name: string; language: string; category: string; body: string; paramCount: number };

export type WaTeamMember = { id: string; name: string; role: string };

/** Mirrors `server/leads/vendor-leads.ts`. */
export type LeadStatus = 'new' | 'contacted' | 'interested' | 'joined' | 'declined';

/** A supplier the owner wants to invite — a contact, not an account. */
export type VendorLead = {
  id: string;
  name: string;
  phone: string;
  city: string;
  activity: string;
  note: string;
  status: LeadStatus;
  source: 'import' | 'manual';
  createdAt: string;
  updatedAt: string;
  /** This number already belongs to a vendor account on Usil. */
  alreadyVendor?: boolean;
};

export type LeadDraft = { name?: string; phone: string; city?: string; activity?: string; note?: string };

export type LeadImportResult = {
  added: number;
  duplicates: number;
  invalid: Array<{ row: number; phone: string; error: string }>;
  total: number;
};

/** Where the owner is in following a message up — mirrors `server/support/support-store.ts`. */
export type SupportStatus = 'new' | 'replied' | 'closed';

export type SupportMessage = {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  /** The server backfills 'new' on rows written before statuses existed. */
  status: SupportStatus;
  updatedAt?: string;
  createdAt: string;
};

/** One vendor's linked socials, from `/api/admin/vendor-socials`. */
export type VendorSocialsRow = {
  vendorId: string;
  name: string;
  email?: string;
  projectName?: string;
  socials?: { links?: Array<{ network: string; handle: string }> };
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

/** What approving a courier application did to the matching account. */
export type CourierAccountOutcome =
  | { status: 'promoted' | 'already_courier'; userId: string }
  | { status: 'protected_role'; userId: string; role: AccountRole }
  | { status: 'not_found'; userId: string }
  | { status: 'not_linked' };

/**
 * In-app chat, mirrored from `server/chat/chat-store.ts`. The owner side only
 * ever sees `vendor_owner` threads, and every admin reads the same one per
 * vendor — it is a shared inbox, so `unread` is the team's, not one admin's.
 */
export type ChatSide = 'client' | 'vendor' | 'owner';

/** What a message is about — shown above it as «بخصوص: …». */
export type ChatContext = { type: 'listing' | 'booking'; id: string; title: string };

export type ChatMessage = {
  id: string;
  /** Position in its thread, 1-based and never reused. */
  seq: number;
  side: ChatSide;
  senderId: string;
  /** For owner-side messages, the admin who answered. */
  senderName: string;
  body: string;
  context?: ChatContext;
  createdAt: string;
};

type ConversationBase = {
  id: string;
  kind: 'vendor_owner';
  vendorId: string;
  vendorName: string;
  createdAt: string;
  updatedAt: string;
};

export type ConversationSummary = ConversationBase & { lastMessage: ChatMessage | null; unread: number };

export type Conversation = ConversationBase & { messages: ChatMessage[] };

/** A vendor's withdrawal request (`/api/admin/payouts`). Money moves by hand in the bank. */
export type PayoutStatus = 'requested' | 'approved' | 'paid' | 'rejected';

export type PayoutRequest = {
  id: string;
  vendorId: string;
  vendorName: string;
  /** The vendor account's email — where the decision notice goes. */
  vendorEmail: string;
  /** Riyals. */
  amount: number;
  /** `SA` + 22 digits. */
  iban: string;
  accountHolder: string;
  bankName: string;
  status: PayoutStatus;
  note: string;
  adminNote: string;
  /** Bank transfer reference, set when marked paid. */
  reference: string;
  createdAt: string;
  updatedAt: string;
  decidedBy: string;
};
