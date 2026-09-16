import { useState } from 'react';
import { CheckCircle2, CircleAlert, Copy, KeyRound } from 'lucide-react';
import { moyasar as api } from '../api/endpoints.ts';
import { errorText } from '../api/client.ts';
import { useResource } from '../lib/useResource.ts';
import { useToast } from '../state/ToastContext.tsx';
import { dateTime } from '../lib/format.ts';
import { Badge, Button, Card, CardHeader, ErrorNote, Field, Input, PageHeader, Skeleton } from '../components/ui/primitives.tsx';

export function Payments() {
  const resource = useResource(() => api.read(), []);
  const toast = useToast();
  const [secretKey, setSecretKey] = useState('');
  const [publishableKey, setPublishableKey] = useState('');
  const [busy, setBusy] = useState(false);

  const status = resource.data;

  async function save() {
    if (!secretKey.trim() && !publishableKey.trim()) {
      toast.failure('ما فيه مفتاح جديد لحفظه.');
      return;
    }
    setBusy(true);
    try {
      const result = await api.save({
        secretKey: secretKey.trim() || undefined,
        publishableKey: publishableKey.trim() || undefined,
      });
      resource.set(result.data);
      setSecretKey('');
      setPublishableKey('');
      // Saving also re-registers the webhook with Moyasar; say which happened.
      if (result.webhook?.ok) toast.success('حُفظت المفاتيح وسُجّل الويبهوك في ميسر.');
      else toast.success(`حُفظت المفاتيح. الويبهوك: ${result.webhook?.error || 'لم يُسجَّل'}`);
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function copyWebhook() {
    if (!status?.webhookUrl) return;
    try {
      await navigator.clipboard.writeText(status.webhookUrl);
      toast.success('نُسخ رابط الويبهوك.');
    } catch {
      toast.failure('المتصفح منع النسخ. انسخ الرابط يدوياً.');
    }
  }

  return (
    <>
      <PageHeader
        title="المدفوعات"
        subtitle="بوابة ميسر — المفاتيح والويبهوك الذي تُسوّى عليه الحجوزات."
        action={
          <Button size="sm" onClick={() => void resource.reload()} busy={resource.refreshing}>
            تحديث
          </Button>
        }
      />

      {resource.error ? <ErrorNote message={resource.error} onRetry={() => void resource.reload()} /> : null}

      {resource.loading ? (
        <Skeleton className="h-64" />
      ) : status ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="الحالة الحالية" subtitle="ما يقرأه الخادم الآن" />
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-secondary">البوابة</dt>
                <dd>
                  {status.configured ? (
                    <Badge tone={status.live ? 'good' : 'warning'} icon={<CheckCircle2 size={13} />}>
                      {status.live ? 'مفعّلة — مفاتيح حقيقية' : 'مفعّلة — مفاتيح تجريبية'}
                    </Badge>
                  ) : (
                    <Badge tone="critical" icon={<CircleAlert size={13} />}>غير مهيأة</Badge>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-secondary">نموذج البطاقة داخل الصفحة</dt>
                <dd>
                  {status.form ? (
                    <Badge tone="good" icon={<CheckCircle2 size={13} />}>جاهز</Badge>
                  ) : (
                    <Badge tone="neutral">فاتورة ميسر المستضافة فقط</Badge>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-secondary">المفتاح السري</dt>
                <dd className="tabular text-ink" dir="ltr">
                  {status.secretMasked || '—'}
                  <span className="ms-2 text-xs text-ink-muted">
                    {status.secretSource === 'saved' ? '(محفوظ)' : status.secretSource === 'env' ? '(من البيئة)' : ''}
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-secondary">المفتاح العام</dt>
                <dd className="tabular text-ink" dir="ltr">
                  {status.publishableMasked || '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-secondary">سر الويبهوك</dt>
                <dd>
                  {status.webhookSecretSet ? (
                    <Badge tone="good" icon={<CheckCircle2 size={13} />}>مضبوط</Badge>
                  ) : (
                    <Badge tone="warning" icon={<CircleAlert size={13} />}>غير مضبوط</Badge>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-secondary">آخر تحديث</dt>
                <dd className="text-ink">{status.updatedAt ? dateTime(status.updatedAt) : '—'}</dd>
              </div>
            </dl>

            <div className="mt-4 rounded-lg border border-line bg-sunken p-3">
              <p className="mb-1.5 text-xs font-medium text-ink-secondary">رابط الويبهوك</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate text-xs text-ink" dir="ltr">
                  {status.webhookUrl || '—'}
                </code>
                <Button size="sm" variant="ghost" aria-label="نسخ الرابط" title="نسخ" onClick={() => void copyWebhook()} icon={<Copy size={14} />} />
              </div>
              <p className="mt-2 text-xs leading-5 text-ink-muted">
                يجب أن يبقى نطاق الويبهوك DNS only في كلاودفلير — وضع الوكيل يصدّ طلبات ميسر.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="تحديث المفاتيح" subtitle="من لوحة تحكم ميسر" />
            <div className="space-y-4">
              <Field
                label="المفتاح السري"
                hint="اضغط أيقونة العين في لوحة ميسر وانسخ sk_ كاملاً — لا الرقم المنجّم."
              >
                <Input
                  dir="ltr"
                  className="text-start"
                  placeholder="sk_live_…"
                  value={secretKey}
                  onChange={(event) => setSecretKey(event.target.value)}
                  autoComplete="off"
                />
              </Field>

              <Field label="المفتاح العام" hint="اختياري — يلزم فقط لنموذج البطاقة داخل الصفحة.">
                <Input
                  dir="ltr"
                  className="text-start"
                  placeholder="pk_live_…"
                  value={publishableKey}
                  onChange={(event) => setPublishableKey(event.target.value)}
                  autoComplete="off"
                />
              </Field>

              <div className="rounded-lg border border-[color-mix(in_srgb,var(--warning)_40%,transparent)] bg-[var(--warning-wash)] p-3">
                <p className="flex items-start gap-2 text-[13px] leading-6 text-ink">
                  <CircleAlert size={15} className="mt-0.5 shrink-0" />
                  الحفظ يتحقق من المفتاح لدى ميسر ثم يسجّل الويبهوك. مفتاح sk_live_ يعني خصماً حقيقياً من
                  بطاقات العملاء.
                </p>
              </div>

              <Button variant="primary" busy={busy} onClick={() => void save()} icon={<KeyRound size={15} />}>
                حفظ والتحقق
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}
