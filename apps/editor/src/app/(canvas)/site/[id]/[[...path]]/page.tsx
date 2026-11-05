import { PageRenderer } from "@nextomic/renderer";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getPublishedView } from "@/server/publish";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string; path?: string[] }>;

// Public, no session: only the published snapshot is ever served. Drafts live behind /preview.
const resolve = cache(async (id: string, path: string[] | undefined) => {
  const route = path && path.length > 0 ? `/${path.map(decodeURIComponent).join("/")}` : null;
  const view = await getPublishedView(id, route);
  if (!view) notFound();
  return view;
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id, path } = await params;
  const { page } = await resolve(id, path);
  const seo = page.settings.seo;
  return {
    title: seo.title || page.name,
    description: seo.description || undefined,
    alternates: seo.canonical ? { canonical: seo.canonical } : undefined,
    robots: { index: seo.robots === "index", follow: seo.robots === "index" },
    openGraph: {
      title: seo.ogTitle || seo.title || page.name,
      description: seo.ogDescription || seo.description || undefined,
      images: seo.ogImage ? [seo.ogImage] : undefined
    }
  };
}

export default async function PublishedPage({ params }: { params: Params }) {
  const { id, path } = await params;
  const { page, settings } = await resolve(id, path);
  return <PageRenderer tree={page.tree} breakpoints={settings.breakpoints} />;
}
