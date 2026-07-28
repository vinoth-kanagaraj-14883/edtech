import type { BlogPost } from '@/lib/content';

interface BlogSectionProps {
  posts: BlogPost[];
}

export default function BlogSection({ posts }: BlogSectionProps) {
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-forge-400">From the blog</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Fresh perspectives, every week</h2>
        </div>
        <p className="max-w-sm text-sm text-slate-400">New articles rotate in regularly — check back often for the latest picks.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {posts.map((post) => (
          <article
            key={post.id}
            className="group surface flex flex-col gap-4 p-6 transition hover:border-forge-500/50 hover:shadow-forge"
          >
            <span className="inline-flex w-fit rounded-full border border-forge-500/30 bg-forge-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-forge-100">
              {post.category}
            </span>
            <h3 className="text-lg font-semibold text-white transition group-hover:text-forge-100">{post.title}</h3>
            <p className="flex-1 text-sm text-slate-300">{post.excerpt}</p>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{post.author}</span>
              <span>{post.readMinutes} min read</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
