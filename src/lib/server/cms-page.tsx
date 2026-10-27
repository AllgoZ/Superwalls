import "server-only";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CmsPageView } from "@/components/common/cms-page";
import type { PageSlug } from "@/lib/admin/schemas/content";
import { getPublishedPage } from "./content";

/** Page metadata from the CMS row when one is published, otherwise the given default title. */
export async function cmsMetadata(slug: PageSlug, fallbackTitle: string): Promise<Metadata> {
  const page = await getPublishedPage(slug);
  return {
    title: page?.seoTitle || page?.title || fallbackTitle,
    ...(page?.seoDescription ? { description: page.seoDescription } : {}),
  };
}

/**
 * Renders the published CMS page for `slug`. When none is published: the built-in fallback if there is one
 * (privacy and terms keep their original text until staff publish their own), otherwise a 404.
 */
export async function renderCmsPage(slug: PageSlug, fallback?: ReactNode): Promise<ReactNode> {
  const page = await getPublishedPage(slug);
  if (page) return <CmsPageView page={page} />;
  if (fallback) return fallback;
  notFound();
}
