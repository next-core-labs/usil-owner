import type { AccountRole, ApplicationStatus, DemandStatus } from '../api/types.ts';

/** Mirrors `server/auth/roles.ts` — keep the wording identical to the backend. */
export const ROLE_LABEL: Record<AccountRole, string> = {
  client: 'عميل',
  vendor: 'مورّد',
  admin: 'مدير كل الحسابات',
  accounts_manager: 'مدير الحسابات',
  courier: 'مندوب توصيل',
};

export const ROLE_OPTIONS: AccountRole[] = ['client', 'vendor', 'courier', 'accounts_manager', 'admin'];

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: 'قيد المراجعة',
  approved: 'معتمد',
  rejected: 'مرفوض',
};

/** Mirrors `DEMAND_STATUS_AR` in `core/data/cityDemand.ts` — the server rejects
 *  any value outside this set, so the wording and the keys must match it exactly. */
export const DEMAND_STATUS_LABEL: Record<DemandStatus, string> = {
  new: 'جديد',
  contacted: 'تم التواصل',
  matched: 'تمت المطابقة',
  closed: 'مغلق',
};

export const DEMAND_STATUSES: DemandStatus[] = ['new', 'contacted', 'matched', 'closed'];

/** Mirrors `server/vendors/vendor-listings.ts`. */
export const FULFILLMENT_LABEL: Record<string, string> = {
  hour: 'يوصل ساعة',
  same_day: 'يوصل اليوم',
  tomorrow: 'يوصل بكرا',
  instant: 'حجز فوري',
};

export const BOOKING_MODE_LABEL: Record<string, string> = {
  instant: 'حجز فوري',
  approval: 'بموافقة المورّد',
};

export const CATEGORY_LABEL: Record<string, string> = {
  hospitality: 'ضيافة وقهوة',
  buffet: 'بوفيه ومأكولات',
  decoration: 'تنسيق وديكور',
  photography: 'تصوير وتوثيق',
  entertainment: 'ألعاب وترفيه',
  halls: 'قاعات واستراحات',
  rental: 'كراسي وطاولات وتأجير',
  servers: 'صبابين وصبابات',
  av: 'صوت وإضاءة وشاشات',
  tents: 'خيام ومظلات',
  zaffa: 'زفة وفرق شعبية',
  cakes: 'كيك وحلويات المناسبات',
  invitations: 'دعوات وهدايا تذكارية',
  parking: 'تنظيم مواقف وحشود',
  condolence: 'عزاء وتجهيز مجالس',
};

export const AI_PROVIDER_LABEL: Record<string, string> = {
  gemini: 'Gemini — جوجل',
  anthropic: 'Claude — أنثروبيك',
  openai: 'OpenAI',
};

export function labelFor(map: Record<string, string>, key: string | undefined | null): string {
  if (!key) return '—';
  return map[key] || key;
}
