import { Loader2 } from 'lucide-react';
import { SessionProvider, isOwner, useSession } from './state/SessionContext.tsx';
import { ToastProvider } from './state/ToastContext.tsx';
import { PendingProvider } from './state/PendingContext.tsx';
import { Shell } from './components/layout/Shell.tsx';
import { useRoute } from './lib/router.ts';
import { Login, NotAuthorized } from './screens/Login.tsx';
import { Overview } from './screens/Overview.tsx';
import { Bookings } from './screens/Bookings.tsx';
import { VendorApplications } from './screens/VendorApplications.tsx';
import { Vendors } from './screens/Vendors.tsx';
import { Listings } from './screens/Listings.tsx';
import { Couriers } from './screens/Couriers.tsx';
import { Users } from './screens/Users.tsx';
import { CityRequests } from './screens/CityRequests.tsx';
import { Support } from './screens/Support.tsx';
import { WhatsApp } from './screens/WhatsApp.tsx';
import { Chats } from './screens/Chats.tsx';
import { Payments } from './screens/Payments.tsx';
import { Integrations } from './screens/Integrations.tsx';
import { Seo } from './screens/Seo.tsx';

function Screen() {
  const route = useRoute();
  switch (route) {
    case 'bookings':
      return <Bookings />;
    case 'vendor-applications':
      return <VendorApplications />;
    case 'vendors':
      return <Vendors />;
    case 'listings':
      return <Listings />;
    case 'couriers':
      return <Couriers />;
    case 'users':
      return <Users />;
    case 'city-requests':
      return <CityRequests />;
    case 'support':
      return <Support />;
    case 'whatsapp':
      return <WhatsApp />;
    case 'chats':
      return <Chats />;
    case 'payments':
      return <Payments />;
    case 'integrations':
      return <Integrations />;
    case 'seo':
      return <Seo />;
    default:
      return <Overview />;
  }
}

function Gate() {
  const { user, loading, signOut } = useSession();

  if (loading) {
    return (
      <div className="grid min-h-full place-items-center">
        <Loader2 size={24} className="animate-spin text-ink-muted" aria-label="جارٍ التحميل" />
      </div>
    );
  }

  if (!user) return <Login />;
  if (!isOwner(user)) return <NotAuthorized name={user.name} onSignOut={() => void signOut()} />;

  return (
    <PendingProvider>
      <Shell>
        <Screen />
      </Shell>
    </PendingProvider>
  );
}

export function App() {
  return (
    <ToastProvider>
      <SessionProvider>
        <Gate />
      </SessionProvider>
    </ToastProvider>
  );
}
