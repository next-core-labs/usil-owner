import { useEffect, useState } from 'react';
import { ExternalLink, Save, Search } from 'lucide-react';
import { seo as api } from '../api/endpoints.ts';
import type { SeoSettings } from '../api/types.ts';
import { errorText } from '../api/client.ts';
import { useResource } from '../lib/useResource.ts';
import { useToast } from '../state/ToastContext.tsx';
import { dateTime } from '../lib/format.ts';
import { Button, Card, CardHeader, ErrorNote, Field, Input, PageHeader, Select, Skeleton, Textarea } from '../components/ui/primitives.tsx';

/** Google truncates around these lengths — the counters warn before it bites. */
const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;

function Counter({ value, max }: { value: string; max: number }) {
  const length = value.length;
  const over = length > max;
  return (
    <span className={`tabular text-xs ${over ? 'text-[var(--critical)]' : 'text-ink-muted'}`}>
      {length}/{max}
    </span>
  );
}

export function Seo() {
  const resource = useResource(() => api.read(), []);
  const toast = useToast();
  const [draft, setDraft] = useState<SeoSettings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (resource.data) setDraft(resource.data);
  }, [resource.data]);

  function patch(changes: Partial<SeoSettings>) {
    setDraft((current) => (current ? { ...current, ...changes } : current));
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      const next = await api.save(draft);
      resource.set(next);
      setDraft(next);
      toast.success('حُفظت إعدادات الظهور. تُطبَّق فوراً على ما يراه جوجل.');
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="الظهور والفهرسة"
        subtitle="الوسوم التي يقرأها جوجل وواتساب وإكس عند مشاركة رابط يوصل."
        action={
          <div className="flex gap-2">
            <a
              href="/sitemap.xml"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-[13px] font-medium text-ink transition-colors hover:bg-sunken"
            >
              <ExternalLink size={14} />
              خريطة الموقع
            </a>
            <Button size="sm" onClick={() => void resource.reload()} busy={resource.refreshing}>
              تحديث
            </Button>
          </div>
        }
      />

      {resource.error ? <ErrorNote message={resource.error} onRetry={() => void resource.reload()} /> : null}

      {resource.loading || !draft ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="نتيجة البحث" subtitle="العنوان والوصف في جوجل" />
              <div className="space-y-4">
                <Field label="العنوان">
                  <Input value={draft.title} onChange={(event) => patch({ title: event.target.value })} />
                  <div className="mt-1 flex justify-end">
                    <Counter value={draft.title} max={TITLE_MAX} />
                  </div>
                </Field>
                <Field label="الوصف">
                  <Textarea
                    rows={3}
                    value={draft.description}
                    onChange={(event) => patch({ description: event.target.value })}
                  />
                  <div className="mt-1 flex justify-end">
                    <Counter value={draft.description} max={DESCRIPTION_MAX} />
                  </div>
                </Field>
                <Field label="الكلمات المفتاحية" hint="افصل بينها بفاصلة.">
                  <Input value={draft.keywords} onChange={(event) => patch({ keywords: event.target.value })} />
                </Field>

                {/* A live preview of the snippet, so the counters have a face. */}
                <div className="rounded-lg border border-line bg-sunken p-3">
                  <p className="truncate text-xs text-ink-muted" dir="ltr">
                    {draft.canonicalBaseUrl || 'https://usil.app'}
                  </p>
                  <p className="mt-0.5 truncate text-[15px] text-accent">{draft.title || '—'}</p>
                  <p className="mt-0.5 line-clamp-2 text-[13px] leading-6 text-ink-secondary">
                    {draft.description || '—'}
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="المشاركة على المنصات" subtitle="بطاقة الرابط في واتساب وإكس" />
              <div className="space-y-4">
                <Field label="عنوان البطاقة">
                  <Input value={draft.ogTitle} onChange={(event) => patch({ ogTitle: event.target.value })} />
                </Field>
                <Field label="وصف البطاقة">
                  <Textarea
                    rows={2}
                    value={draft.ogDescription}
                    onChange={(event) => patch({ ogDescription: event.target.value })}
                  />
                </Field>
                <Field label="صورة البطاقة" hint="رابط مطلق لصورة png أو jpg — منصات المشاركة لا تعرض svg.">
                  <Input
                    dir="ltr"
                    className="text-start"
                    value={draft.ogImage}
                    onChange={(event) => patch({ ogImage: event.target.value })}
                  />
                </Field>
                {draft.ogImage ? (
                  <img
                    src={draft.ogImage}
                    alt=""
                    className="aspect-[1.91/1] w-full rounded-lg border border-line object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                <Field label="نوع بطاقة إكس">
                  <Select
                    value={draft.twitterCard}
                    onChange={(event) => patch({ twitterCard: event.target.value as SeoSettings['twitterCard'] })}
                  >
                    <option value="summary_large_image">صورة كبيرة</option>
                    <option value="summary">ملخّص</option>
                  </Select>
                </Field>
              </div>
            </Card>

            <Card>
              <CardHeader title="النطاق والزحف" subtitle="الرابط المعياري وملف robots" />
              <div className="space-y-4">
                <Field label="الرابط المعياري">
                  <Input
                    dir="ltr"
                    className="text-start"
                    value={draft.canonicalBaseUrl}
                    onChange={(event) => patch({ canonicalBaseUrl: event.target.value })}
                  />
                </Field>
                <Field label="robots.txt" hint="يُدمج مع سطر خريطة الموقع تلقائياً.">
                  <Textarea
                    rows={6}
                    dir="ltr"
                    className="text-start font-mono text-xs"
                    value={draft.robotsTxt}
                    onChange={(event) => patch({ robotsTxt: event.target.value })}
                  />
                </Field>
              </div>
            </Card>

            <Card>
              <CardHeader title="التحقق والقياس" subtitle="ملكية الموقع والتحليلات" />
              <div className="space-y-4">
                <Field label="رمز تحقق جوجل" hint="قيمة وسم google-site-verification.">
                  <Input
                    dir="ltr"
                    className="text-start"
                    value={draft.googleSiteVerification}
                    onChange={(event) => patch({ googleSiteVerification: event.target.value })}
                  />
                </Field>
                <Field label="ملف تحقق جوجل" hint="اسم ملف googleXXXX.html بدون الامتداد.">
                  <Input
                    dir="ltr"
                    className="text-start"
                    value={draft.googleHtmlFileToken}
                    onChange={(event) => patch({ googleHtmlFileToken: event.target.value })}
                  />
                </Field>
                <Field label="معرّف التحليلات">
                  <Input
                    dir="ltr"
                    className="text-start"
                    placeholder="G-XXXXXXX"
                    value={draft.analyticsId}
                    onChange={(event) => patch({ analyticsId: event.target.value })}
                  />
                </Field>
                <Field label="اسم الموقع في البطاقة">
                  <Input value={draft.ogSiteName} onChange={(event) => patch({ ogSiteName: event.target.value })} />
                </Field>
              </div>
            </Card>
          </div>

          <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/90 p-4 shadow-[var(--shadow-pop)] backdrop-blur-md">
            <p className="flex items-center gap-2 text-[13px] text-ink-secondary">
              <Search size={15} />
              آخر حفظ: {draft.updatedAt ? dateTime(draft.updatedAt) : '—'}
            </p>
            <Button variant="primary" busy={busy} onClick={() => void save()} icon={<Save size={15} />}>
              حفظ إعدادات الظهور
            </Button>
          </div>
        </>
      )}
    </>
  );
}
