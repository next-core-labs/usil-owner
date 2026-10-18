import {
  Banknote,
  Bot,
  Building2,
  Contact,
  CalendarCheck,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  MessageCircle,
  MessageSquareText,
  MessagesSquare,
  Package,
  Search,
  Truck,
  UserCog,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  route: string;
  label: string;
  icon: LucideIcon;
  /** Which pending counter, if any, badges this item. */
  badge?: 'vendors' | 'couriers' | 'support' | 'chats' | 'whatsapp';
  /** «مدير كل الحسابات» only — the server answers accounts_manager with 403. */
  adminOnly?: boolean;
};

export type NavGroup = { title: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    title: 'التشغيل',
    items: [
      { route: 'overview', label: 'نظرة عامة', icon: LayoutDashboard },
      { route: 'bookings', label: 'الحجوزات', icon: CalendarCheck },
      { route: 'city-requests', label: 'طلبات المدن', icon: MapPin },
      { route: 'support', label: 'رسائل الدعم', icon: LifeBuoy },
      { route: 'wa-inbox', label: 'صندوق واتساب', icon: MessageSquareText, badge: 'whatsapp' },
      { route: 'whatsapp', label: 'روابط واتساب', icon: MessageCircle, badge: 'support' },
      { route: 'chats', label: 'المحادثات', icon: MessagesSquare, badge: 'chats' },
    ],
  },
  {
    title: 'السوق',
    items: [
      { route: 'vendor-applications', label: 'طلبات المورّدين', icon: Building2, badge: 'vendors' },
      { route: 'vendors', label: 'ملفات المورّدين', icon: Users },
      { route: 'vendor-leads', label: 'أرقام المورّدين', icon: Contact },
      { route: 'listings', label: 'المنتجات', icon: Package },
      { route: 'couriers', label: 'طلبات المناديب', icon: Truck, badge: 'couriers' },
    ],
  },
  {
    title: 'الإدارة',
    items: [
      { route: 'users', label: 'الحسابات', icon: UserCog },
      { route: 'payments', label: 'المدفوعات', icon: Banknote },
      { route: 'integrations', label: 'الذكاء الاصطناعي', icon: Bot, adminOnly: true },
      { route: 'seo', label: 'الظهور والفهرسة', icon: Search },
    ],
  },
];

export function labelForRoute(route: string): string {
  for (const group of NAV) {
    const found = group.items.find((item) => item.route === route);
    if (found) return found.label;
  }
  return 'نظرة عامة';
}
