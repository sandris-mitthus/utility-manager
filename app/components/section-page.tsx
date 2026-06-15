type SectionPageProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function SectionPage({
  title,
  subtitle,
  actions,
  children,
}: SectionPageProps) {
  return (
    <main className="page">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </main>
  );
}
