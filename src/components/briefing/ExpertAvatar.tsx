"use client";

import { useState } from "react";
import { getExpertPhotoUrls, getExpertInitials } from "@/lib/expert-photos";

export function ExpertAvatar({
  name,
  twitterHandle,
  photoUrl,
  size = 36,
}: {
  name: string;
  twitterHandle?: string | null;
  photoUrl?: string | null;
  size?: number;
}) {
  // Build candidate URLs: stored photo_url first, then static map / handle fallbacks
  const fallbacks = getExpertPhotoUrls(name, twitterHandle);
  const urls = photoUrl ? [photoUrl, ...fallbacks] : fallbacks;
  // Deduplicate
  const uniqueUrls = [...new Set(urls)];

  const initials = getExpertInitials(name);
  const [urlIndex, setUrlIndex] = useState(0);

  const allFailed = urlIndex >= uniqueUrls.length;

  return (
    <div
      className="shrink-0 rounded-full overflow-hidden bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {!allFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={uniqueUrls[urlIndex]}
          alt={name}
          width={size}
          height={size}
          className="object-cover w-full h-full"
          loading="lazy"
          onError={() => setUrlIndex((i) => i + 1)}
        />
      ) : (
        <span
          className="font-[family-name:var(--font-heading)] font-bold text-[var(--color-text-muted)]"
          style={{ fontSize: size * 0.35 }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
