import type { BlogPost } from '@/lib/content';

interface BlogSectionProps {
  posts: BlogPost[];
}

export default function BlogSection({ posts }: BlogSectionProps) {
  return (
    <section aria-labelledby="blog-heading" className="py-16 sm:py-24">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="eyebrow">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h9A2.5 2.5 0 0 1 18 5.5V19a2 2 0 0 0 2-2V9" />
              <path d="M4 5.5V18a3 3 0 0 0 3 3h11" />
              <path d="M8 8h6M8 12h6M8 16h3" />
            </svg>
            From the blog
          </p>
          <h2 id="blog-heading" className="section-title mt-3">
            Fresh perspectives, <span className="gradient-text">every week</span>
          </h2>
          <p className="section-subtitle mt-3">
            New articles rotate in regularly — check back often for the latest picks.
          </p>
        </div>
        <p className="chip w-fit shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden="true" />
          Updated daily
        </p>
      </header>

      <div className="stagger mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {posts.map((post) => (
          <article key={post.id} className="surface-hover group flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="chip-brand">{post.category}</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-content-subtle">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7.5V12l3 2" />
                </svg>
                {post.readMinutes} min read
              </span>
            </div>

            <h3 className="text-lg font-bold leading-snug tracking-tight text-content transition group-hover:text-brand-600">
              {post.title}
            </h3>
            <p className="flex-1 text-sm leading-relaxed text-content-muted">{post.excerpt}</p>

            <div className="mt-2 flex items-center gap-3 border-t border-hairline pt-4">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white"
                aria-hidden="true"
              >
                {post.author.slice(0, 1)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-content">{post.author}</p>
                <p className="text-xs text-content-subtle">
                  {new Date(post.publishedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    timeZone: 'UTC'
                  })}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
