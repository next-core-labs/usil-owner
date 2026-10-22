import { api } from './client.ts';
import type {
  AccountRole,
  AiProviderId,
  ChatMessage,
  CityRequest,
  Conversation,
  ConversationSummary,
  CourierAccountOutcome,
  CourierApplication,
  DemandStatus,
  LeadDraft,
  LeadImportResult,
  LeadStatus,
  VendorLead,
  WaConversation,
  WaMessage,
  WaSettings,
  WaSettingsDraft,
  WaTeamMember,
  WaTemplate,
  HealthPayload,
  IntegrationsPayload,
  MoyasarStatus,
  PayoutRequest,
  PayoutStatus,
  PlatformBooking,
  PublicUser,
  SeoSettings,
  SiteAppearance,
  SupportMessage,
  SupportStatus,
  VendorApplication,
  VendorHub,
  VendorListing,
  VendorSocialsRow,
} from './types.ts';

type Listed<T> = { data: T[] };
type Wrapped<T> = { data: T };

export const auth = {
  /** `user` is null when no session cookie is present — not an error. */
  me: () => api.get<{ user: PublicUser | null }>('/api/auth/me'),
  /**
   * The server reads the address from `identifier` and requires it to contain
   * an `@` when no phone is supplied, so sign-in sends `identifier`, not `email`.
   */
  login: (identifier: string, password: string, remember: boolean) =>
    api.post<{ user: PublicUser; needsEmailVerification: boolean }>('/api/auth/login', {
      identifier,
      password,
      remember,
    }),
  logout: () => api.post<unknown>('/api/auth/logout'),
};

export const health = {
  read: () => api.get<HealthPayload>('/api/health'),
};

export const bookings = {
  list: () => api.get<Listed<PlatformBooking>>('/api/bookings').then((r) => r.data),
  setStatus: (id: string, status: string) =>
    api.patch<{ booking: PlatformBooking }>(`/api/bookings/${encodeURIComponent(id)}`, { status }),
  remove: (id: string) => api.delete<unknown>(`/api/bookings/${encodeURIComponent(id)}`),
};

export const users = {
  list: () => api.get<Listed<PublicUser>>('/api/admin/users').then((r) => r.data),
  create: (input: { name: string; email: string; phone: string; password: string; role: AccountRole }) =>
    api.post<{ user: PublicUser }>('/api/admin/users', input),
  update: (
    id: string,
    input: Partial<{
      name: string;
      email: string;
      phone: string;
      password: string;
      role: AccountRole;
      emailVerified: boolean;
    }>,
  ) => api.patch<{ user: PublicUser }>(`/api/admin/users/${encodeURIComponent(id)}`, input),
  remove: (id: string) => api.delete<unknown>(`/api/admin/users/${encodeURIComponent(id)}`),
};

export const vendorApplications = {
  list: () => api.get<Listed<VendorApplication>>('/api/admin/vendor-applications').then((r) => r.data),
  approve: (id: string) =>
    api.post<{ application: VendorApplication }>(
      `/api/admin/vendor-applications/${encodeURIComponent(id)}/approve`,
    ),
  reject: (id: string, reason: string) =>
    api.post<{ application: VendorApplication }>(
      `/api/admin/vendor-applications/${encodeURIComponent(id)}/reject`,
      { reason },
    ),
};

export const couriers = {
  list: () => api.get<Listed<CourierApplication>>('/api/admin/couriers').then((r) => r.data),
  approve: (id: string) =>
    api.post<{
      application: CourierApplication;
      account?: CourierAccountOutcome | null;
      accountLinked?: boolean;
      message?: string;
    }>(`/api/admin/couriers/${encodeURIComponent(id)}/approve`),
  reject: (id: string, reason: string) =>
    api.post<{ application: CourierApplication }>(
      `/api/admin/couriers/${encodeURIComponent(id)}/reject`,
      { reason },
    ),
};

export const listings = {
  list: () => api.get<Listed<VendorListing>>('/api/admin/listings').then((r) => r.data),
  update: (id: string, input: Partial<Pick<VendorListing, 'fulfillment' | 'bookingMode' | 'price'>>) =>
    api.patch<{ listing: VendorListing }>(`/api/admin/listings/${encodeURIComponent(id)}`, input),
};

export const vendorHubs = {
  list: () => api.get<Listed<VendorHub>>('/api/admin/vendor-hubs').then((r) => r.data),
};

