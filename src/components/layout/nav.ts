import {
  Banknote,
  Bot,
  Building2,
  CalendarCheck,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  MessageCircle,
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
  badge?: 'vendors' | 'couriers' | 'support';
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
      { route: 'whatsapp', label: 'واتساب', icon: MessageCircle, badge: 'support' },
    ],
  },
  {
    title: 'السوق',
    items: [
      { route: 'vendor-applications', label: 'طلبات المورّدين', icon: Building2, badge: 'vendors' },
      { route: 'vendors', label: 'ملفات المورّدين', icon: Users },
      { route: 'listings', label: 'المنتجات', icon: Package },
      { route: 'couriers', label: 'طلبات المناديب', icon: Truck, badge: 'couriers' },
    ],
  },
  {
    title: 'الإدارة',
    items: [
      { route: 'users', label: 'الحسابات', icon: UserCog },
      { route: 'payments', label: 'المدفوعات', icon: Banknote },
      { route: 'integrations', label: 'الذكاء الاصطناعي', icon: Bot },
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
