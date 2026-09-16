import { useMemo } from 'react';
import {
  Activity,
  Banknote,
  Building2,
  CalendarCheck,
  CheckCircle2,
  CircleAlert,
  Package,
  Truck,
  Users,
} from 'lucide-react';
import {
  bookings as bookingsApi,
  couriers as couriersApi,
  health as healthApi,
  listings as listingsApi,
  moyasar as moyasarApi,
  users as usersApi,
  vendorApplications as vendorApplicationsApi,
} from '../api/endpoints.ts';
import type { PlatformBooking } from '../api/types.ts';
import { useResource } from '../lib/useResource.ts';
import { count, dayKey, dayLabel, parseServerDate, percent, sar, sarCompact, uptime } from '../lib/format.ts';
import { AreaChart, type AreaPoint } from '../components/charts/AreaChart.tsx';
import { BarChart, SplitBar } from '../components/charts/BarChart.tsx';
import { StatTile } from '../components/ui/StatTile.tsx';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorNote, PageHeader, Skeleton } from '../components/ui/primitives.tsx';
import { navigate } from '../lib/router.ts';

const TREND_DAYS = 14;

function lastDays(days: number): string[] {
  const today = new Date();
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    keys.push(dayKey(date));
  }
  return keys;
}

/** Paid revenue per day. Unpaid bookings are demand, not money. */
function revenueTrend(rows: PlatformBooking[]): AreaPoint[] {
  const buckets = new Map<string, number>(lastDays(TREND_DAYS).map((key) => [key, 0]));
  for (const row of rows) {
    if (row.paymentStatus !== 'paid') continue;
    const created = parseServerDate(row.createdAt);
    if (!created) continue;
    const key = dayKey(created);
    if (!buckets.has(key)) continue;
    buckets.set(key, (buckets.get(key) || 0) + (Number(row.totalAmount) || 0));
  }
  return Array.from(buckets.entries()).map(([key, value]) => ({ key, label: dayLabel(key), value }));
}

