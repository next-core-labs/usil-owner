import { useState, type FormEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Armchair,
  Building2,
  Cake,
  Camera,
  Car,
  Coffee,
  ExternalLink,
  Flower2,
  Gift,
  Music,
  Palette,
  PartyPopper,
  Plus,
  Shapes,
  Sparkles,
  Speaker,
  Tent,
  Trash2,
  Users,
  Utensils,
} from 'lucide-react';
import { siteCategories as api } from '../api/endpoints.ts';
import type { SiteCategory, SiteCategoryDraft } from '../api/types.ts';
import { errorText } from '../api/client.ts';
import { useResource } from '../lib/useResource.ts';
import { useToast } from '../state/ToastContext.tsx';
import { count, dateTime } from '../lib/format.ts';
import { publicSiteUrl } from '../lib/publicSite.ts';
import { ConfirmDialog, Modal } from '../components/ui/Modal.tsx';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  PageHeader,
  Skeleton,
} from '../components/ui/primitives.tsx';

/** The icons the storefront can draw — same set as usil/src/storefront/screens/HomeScreen.tsx. */
const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Coffee,
  Utensils,
  Palette,
  Camera,
  PartyPopper,
  Building2,
  Armchair,
  Users,
  Speaker,
  Tent,
  Music,
  Cake,
  Gift,
  Car,
  Flower2,
};

const EMPTY_DRAFT: SiteCategoryDraft = { name: '', short: '', nameEn: '', icon: 'Sparkles' };

function CategoryIcon({ icon, size = 18 }: { icon: string; size?: number }) {
  const Icon = ICONS[icon] || Sparkles;
  return <Icon size={size} aria-hidden />;
}

function AddCategoryModal({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (draft: SiteCategoryDraft) => void;
}) {
  const [draft, setDraft] = useState<SiteCategoryDraft>(EMPTY_DRAFT);
  const patch = (changes: Partial<SiteCategoryDraft>) => setDraft((current) => ({ ...current, ...changes }));
  const valid = draft.name.trim().length >= 2;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (valid && !busy) onSubmit(draft);
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setDraft(EMPTY_DRAFT);
        onClose();
      }}
      title="إضافة تصنيف"
      description="يظهر التصنيف في الصفحة الرئيسية وصفحة الخدمات، ويختاره المورّدون عند إضافة منتجاتهم."
      footer={
        <>
          <Button onClick={onClose}>إلغاء</Button>
          <Button variant="primary" type="submit" form="add-category" busy={busy} disabled={!valid}>
            إضافة التصنيف
          </Button>
        </>
      }
    >
      <form id="add-category" className="space-y-4" onSubmit={submit}>
        <Field label="اسم التصنيف *" hint="الاسم الكامل كما يراه العميل، مثل «عطور وبخور».">
          <Input
            autoFocus
            maxLength={40}
            value={draft.name}
            onChange={(event) => patch({ name: event.target.value })}
            placeholder="عطور وبخور"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="اسم مختصر" hint="كلمة واحدة للشريط الصغير. يُؤخذ من الاسم إن تركته فارغاً.">
            <Input
              maxLength={16}
              value={draft.short}
              onChange={(event) => patch({ short: event.target.value })}
              placeholder="عطور"
            />
          </Field>
          <Field label="الاسم بالإنجليزية" hint="للنسخة الإنجليزية من الموقع (اختياري).">
            <Input
              dir="ltr"
              className="text-start"
              maxLength={40}
              value={draft.nameEn}
              onChange={(event) => patch({ nameEn: event.target.value })}
              placeholder="Perfume & incense"
            />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 block text-[13px] font-medium text-ink-secondary">الأيقونة</legend>
          <div className="grid grid-cols-8 gap-2">
            {Object.keys(ICONS).map((name) => {
              const active = draft.icon === name;
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  aria-label={name}
                  aria-pressed={active}
                  onClick={() => patch({ icon: name })}
                  className={`grid aspect-square place-items-center rounded-lg border transition-colors ${
                    active
                      ? 'border-accent bg-[var(--accent-wash,transparent)] text-accent ring-2 ring-[var(--accent)]'
                      : 'border-line-strong text-ink-secondary hover:bg-sunken hover:text-ink'
                  }`}
                >
                  <CategoryIcon icon={name} />
                </button>
              );
            })}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

export function Categories() {
  const resource = useResource(() => api.read(), []);
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<SiteCategory | null>(null);
  const [busy, setBusy] = useState(false);
  const categories = resource.data?.categories || [];

  async function add(draft: SiteCategoryDraft) {
    setBusy(true);
    try {
      resource.set(await api.add(draft));
      setAdding(false);
      toast.success(`أُضيف تصنيف «${draft.name.trim()}». يظهر للزوار والمورّدين الآن.`);
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      resource.set(await api.remove(removing.id));
      toast.success(`حُذف تصنيف «${removing.name}».`);
      setRemoving(null);
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  const removeBody = removing
    ? removing.listingCount
      ? `يختفي «${removing.name}» من الموقع ومن قائمة المورّدين. منتجاته (${count(removing.listingCount)}) تبقى معروضة تحت «الكل»، ويختار مورّدوها تصنيفاً جديداً عند تعديلها.`
      : `يختفي «${removing.name}» من الموقع ومن قائمة المورّدين. لا توجد منتجات تحت هذا التصنيف.`
    : '';

  return (
    <>
      <PageHeader
        title="التصنيفات"
        subtitle="أقسام المنتجات في الموقع. ما تضيفه هنا يظهر للزوار ويختاره المورّدون فوراً."
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
            <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
              إضافة تصنيف
            </Button>
          </div>
        }
      />

      {resource.error ? <ErrorNote message={resource.error} onRetry={() => void resource.reload()} /> : null}

      {resource.loading ? (
        <Skeleton className="h-96" />
      ) : (
        <Card padded={false}>
          <div className="p-5 pb-0">
            <CardHeader
              title={`${count(categories.length)} تصنيف`}
              subtitle={resource.data?.updatedAt ? `آخر تعديل: ${dateTime(resource.data.updatedAt)}` : 'تصنيفات التصميم الأصلية'}
            />
          </div>
          {categories.length ? (
            <ul className="divide-y divide-line border-t border-line">
              {categories.map((category) => (
                <li key={category.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sunken text-ink-secondary">
                    <CategoryIcon icon={category.icon} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{category.name}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {category.short}
                      {category.nameEn ? <span dir="ltr"> · {category.nameEn}</span> : null}
                    </p>
                  </div>
                  <span className="shrink-0 text-[13px] text-ink-secondary">
                    {category.listingCount ? `${count(category.listingCount)} منتج` : 'بدون منتجات'}
                  </span>
                  <Button
                    size="sm"
                    variant="danger"
                    aria-label={`حذف ${category.name}`}
                    title="حذف"
                    disabled={categories.length <= 1}
                    icon={<Trash2 size={14} />}
                    onClick={() => setRemoving(category)}
                  >
                    <span className="hidden sm:inline">حذف</span>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Shapes size={22} />}
              title="لا توجد تصنيفات"
              action={
                <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
                  إضافة تصنيف
                </Button>
              }
            />
          )}
        </Card>
      )}

      {adding ? <AddCategoryModal open busy={busy} onClose={() => setAdding(false)} onSubmit={(draft) => void add(draft)} /> : null}

      <ConfirmDialog
        open={Boolean(removing)}
        title="حذف التصنيف؟"
        body={removeBody}
        confirmLabel="حذف التصنيف"
        danger
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}
