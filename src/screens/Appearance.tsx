import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ExternalLink, ImageOff, RotateCcw, Save, Upload } from 'lucide-react';
import { siteAppearance as api } from '../api/endpoints.ts';
import type { HeroCard, SiteAppearance } from '../api/types.ts';
import { errorText } from '../api/client.ts';
import { useResource } from '../lib/useResource.ts';
import { useToast } from '../state/ToastContext.tsx';
import { dateTime } from '../lib/format.ts';
import { publicSiteUrl } from '../lib/publicSite.ts';
import { Button, Card, CardHeader, ErrorNote, Field, Input, PageHeader, Skeleton } from '../components/ui/primitives.tsx';

/** Same order, grounds and photos as the hero in usil/src/storefront/screens/HomeScreen.tsx. */
const CARDS = [
  { label: 'البطاقة الكبيرة', where: 'الصورة الرئيسية', color: '#163A78', photo: '/design/hero-1.webp' },
  { label: 'البطاقة العلوية', where: 'الصغيرة في الأعلى', color: '#155EEF', photo: '/design/hero-2.webp' },
  { label: 'البطاقة السفلية', where: 'الصغيرة في الأسفل', color: '#DBE7FF', photo: '/design/hero-3.webp' },
] as const;

const PRESETS = ['#163A78', '#155EEF', '#DBE7FF', '#0A1A33', '#C0A16B', '#0F766E', '#BE123C', '#FFFFFF'];

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('تعذرت قراءة الصورة.'));
    reader.readAsDataURL(file);
  });
}

/** What the card shows: the owner's upload, else the design photo — or nothing when hidden. */
function cardPhoto(card: HeroCard, index: number): string {
  if (!card.showImage) return '';
  return card.image || `${publicSiteUrl()}${CARDS[index].photo}`;
}

