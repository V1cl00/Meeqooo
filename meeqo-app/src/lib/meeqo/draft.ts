/**
 * Create-form draft in sessionStorage, so a round trip from /create to
 * /categories (or /communities) and back keeps every field and the photo
 * (stored as the compressed data URL, it is not uploaded before publishing).
 */
const DRAFT_KEY = "meeqo:create-draft";
const RETURN_KEY = "meeqo:create-return";
const PICKED_KEY = "meeqo:create-picked";

export type CreateDraft = {
  title: string;
  description: string;
  category: string;
  intent: "date" | "friends" | "both";
  placeName: string;
  city: string;
  when: string;
  spots: number;
  coords: { lat: number; lng: number } | null;
  imageUrl: string;
  bookingMode: "request" | "instant";
  publicPlace: boolean;
  traits: string[];
  visibility: string;
  communityIds: string[];
  durationMin: number;
  step: number;
  sentence: string;
  communityId: string;
  minPeople?: number;
};

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readDraft(): CreateDraft | null {
  try {
    const raw = store()?.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as CreateDraft) : null;
  } catch {
    return null;
  }
}

export function writeDraft(draft: CreateDraft) {
  const s = store();
  if (!s) return;
  try {
    s.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Quota: keep the fields, drop the photo rather than losing everything.
    try {
      s.setItem(DRAFT_KEY, JSON.stringify({ ...draft, imageUrl: "" }));
    } catch {
      /* ignore */
    }
  }
}

export function clearDraft() {
  store()?.removeItem(DRAFT_KEY);
}

/** /create → /categories: remember where to go back and which main category is open. */
export function markReturn(parent: string) {
  store()?.setItem(RETURN_KEY, parent);
}

/** Read on /categories: the main category to preselect, or null when not coming from /create. */
export function returnTarget(): string | null {
  return store()?.getItem(RETURN_KEY) ?? null;
}

/** A new subcategory was created for the draft: select it on return. */
export function setPicked(category: string) {
  const s = store();
  s?.setItem(PICKED_KEY, category);
  s?.removeItem(RETURN_KEY);
}

export function takePicked(): string | null {
  const s = store();
  const value = s?.getItem(PICKED_KEY) ?? null;
  s?.removeItem(PICKED_KEY);
  s?.removeItem(RETURN_KEY);
  return value;
}
