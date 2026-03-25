import type { TopStory } from "@/lib/types";
import { StoryCard } from "./StoryCard";

export function TopStories({ stories }: { stories: TopStory[] }) {
  return (
    <section className="mt-10">
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-4">
        Top Stories
      </h2>

      <div className="space-y-3">
        {stories.map((story) => (
          <StoryCard key={story.url} story={story} />
        ))}
      </div>
    </section>
  );
}
