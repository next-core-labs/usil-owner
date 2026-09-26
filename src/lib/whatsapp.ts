import type { ApplicationStatus, PublicUser, VendorApplication, VendorSocialsRow } from '../api/types.ts';

/**
 * The owner's WhatsApp desk: who the owner can message and what to say.
 * Messages go out through WhatsApp click-to-chat (wa.me) from the owner's own
 * WhatsApp, so no Business API credentials are involved.
 *
 * Mirrors `usil/src/utils/ownerWhatsApp.ts` — keep the number, templates and
 * wording identical so vendors hear the same voice from both admin surfaces.
 */

/** Usil's official WhatsApp: the owner sends from it, vendors and clients reach Usil on it. */
export const USIL_WHATSAPP = '+966595001957';
export const USIL_WHATSAPP_DISPLAY = '+966 59 500 1957';

/** Saudi local forms (05…, 5…) become the international digits wa.me expects. */
export function phoneToWhatsApp(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('966')) return digits;
  if (digits.startsWith('0') && digits.length >= 9) return `966${digits.slice(1)}`;
  if (digits.startsWith('5') && digits.length === 9) return `966${digits}`;
  return digits;
}

/** Opens a chat with `phone`, prefilled with `text`. Empty when the number is unusable. */
export function whatsappChatUrl(phone: string, text = ''): string {
  const to = phoneToWhatsApp(phone);
  // Anything shorter than a country code plus a subscriber number is not a phone.
  if (to.length < 10) return '';
  return text.trim() ? `https://wa.me/${to}?text=${encodeURIComponent(text.trim())}` : `https://wa.me/${to}`;
}

export type VendorContact = {
  key: string;
  name: string;
  projectName: string;
  email: string;
  /** The number the owner should message: business WhatsApp first, then the account phone. */
  phone: string;
  phoneSource: 'business_whatsapp' | 'account' | 'application' | 'none';
  /** Present when the vendor has a login; a pending applicant may not. */
  userId?: string;
  applicationStatus?: ApplicationStatus;
};

const emailKey = (email?: string) => String(email || '').trim().toLowerCase();

/**
 * One row per vendor, merged across the account list, vendor applications and
 * linked socials. Accounts and applications are joined by email, the only
 * field both carry.
 */
export function buildVendorContacts(input: {
  users: PublicUser[];
  applications: VendorApplication[];
  socials: VendorSocialsRow[];
}): VendorContact[] {
  const byKey = new Map<string, VendorContact>();

  for (const user of input.users) {
    if (user.role !== 'vendor') continue;
    const key = emailKey(user.email) || `user:${user.id}`;
    byKey.set(key, {
      key,
      name: user.name,
      projectName: '',
      email: user.email,
      phone: user.phone || '',
      phoneSource: user.phone ? 'account' : 'none',
      userId: user.id,
    });
  }

  for (const app of input.applications) {
    const key = emailKey(app.email) || `app:${app.id}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.projectName = app.projectName || existing.projectName;
      existing.applicationStatus = app.status;
      if (!existing.phone && app.phone) {
        existing.phone = app.phone;
        existing.phoneSource = 'application';
      }
      continue;
    }
    byKey.set(key, {
      key,
      name: `${app.firstName} ${app.familyName}`.trim(),
      projectName: app.projectName || '',
      email: app.email,
      phone: app.phone || '',
      phoneSource: app.phone ? 'application' : 'none',
      applicationStatus: app.status,
    });
  }

  for (const row of input.socials) {
    const handle = row.socials?.links?.find((link) => link.network === 'whatsapp')?.handle;
    if (!handle || !whatsappChatUrl(handle)) continue;
    const contact =
      byKey.get(emailKey(row.email)) ||
      Array.from(byKey.values()).find((item) => item.userId === row.vendorId);
    if (!contact) continue;
    contact.phone = handle;
    contact.phoneSource = 'business_whatsapp';
  }

  return Array.from(byKey.values()).sort((a, b) =>
    (a.projectName || a.name).localeCompare(b.projectName || b.name, 'ar'),
  );
}

export type VendorTemplateId =
  | 'greeting'
  | 'application_approved'
  | 'application_incomplete'
  | 'listing_review'
  | 'order_follow_up'
  | 'payout'
  | 'custom';

export const VENDOR_TEMPLATES: Array<{ id: VendorTemplateId; label: string; body: string }> = [
  {
    id: 'greeting',
    label: 'تحية وتواصل',
    body: 'السلام عليكم {name}،\nمعك إدارة يوصل. نحب نتواصل معك بخصوص {project}.',
  },
  {
    id: 'application_approved',
    label: 'قبول طلب الانضمام',
    body: 'أهلاً {name}،\nيسعدنا نبلغك أنه تم قبول {project} كمورّد في يوصل 🎉\nتقدر الآن تدخل لوحة المورد وتضيف منتجاتك.',
  },
  {
    id: 'application_incomplete',
    label: 'استكمال بيانات الطلب',
    body: 'أهلاً {name}،\nراجعنا طلب انضمام {project} ونحتاج نستكمل بعض البيانات قبل الاعتماد. متى يناسبك نتواصل؟',
  },
  {
    id: 'listing_review',
    label: 'مراجعة منتج',
    body: 'أهلاً {name}،\nعندنا ملاحظات بسيطة على أحد منتجات {project} في الكتالوج قبل نشره للعملاء.',
  },
  {
    id: 'order_follow_up',
    label: 'متابعة طلب عميل',
    body: 'أهلاً {name}،\nنتابع معك طلب عميل على {project}. نحتاج نتأكد من جاهزية التنفيذ في الموعد.',
  },
  {
    id: 'payout',
    label: 'المستحقات والتحويل',
    body: 'أهلاً {name}،\nنبلغك بخصوص مستحقات {project} في يوصل. نرجو التأكد من صحة بيانات الحساب البنكي (الآيبان).',
  },
  { id: 'custom', label: 'رسالة حرة', body: '' },
];

export function fillVendorTemplate(body: string, contact: Pick<VendorContact, 'name' | 'projectName'>): string {
  const name = contact.name || 'شريكنا';
  return body.replace(/\{name\}/g, name).replace(/\{project\}/g, contact.projectName || 'متجرك');
}

export function supportReplyText(name: string, message: string): string {
  const quoted = message.length > 160 ? `${message.slice(0, 160)}…` : message;
  return `أهلاً ${name || 'بك'}،\nمعك دعم يوصل بخصوص رسالتك:\n«${quoted}»\n\n`;
}