export const cityRequests = {
  list: () => api.get<Listed<CityRequest>>('/api/admin/city-requests').then((r) => r.data),
  setStatus: (id: string, status: DemandStatus) =>
    api.patch<Wrapped<CityRequest>>(`/api/admin/city-requests/${encodeURIComponent(id)}`, { status }),
};

/** «صندوق واتساب»: Usil's one WhatsApp number, read and answered by the whole team. */
export const whatsapp = {
  settings: () => api.get<Wrapped<WaSettings>>('/api/admin/whatsapp/settings').then((r) => r.data),
  saveSettings: (draft: WaSettingsDraft) =>
    api.put<Wrapped<WaSettings>>('/api/admin/whatsapp/settings', draft).then((r) => r.data),
  testSettings: () =>
    api.post<Wrapped<{ displayPhone: string; verifiedName: string }>>('/api/admin/whatsapp/settings/test').then((r) => r.data),
  conversations: () => api.get<Listed<WaConversation>>('/api/admin/whatsapp/conversations').then((r) => r.data),
  unread: () => api.get<Wrapped<{ count: number }>>('/api/admin/whatsapp/unread').then((r) => r.data.count),
  messages: (waId: string, after?: string) =>
    api
      .get<Wrapped<{ conversation: WaConversation; messages: WaMessage[] }>>(
        `/api/admin/whatsapp/conversations/${encodeURIComponent(waId)}/messages${after ? `?after=${encodeURIComponent(after)}` : ''}`,
      )
      .then((r) => r.data),
  markRead: (waId: string) => api.post<unknown>(`/api/admin/whatsapp/conversations/${encodeURIComponent(waId)}/read`),
  send: (waId: string, text: string) =>
    api.post<Wrapped<WaMessage>>(`/api/admin/whatsapp/conversations/${encodeURIComponent(waId)}/messages`, { text }).then((r) => r.data),
  sendTemplate: (waId: string, name: string, language: string, params: string[]) =>
    api
      .post<Wrapped<WaMessage>>(`/api/admin/whatsapp/conversations/${encodeURIComponent(waId)}/template`, { name, language, params })
      .then((r) => r.data),
  start: (input: { phone: string; name?: string; template: string; language: string; params: string[] }) =>
    api.post<Wrapped<{ conversation: WaConversation; message: WaMessage }>>('/api/admin/whatsapp/start', input).then((r) => r.data),
  update: (waId: string, patch: { assignedTo?: string | null; status?: 'open' | 'closed'; name?: string }) =>
    api.patch<Wrapped<WaConversation>>(`/api/admin/whatsapp/conversations/${encodeURIComponent(waId)}`, patch).then((r) => r.data),
  templates: () => api.get<Listed<WaTemplate>>('/api/admin/whatsapp/templates').then((r) => r.data),
  team: () => api.get<Listed<WaTeamMember>>('/api/admin/whatsapp/team').then((r) => r.data),
  /** Same-origin, so the session cookie authorises `<img src>` / `<audio src>` directly. */
  mediaUrl: (mediaId: string) => `/api/admin/whatsapp/media/${encodeURIComponent(mediaId)}`,
};

/** «أرقام المورّدين»: suppliers to invite, imported from a sheet or added by hand. */
export const vendorLeads = {
  list: () => api.get<Listed<VendorLead>>('/api/admin/vendor-leads').then((r) => r.data),
  importRows: (rows: LeadDraft[]) =>
    api.post<Wrapped<LeadImportResult>>('/api/admin/vendor-leads/import', { rows }).then((r) => r.data),
  add: (draft: LeadDraft) => api.post<Wrapped<VendorLead>>('/api/admin/vendor-leads', draft).then((r) => r.data),
  update: (id: string, patch: { status?: LeadStatus; note?: string }) =>
    api.patch<Wrapped<VendorLead>>(`/api/admin/vendor-leads/${encodeURIComponent(id)}`, patch).then((r) => r.data),
  remove: (id: string) => api.delete<unknown>(`/api/admin/vendor-leads/${encodeURIComponent(id)}`),
};

export const vendorSocials = {
  list: () => api.get<Listed<VendorSocialsRow>>('/api/admin/vendor-socials').then((r) => r.data),
};

