import { api } from './client.ts';
import type {
  AccountRole,
  AiProviderId,
  CityRequest,
  CourierApplication,
  DemandStatus,
  HealthPayload,
  IntegrationsPayload,
  MoyasarStatus,
  PlatformBooking,
  PublicUser,
  SeoSettings,
  SupportMessage,
  VendorApplication,
  VendorHub,
  VendorListing,
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
    api.post<{ application: CourierApplication }>(`/api/admin/couriers/${encodeURIComponent(id)}/approve`),
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

export const support = {
  list: () => api.get<Listed<SupportMessage>>('/api/admin/support-messages').then((r) => r.data),
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
