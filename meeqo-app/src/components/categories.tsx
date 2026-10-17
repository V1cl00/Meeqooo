import { useState } from "react";
import { addCategory, searchCategories } from "@/lib/meeqo/api";
import { CATEGORIES, CATEGORY_TREE, MORE_SUGGESTIONS, categoryShort, joinCategory, splitCategory, subsFor, type CustomCategory } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";
import { Note } from "@/components/bits";
import { t } from "@/lib/meeqo/i18n";

function chip(active: boolean) {
  return `inline-flex h-11 items-center rounded-full border-2 px-3.5 text-sm font-semibold ${active ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`;
}

function Extras({
  onPick,
  active,
}: {
  onPick: (label: string) => void;
  active: (label: string) => boolean;
}) {
  const [mode, setMode] = useState<"" | "more" | "search">("");
  const [q, setQ] = useState("");
  const [parent, setParent] = useState<string>(CATEGORIES[0]);
  const [fail, setFail] = useState("");
  const catalog = useLoad(() => searchCategories({ data: { q: "" } }), []);
  const found = useLoad(
    () => (q.trim().length >= 2 ? searchCategories({ data: { q } }) : Promise.resolve({ hits: [], promoted: [] })),
    [q],
  );
  const exact = found.data?.hits.some((item) => item.name.toLowerCase() === q.trim().toLowerCase()) ?? false;

  async function createOwn() {
    setFail("");
    try {
      await addCategory({ data: { name: q.trim(), parent } });
      onPick(joinCategory(parent, q.trim()));
      setQ("");
    } catch (err) {
      setFail(err instanceof Error ? err.message : t("Anlegen hat nicht geklappt."));
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={chip(mode === "more")} onClick={() => setMode(mode === "more" ? "" : "more")}>{t("Andere")}</button>
        <button type="button" className={chip(mode === "search")} onClick={() => setMode(mode === "search" ? "" : "search")}>{t("Suchen")}</button>
      </div>
      {mode === "more" ? (
        <div className="card space-y-3 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("Mehr Vorschläge")}</p>
          <div className="flex flex-wrap gap-2">
            {MORE_SUGGESTIONS.map((item) => {
              const label = joinCategory(item.parent, item.name);
              return (
                <button key={label} type="button" className={chip(active(label))} onClick={() => onPick(label)}>
                  {t(item.name)}
                </button>
              );
            })}
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("Oft gewählt")}</p>
          {(catalog.data?.promoted.length ?? 0) === 0 ? (
            <p className="text-sm text-muted">{t("Wenn genug Leute dieselbe eigene Kategorie wählen, taucht sie hier auf.")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {catalog.data?.promoted.map((item) => {
                const label = joinCategory(item.parent, item.name);
                return (
                  <button key={label} type="button" className={chip(active(label))} onClick={() => onPick(label)}>
                    {t(item.name)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
      {mode === "search" ? (
        <div className="card space-y-3 p-3">
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={t("Kategorie suchen oder neu anlegen")}
            className="h-12 w-full rounded-2xl border border-line bg-card px-4 text-base outline-none focus:border-accent"
          />
          <div className="flex flex-wrap gap-2">
            {(found.data?.hits ?? []).filter((item) => item.name).map((item) => {
              const label = joinCategory(item.parent, item.name);
              return (
                <button key={label} type="button" className={chip(active(label))} onClick={() => onPick(label)}>
                  {item.parent} · {item.name}
                </button>
              );
            })}
          </div>
          {q.trim().length >= 2 && !exact ? (
            <div className="space-y-2">
              <p className="text-sm text-muted">{t("Neu anlegen. Zuerst nur über die Suche auffindbar.")}</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((item) => (
                  <button key={item} type="button" className={chip(parent === item)} onClick={() => setParent(item)}>{t(item)}</button>
                ))}
              </div>
              <button type="button" className={chip(true)} onClick={createOwn}>{t("„{0}“ unter {1}", q.trim(), parent)}</button>
            </div>
          ) : null}
          {fail ? <Note>{fail}</Note> : null}
        </div>
      ) : null}
    </div>
  );
}

export function CategorySelect({
  value,
  onChange,
  custom = [],
  allowAll = false,
}: {
  value: string;
  onChange: (next: string) => void;
  custom?: CustomCategory[];
  allowAll?: boolean;
}) {
  const parsed = splitCategory(value);
  const parent = CATEGORIES.includes(parsed.parent) ? parsed.parent : allowAll ? "" : CATEGORIES[0];
  const subs = parent ? subsFor(parent, custom) : [];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {allowAll ? (
          <button type="button" onClick={() => onChange("")} className={chip(value === "")}>{t("Alle")}</button>
        ) : null}
        {CATEGORIES.map((item) => (
          <button key={item} type="button" onClick={() => onChange(item)} className={chip(item === parent)}>
            {t(item)}
          </button>
        ))}
      </div>
      {parent ? (
        <div className="card space-y-2 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("Unterkategorien · {0}", parent)}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onChange(parent)} className={chip(value === parent)}>{t("Alles in {0}", parent)}</button>
            {subs.map((sub) => {
              const label = joinCategory(parent, sub);
              return (
                <button key={label} type="button" onClick={() => onChange(label)} className={chip(value === label)}>
                  {t(sub)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <Extras onPick={onChange} active={(label) => value === label} />
    </div>
  );
}

export function SeekingPicker({
  selected,
  onChange,
  custom = [],
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  custom?: CustomCategory[];
}) {
  const [open, setOpen] = useState<string | null>(null);
  const group = CATEGORY_TREE.find((item) => item.name === open);

  function toggle(label: string) {
    onChange(selected.includes(label) ? selected.filter((item) => item !== label) : [...selected, label].slice(0, 12));
  }

  return (
    <div className="space-y-2">
      {selected.length ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((label) => (
            <button key={label} type="button" className={chip(true)} onClick={() => toggle(label)}>{categoryShort(label)}</button>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_TREE.map((item) => (
          <button key={item.name} type="button" onClick={() => setOpen(open === item.name ? null : item.name)} className={chip(open === item.name)}>
            {item.name}
          </button>
        ))}
      </div>
      {group ? (
        <div className="card space-y-2 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("Unterkategorien · {0}", group.name)}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => toggle(group.name)} className={chip(selected.includes(group.name))}>{t("Alles in {0}", group.name)}</button>
            {subsFor(group.name, custom).map((sub) => {
              const label = joinCategory(group.name, sub);
              return (
                <button key={label} type="button" onClick={() => toggle(label)} className={chip(selected.includes(label))}>
                  {categoryShort(label)}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">{t("Tippe eine Kategorie an. Andere und Suchen liegen darunter.")}</p>
      )}
      <Extras onPick={toggle} active={(label) => selected.includes(label)} />
    </div>
  );
}