export const support = {
  list: () => api.get<Listed<SupportMessage>>('/api/admin/support-messages').then((r) => r.data),
  /** The updated row comes back under `message`, not `data`. */
  setStatus: (id: string, status: SupportStatus) =>
    api
      .patch<{ message: SupportMessage }>(`/api/admin/support-messages/${encodeURIComponent(id)}`, { status })
      .then((r) => r.message),
};

export const chats = {
  /** Newest activity first. */
  list: () => api.get<Listed<ConversationSummary>>('/api/chats').then((r) => r.data),
  unread: () => api.get<Wrapped<{ count: number }>>('/api/chats/unread').then((r) => r.data.count),
  /**
   * There are no empty threads: this starts the thread with its first message,
   * or appends to the one the team already has with that vendor.
   */
  start: (vendorId: string, body: string) =>
    api.post<Wrapped<Conversation>>('/api/chats', { vendorId, body }).then((r) => r.data),
  /** With `after`, only newer messages come back; an id the server no longer has returns them all. */
  get: (id: string, after?: string) =>
    api
      .get<Wrapped<Conversation>>(
        `/api/chats/${encodeURIComponent(id)}${after ? `?after=${encodeURIComponent(after)}` : ''}`,
      )
      .then((r) => r.data),
  send: (id: string, body: string) =>
    api.post<Wrapped<ChatMessage>>(`/api/chats/${encodeURIComponent(id)}/messages`, { body }).then((r) => r.data),
  markRead: (id: string) => api.post<unknown>(`/api/chats/${encodeURIComponent(id)}/read`),
};

export const moyasar = {
  read: () => api.get<Wrapped<MoyasarStatus>>('/api/admin/moyasar').then((r) => r.data),
  save: (input: { secretKey?: string; publishableKey?: string; clearPublishable?: boolean }) =>
    api.put<Wrapped<MoyasarStatus> & { webhook: { ok: boolean; status?: number; error?: string } }>(
      '/api/admin/moyasar',
      input,
    ),
};

export const integrations = {
  read: () => api.get<Wrapped<IntegrationsPayload>>('/api/admin/integrations').then((r) => r.data),
  /**
   * The request body is FLAT — `sanitizeIntegrations` reads `body[provider]`,
   * not `body.providers[provider]`. Only the response nests under `providers`,
   * so the two shapes are deliberately asymmetric; sending the response shape
   * back is silently ignored and nothing saves.
   */
  save: (input: {
    defaultProvider?: AiProviderId;
    providers?: Partial<Record<AiProviderId, { apiKey?: string; model?: string; clearKey?: boolean }>>;
  }) => {
    const body: Record<string, unknown> = {};
    if (input.defaultProvider) body.defaultProvider = input.defaultProvider;
    for (const [provider, config] of Object.entries(input.providers ?? {})) {
      body[provider] = config;
    }
    return api.put<Wrapped<IntegrationsPayload>>('/api/admin/integrations', body).then((r) => r.data);
  },
  test: (provider: AiProviderId) =>
    api.post<{ provider: AiProviderId; message: string }>('/api/admin/integrations/test', { provider }),
};

export const seo = {
  read: () => api.get<Wrapped<SeoSettings>>('/api/admin/seo').then((r) => r.data),
  save: (input: Partial<SeoSettings>) =>
    api.put<Wrapped<SeoSettings>>('/api/admin/seo', input).then((r) => r.data),
};

export const siteAppearance = {
  read: () => api.get<Wrapped<SiteAppearance>>('/api/site/appearance').then((r) => r.data),
  save: (input: Pick<SiteAppearance, 'heroCards'>) =>
    api.put<Wrapped<SiteAppearance>>('/api/admin/site/appearance', input).then((r) => r.data),
  /** Through the shared upload route; the server keeps only JPG/PNG/WEBP under 5 MB. */
  uploadHeroImage: (dataUrl: string) =>
    api.post<{ url?: string }>('/api/uploads', { purpose: 'hero', dataUrl }).then((r) => String(r.url || '')),
};

export const payouts = {
  list: () => api.get<Listed<PayoutRequest>>('/api/admin/payouts').then((r) => r.data),
  /** `paid` requires the bank transfer `reference`. */
  decide: (id: string, input: { status: Exclude<PayoutStatus, 'requested'>; reference?: string; adminNote?: string }) =>
    api.patch<Wrapped<PayoutRequest>>(`/api/admin/payouts/${encodeURIComponent(id)}`, input).then((r) => r.data),
};
