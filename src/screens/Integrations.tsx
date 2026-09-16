import { useEffect, useState } from 'react';
import { Bot, CheckCircle2, CircleAlert, PlugZap } from 'lucide-react';
import { integrations as api } from '../api/endpoints.ts';
import type { AiProviderId } from '../api/types.ts';
import { errorText } from '../api/client.ts';
import { useResource } from '../lib/useResource.ts';
import { useToast } from '../state/ToastContext.tsx';
import { dateTime } from '../lib/format.ts';
import { AI_PROVIDER_LABEL } from '../lib/labels.ts';
import { Badge, Button, Card, CardHeader, ErrorNote, Field, Input, PageHeader, Select, Skeleton } from '../components/ui/primitives.tsx';

const PROVIDERS: AiProviderId[] = ['gemini', 'anthropic', 'openai'];

/** Suggestions only — the field stays free text so a new model needs no release. */
const MODEL_HINTS: Record<AiProviderId, string[]> = {
  gemini: ['gemini-3.6-flash', 'gemini-3.6-pro'],
  anthropic: ['claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini'],
};

type Draft = Record<AiProviderId, { apiKey: string; model: string }>;

const EMPTY_DRAFT: Draft = {
  gemini: { apiKey: '', model: '' },
  anthropic: { apiKey: '', model: '' },
  openai: { apiKey: '', model: '' },
};

export function Integrations() {
  const resource = useResource(() => api.read(), []);
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [defaultProvider, setDefaultProvider] = useState<AiProviderId>('gemini');
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState<AiProviderId | null>(null);

  const settings = resource.data;

  // Models are shown as-is; keys are write-only (the API never returns them).
  useEffect(() => {
    if (!settings) return;
    setDefaultProvider(settings.defaultProvider);
    setDraft({
      gemini: { apiKey: '', model: settings.providers.gemini.model || '' },
      anthropic: { apiKey: '', model: settings.providers.anthropic.model || '' },
      openai: { apiKey: '', model: settings.providers.openai.model || '' },
    });
  }, [settings]);

  async function save() {
    setBusy(true);
    try {
      const providers: Partial<Record<AiProviderId, { apiKey?: string; model?: string }>> = {};
      for (const provider of PROVIDERS) {
        const entry: { apiKey?: string; model?: string } = {};
        if (draft[provider].apiKey.trim()) entry.apiKey = draft[provider].apiKey.trim();
        if (draft[provider].model.trim()) entry.model = draft[provider].model.trim();
        if (Object.keys(entry).length) providers[provider] = entry;
      }
      const next = await api.save({ defaultProvider, providers });
      resource.set(next);
      toast.success('حُفظت إعدادات الذكاء الاصطناعي.');
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function test(provider: AiProviderId) {
    setTesting(provider);
    try {
      const result = await api.test(provider);
      toast.success(result.message || `${AI_PROVIDER_LABEL[provider]} يستجيب.`);
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setTesting(null);
    }
  }

  return (
    <>
      <PageHeader
        title="الذكاء الاصطناعي"
        subtitle="مفاتيح المزوّدين التي تشغّل مساعد يوصل ومطابقة الباقات."
        action={
          <Button size="sm" onClick={() => void resource.reload()} busy={resource.refreshing}>
            تحديث
          </Button>
        }
      />

      {resource.error ? <ErrorNote message={resource.error} onRetry={() => void resource.reload()} /> : null}

      {resource.loading ? (
        <Skeleton className="h-72" />
      ) : settings ? (
        <>
          <Card>
            <CardHeader
              title="المزوّد الافتراضي"
              subtitle={
                settings.activeProvider
                  ? `النشط الآن: ${AI_PROVIDER_LABEL[settings.activeProvider]}`
                  : 'لا يوجد مزوّد مهيأ — ميزات الذكاء معطّلة'
              }
              action={
                settings.activeProvider ? (
                  <Badge tone="good" icon={<CheckCircle2 size={13} />}>يعمل</Badge>
                ) : (
                  <Badge tone="critical" icon={<CircleAlert size={13} />}>معطّل</Badge>
                )
              }
            />
            <div className="max-w-xs">
              <Field label="المزوّد" hint="إن لم يكن مهيأً، يتحوّل الخادم لأول مزوّد يملك مفتاحاً.">
                <Select
                  value={defaultProvider}
                  onChange={(event) => setDefaultProvider(event.target.value as AiProviderId)}
                >
                  {PROVIDERS.map((provider) => (
                    <option key={provider} value={provider}>
                      {AI_PROVIDER_LABEL[provider]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {settings.updatedAt ? (
              <p className="mt-3 text-xs text-ink-muted">آخر تحديث: {dateTime(settings.updatedAt)}</p>
            ) : null}
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            {PROVIDERS.map((provider) => {
              const status = settings.providers[provider];
              return (
                <Card key={provider}>
                  <CardHeader
                    title={AI_PROVIDER_LABEL[provider]}
                    action={
                      status.configured ? (
                        <Badge tone="good" icon={<CheckCircle2 size={13} />}>
                          {status.keySource === 'env' ? 'من البيئة' : 'محفوظ'}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">بلا مفتاح</Badge>
                      )
                    }
                  />
                  <div className="space-y-4">
                    <Field
                      label="مفتاح الـ API"
                      hint={status.configured ? `الحالي: ${status.keyMasked}` : 'لم يُضبط بعد.'}
                    >
                      <Input
                        dir="ltr"
                        className="text-start"
                        type="password"
                        autoComplete="off"
                        placeholder="اتركه فارغاً للإبقاء على الحالي"
                        value={draft[provider].apiKey}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            [provider]: { ...current[provider], apiKey: event.target.value },
                          }))
                        }
                      />
                    </Field>

                    <Field label="النموذج">
                      <Input
                        dir="ltr"
                        className="text-start"
                        list={`models-${provider}`}
                        placeholder="النموذج الافتراضي"
                        value={draft[provider].model}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            [provider]: { ...current[provider], model: event.target.value },
                          }))
                        }
                      />
                    </Field>
                    <datalist id={`models-${provider}`}>
                      {MODEL_HINTS[provider].map((model) => (
                        <option key={model} value={model} />
                      ))}
                    </datalist>

                    <Button
                      size="sm"
                      className="w-full"
                      disabled={!status.configured}
                      busy={testing === provider}
                      onClick={() => void test(provider)}
                      icon={<PlugZap size={15} />}
                    >
                      اختبار الاتصال
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
            <p className="flex items-center gap-2 text-[13px] text-ink-secondary">
              <Bot size={15} />
              {settings.cursor.note}
            </p>
            <Button variant="primary" busy={busy} onClick={() => void save()}>
              حفظ الإعدادات
            </Button>
          </div>
        </>
      ) : null}
    </>
  );
}