export function Overview() {
  const resource = useResource(async () => {
    const [bookingRows, vendorRows, courierRows, userRows, listingRows, healthRow, payments] =
      await Promise.all([
        bookingsApi.list(),
        vendorApplicationsApi.list(),
        couriersApi.list(),
        usersApi.list(),
        listingsApi.list(),
        healthApi.read().catch(() => null),
        moyasarApi.read().catch(() => null),
      ]);
    return { bookingRows, vendorRows, courierRows, userRows, listingRows, healthRow, payments };
  }, []);

  const model = useMemo(() => {
    if (!resource.data) return null;
    const { bookingRows, vendorRows, courierRows, userRows, listingRows } = resource.data;

    const paid = bookingRows.filter((row) => row.paymentStatus === 'paid');
    const paidRevenue = paid.reduce((sum, row) => sum + (Number(row.totalAmount) || 0), 0);
    const pipeline = bookingRows
      .filter((row) => row.paymentStatus !== 'paid')
      .reduce((sum, row) => sum + (Number(row.totalAmount) || 0), 0);

    const byStatus = new Map<string, number>();
    for (const row of bookingRows) {
      const key = row.status || 'غير محدد';
      byStatus.set(key, (byStatus.get(key) || 0) + 1);
    }

    return {
      trend: revenueTrend(bookingRows),
      paidRevenue,
      pipeline,
      paidCount: paid.length,
      bookingCount: bookingRows.length,
      statusRows: Array.from(byStatus.entries())
        .map(([key, value]) => ({ key, label: key, value }))
        .sort((a, b) => b.value - a.value),
      pendingVendors: vendorRows.filter((row) => row.status === 'pending'),
      pendingCouriers: courierRows.filter((row) => row.status === 'pending'),
      vendorCount: userRows.filter((row) => row.role === 'vendor').length,
      clientCount: userRows.filter((row) => row.role === 'client').length,
      listingCount: listingRows.length,
    };
  }, [resource.data]);

  if (resource.error && !resource.data) {
    return (
      <>
        <PageHeader title="نظرة عامة" />
        <ErrorNote message={resource.error} onRetry={() => void resource.reload()} />
      </>
    );
  }

  if (!model) {
    return (
      <>
        <PageHeader title="نظرة عامة" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-[104px]" />
          ))}
        </div>
        <Skeleton className="h-[300px]" />
      </>
    );
  }

  const { healthRow, payments } = resource.data!;
  const trendValues = model.trend.map((point) => point.value);
  const actionCount = model.pendingVendors.length + model.pendingCouriers.length;

  return (
    <>
      <PageHeader
        title="نظرة عامة"
        subtitle="حالة المنصة الآن — الإيراد المحصّل، الحجوزات، وما ينتظر قرارك."
        action={
          <Button size="sm" onClick={() => void resource.reload()} busy={resource.refreshing}>
            تحديث
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="الإيراد المحصّل"
          value={sar(model.paidRevenue)}
          hint={`من ${count(model.paidCount)} حجز مدفوع`}
          icon={<Banknote size={16} />}
          trend={trendValues}
        />
        <StatTile
          label="الحجوزات"
          value={count(model.bookingCount)}
          hint={`${percent(model.paidCount, model.bookingCount)} منها مدفوعة`}
          icon={<CalendarCheck size={16} />}
        />
        <StatTile
          label="قيد التحصيل"
          value={sar(model.pipeline)}
          hint="حجوزات أُنشئت ولم تُدفع بعد"
          icon={<CircleAlert size={16} />}
        />
        <StatTile
          label="المورّدون المعتمدون"
          value={count(model.vendorCount)}
          hint={`${count(model.listingCount)} منتج في السوق`}
          icon={<Users size={16} />}
        />
      </div>

      {/* The trend gets the full width; the paid/unpaid split rides in the same
          card because it answers the same question the chart raises. */}
      <Card>
        <CardHeader
          title="الإيراد المحصّل يومياً"
          subtitle={`آخر ${TREND_DAYS} يوماً — المبالغ المدفوعة فقط`}
        />
        {trendValues.some((value) => value > 0) ? (
          <AreaChart points={model.trend} formatValue={sarCompact} height={280} />
        ) : (
          <EmptyState
            icon={<Activity size={22} />}
            title="لا يوجد إيراد محصّل في هذه الفترة"
            body="يظهر الرسم أول ما يتأكد دفع عبر ميسر."
          />
        )}
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2.5 text-[13px] font-medium text-ink-secondary">التحصيل — المدفوع مقابل غير المدفوع</p>
          <SplitBar
            formatValue={count}
            segments={[
              { key: 'paid', label: 'مدفوع', value: model.paidCount, color: 'var(--series-1)' },
              {
                key: 'unpaid',
                label: 'غير مدفوع',
                value: model.bookingCount - model.paidCount,
                color: 'var(--series-2)',
              },
            ]}
          />
        </div>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title="حالة الحجوزات" subtitle="توزيع كل الحجوزات على المسارات" />
          {model.statusRows.length ? (
            <BarChart rows={model.statusRows} formatValue={count} total={model.bookingCount} />
          ) : (
            <EmptyState icon={<CalendarCheck size={22} />} title="لا توجد حجوزات بعد" />
          )}
        </Card>

        <Card>
          <CardHeader
            title="ينتظر قرارك"
            subtitle={actionCount ? `${count(actionCount)} طلب قيد المراجعة` : 'لا شيء معلّق'}
          />
          {actionCount ? (
            <ul className="space-y-2">
              {model.pendingVendors.length ? (
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('vendor-applications')}
                    className="flex w-full items-center gap-3 rounded-lg border border-line p-3 text-start transition-colors hover:bg-sunken"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--warning-wash)] text-ink">
                      <Building2 size={17} />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-ink">طلبات انضمام مورّدين</span>
                      <span className="block text-[13px] text-ink-secondary">
                        {model.pendingVendors
                          .slice(0, 2)
                          .map((row) => row.projectName)
                          .join('، ')}
                        {model.pendingVendors.length > 2 ? ' وغيرهم' : ''}
                      </span>
                    </span>
                    <Badge tone="warning" icon={<CircleAlert size={13} />}>
                      {count(model.pendingVendors.length)}
                    </Badge>
                  </button>
                </li>
              ) : null}

              {model.pendingCouriers.length ? (
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('couriers')}
                    className="flex w-full items-center gap-3 rounded-lg border border-line p-3 text-start transition-colors hover:bg-sunken"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--warning-wash)] text-ink">
                      <Truck size={17} />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-ink">طلبات مناديب توصيل</span>
                      <span className="block text-[13px] text-ink-secondary">
                        {model.pendingCouriers
                          .slice(0, 2)
                          .map((row) => `${row.firstName} ${row.familyName}`.trim())
                          .join('، ')}
                        {model.pendingCouriers.length > 2 ? ' وغيرهم' : ''}
                      </span>
                    </span>
                    <Badge tone="warning" icon={<CircleAlert size={13} />}>
                      {count(model.pendingCouriers.length)}
                    </Badge>
                  </button>
                </li>
              ) : null}
            </ul>
          ) : (
            <EmptyState
              icon={<CheckCircle2 size={22} />}
              title="ما فيه شي ينتظرك"
              body="كل طلبات المورّدين والمناديب مراجَعة."
            />
          )}
        </Card>

        <Card>
          <CardHeader title="حالة النظام" subtitle="الخادم وبوابة الدفع" />
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-secondary">الخادم</dt>
              <dd>
                {healthRow ? (
                  <Badge tone="good" icon={<CheckCircle2 size={13} />}>
                    يعمل — {uptime(healthRow.uptime)}
                  </Badge>
                ) : (
                  <Badge tone="critical" icon={<CircleAlert size={13} />}>
                    لا يستجيب
                  </Badge>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-secondary">بوابة ميسر</dt>
              <dd>
                {payments?.configured ? (
                  <Badge tone={payments.live ? 'good' : 'warning'} icon={<CheckCircle2 size={13} />}>
                    {payments.live ? 'مفعّلة — وضع حقيقي' : 'مفعّلة — وضع تجريبي'}
                  </Badge>
                ) : (
                  <Badge tone="critical" icon={<CircleAlert size={13} />}>
                    غير مهيأة
                  </Badge>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-secondary">سر الويبهوك</dt>
              <dd>
                {payments?.webhookSecretSet ? (
                  <Badge tone="good" icon={<CheckCircle2 size={13} />}>مضبوط</Badge>
                ) : (
                  <Badge tone="warning" icon={<CircleAlert size={13} />}>غير مضبوط</Badge>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-secondary">العملاء المسجّلون</dt>
              <dd className="tabular font-medium text-ink">{count(model.clientCount)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-secondary">المنتجات المنشورة</dt>
              <dd className="tabular font-medium text-ink">{count(model.listingCount)}</dd>
            </div>
          </dl>
          <Button size="sm" className="mt-4 w-full" icon={<Package size={15} />} onClick={() => navigate('payments')}>
            إعدادات الدفع
          </Button>
        </Card>
      </div>
    </>
  );
}
