import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://globalcomfibra.cl";
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/portal/"] }], sitemap: `${base}/sitemap.xml` };
}