/** A still copy of the hero's three cards, placed and tilted as on the home page. */
function HeroPreview({ cards }: { cards: HeroCard[] }) {
  const frames: CSSProperties[] = [
    { insetInlineStart: '4%', top: '6%', width: '58%', aspectRatio: '4 / 5', rotate: '-4deg', borderRadius: 20 },
    { insetInlineEnd: '2%', top: 0, width: '42%', aspectRatio: '1', rotate: '5deg', borderRadius: 18 },
    { insetInlineEnd: '6%', bottom: '4%', width: '40%', aspectRatio: '5 / 4', rotate: '-2deg', borderRadius: 16 },
  ];
  return (
    <div className="overflow-hidden rounded-xl bg-[#0A1A33] p-6">
      <div className="relative mx-auto aspect-[580/540] w-full max-w-[420px]">
        {cards.map((card, index) => {
          const photo = cardPhoto(card, index);
          return (
            <div
              key={index}
              className="absolute overflow-hidden shadow-[0_24px_50px_-18px_rgba(0,0,0,.6)]"
              style={{ ...frames[index], background: card.color }}
            >
              {photo ? <img src={photo} alt="" className="block size-full object-cover" /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CardEditor({
  index,
  card,
  onChange,
  onBusyChange,
}: {
  index: number;
  card: HeroCard;
  onChange: (changes: Partial<HeroCard>) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const meta = CARDS[index];
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [hex, setHex] = useState(card.color);
  const photo = cardPhoto(card, index);

  useEffect(() => setHex(card.color), [card.color]);

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) return toast.failure('الصيغ المقبولة: JPG أو PNG أو WEBP.');
    if (file.size > IMAGE_MAX_BYTES) return toast.failure('حجم الصورة أكبر من 5 ميجابايت.');
    setBusy(true);
    onBusyChange(true);
    try {
      const url = await api.uploadHeroImage(await readAsDataUrl(file));
      if (!url) throw new Error('تعذر رفع الصورة، جرّب مرة ثانية.');
      onChange({ image: url, showImage: true });
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setBusy(false);
      onBusyChange(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <Card>
      <CardHeader title={meta.label} subtitle={meta.where} />
      <div className="space-y-4">
        <div
          className="grid aspect-[16/10] w-full place-items-center overflow-hidden rounded-lg border border-line"
          style={{ background: card.color }}
        >
          {photo ? (
            <img src={photo} alt="" className="block size-full object-cover" />
          ) : (
            <ImageOff size={22} className="opacity-40 mix-blend-difference text-white" aria-hidden />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            busy={busy}
            icon={<Upload size={14} />}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? 'جارٍ الرفع…' : 'رفع صورة'}
          </Button>
          {card.image && !busy ? (
            <Button size="sm" icon={<RotateCcw size={14} />} onClick={() => onChange({ image: '' })}>
              صورة التصميم
            </Button>
          ) : null}
          <input
            ref={inputRef}
            type="file"
            accept={IMAGE_TYPES.join(',')}
            className="hidden"
            onChange={(event) => void pick(event.target.files?.[0])}
          />
        </div>

        <label className="flex items-center gap-2 text-[13px] text-ink-secondary">
          <input
            type="checkbox"
            checked={!card.showImage}
            onChange={(event) => onChange({ showImage: !event.target.checked })}
            className="size-4 accent-[var(--accent)]"
          />
          لون فقط بدون صورة
        </label>

        <Field label="لون الخلفية" hint="يظهر خلف الصورة أثناء تحميلها، ويملأ البطاقة كاملة عند إخفاء الصورة.">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={card.color}
              onChange={(event) => onChange({ color: event.target.value.toUpperCase() })}
              className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-line-strong bg-surface p-1"
              aria-label="اختيار اللون"
            />
            <Input
              dir="ltr"
              className="h-10 text-start font-mono"
              value={hex}
              maxLength={7}
              onChange={(event) => {
                const value = event.target.value.trim();
                setHex(value);
                if (HEX_COLOR.test(value)) onChange({ color: value.toUpperCase() });
              }}
              onBlur={() => setHex(card.color)}
            />
          </div>
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              aria-label={color}
              onClick={() => onChange({ color })}
              className={`size-7 rounded-full border transition-transform hover:scale-110 ${
                card.color === color ? 'border-accent ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface)]' : 'border-line-strong'
              }`}
              style={{ background: color }}
            />
          ))}
          {card.color !== meta.color ? (
            <button
              type="button"
              onClick={() => onChange({ color: meta.color })}
              className="ms-1 text-xs font-medium text-accent hover:underline"
            >
              اللون الأصلي
            </button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export function Appearance() {
  const resource = useResource(() => api.read(), []);
  const toast = useToast();
  const [draft, setDraft] = useState<SiteAppearance | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState(0);

  useEffect(() => {
    if (resource.data) setDraft(resource.data);
  }, [resource.data]);

  function patchCard(index: number, changes: Partial<HeroCard>) {
    setDraft((current) =>
      current
        ? { ...current, heroCards: current.heroCards.map((card, i) => (i === index ? { ...card, ...changes } : card)) }
        : current,
    );
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      const next = await api.save({ heroCards: draft.heroCards });
      resource.set(next);
      setDraft(next);
      toast.success('حُفظ مظهر الواجهة. يراه الزوار عند فتح الصفحة الرئيسية.');
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="مظهر الواجهة"
        subtitle="خلفيات البطاقات المتحركة في أعلى الصفحة الرئيسية."
        action={
          <div className="flex gap-2">
            <a
              href={`${publicSiteUrl()}/`}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-[13px] font-medium text-ink transition-colors hover:bg-sunken"
            >
              <ExternalLink size={14} />
              فتح الموقع
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
          <Card>
            <CardHeader title="معاينة" subtitle="ترتيب البطاقات كما تظهر للزائر (بدون الحركة)" />
            <HeroPreview cards={draft.heroCards} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            {draft.heroCards.map((card, index) => (
              <CardEditor
                key={index}
                index={index}
                card={card}
                onChange={(changes) => patchCard(index, changes)}
                onBusyChange={(uploading) => setUploads((count) => count + (uploading ? 1 : -1))}
              />
            ))}
          </div>

          <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/90 p-4 shadow-[var(--shadow-pop)] backdrop-blur-md">
            <p className="text-[13px] text-ink-secondary">آخر حفظ: {draft.updatedAt ? dateTime(draft.updatedAt) : '—'}</p>
            <Button
              variant="primary"
              busy={busy}
              disabled={uploads > 0}
              onClick={() => void save()}
              icon={<Save size={15} />}
            >
              حفظ مظهر الواجهة
            </Button>
          </div>
        </>
      )}
    </>
  );
}
