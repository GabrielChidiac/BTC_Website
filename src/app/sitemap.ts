import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/url";
import { createServiceClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("daily_briefings")
    .select("date")
    .order("date", { ascending: false });

  const briefingDates: string[] = (data ?? []).map(
    (row: { date: string }) => row.date
  );

  const latestDate = briefingDates[0];

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: latestDate ? new Date(`${latestDate}T01:00:00Z`) : new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/archive`,
      lastModified: latestDate ? new Date(`${latestDate}T01:00:00Z`) : new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/pricing`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const archivePages: MetadataRoute.Sitemap = briefingDates.map(
    (date, index) => ({
      url: `${baseUrl}/archive/${date}`,
      lastModified: new Date(`${date}T01:00:00Z`),
      changeFrequency: "never" as const,
      priority: index === 0 ? 0.8 : 0.6,
    })
  );

  return [...staticPages, ...archivePages];
}
