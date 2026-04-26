interface ShareButtonsProps {
  url: string;
}

const AUTHOR_LINKEDIN = "https://www.linkedin.com/in/gabriel-chidiac/";

export function ShareButtons({ url }: ShareButtonsProps) {
  const encodedUrl = encodeURIComponent(url);
  const linkedinShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;

  return (
    <div className="flex items-center gap-1.5">
      <a
        href={linkedinShareUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center justify-center h-8 w-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-accent)]/5 transition-colors"
        title="Share on LinkedIn"
      >
        <svg className="w-3.5 h-3.5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      </a>
      <a
        href={AUTHOR_LINKEDIN}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center justify-center h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-accent)]/5 transition-colors px-2.5 gap-1.5"
        title="Connect with the author on LinkedIn"
      >
        <svg className="w-3.5 h-3.5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M3 13.5c0-2.485 2.239-4 5-4s5 1.515 5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span className="text-xs font-medium text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors">Author</span>
      </a>
    </div>
  );
}
