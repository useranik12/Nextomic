import { z } from "zod";

// Categories and tags for pages and templates (a WordPress-like system). Each of the four lists is
// separate: page categories never mix with template categories, and tags never mix with categories.

export const termSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(48),
  slug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/)
    .max(60)
});
export type Term = z.infer<typeof termSchema>;

export const TAXONOMY_LISTS = [
  "pageCategories",
  "pageTags",
  "templateCategories",
  "templateTags"
] as const;
export type TaxonomyList = (typeof TAXONOMY_LISTS)[number];

const termList = z.array(termSchema).max(500).default([]);

export const taxonomySchema = z.object({
  pageCategories: termList,
  pageTags: termList,
  templateCategories: termList,
  templateTags: termList
});
export type Taxonomy = z.infer<typeof taxonomySchema>;

export const emptyTaxonomy = (): Taxonomy => taxonomySchema.parse({});

export function slugifyTerm(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (s === "" ? "term" : s).slice(0, 60);
}

/** Adds a term when the name is new (case-insensitive); returns the existing one otherwise. */
export function addTerm(
  terms: readonly Term[],
  name: string,
  id: string
): { terms: Term[]; term: Term | null } {
  const clean = name.trim().slice(0, 48);
  if (clean === "") return { terms: [...terms], term: null };
  const existing = terms.find((t) => t.name.toLowerCase() === clean.toLowerCase());
  if (existing) return { terms: [...terms], term: existing };
  const taken = new Set(terms.map((t) => t.slug));
  const base = slugifyTerm(clean);
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base.slice(0, 55)}-${n}`;
  const term: Term = { id, name: clean, slug };
  return { terms: [...terms, term], term };
}

/** Substring search, case-insensitive; an empty query matches everything. */
export function searchTerms(terms: readonly Term[], query: string): Term[] {
  const q = query.trim().toLowerCase();
  return q === "" ? [...terms] : terms.filter((t) => t.name.toLowerCase().includes(q));
}
