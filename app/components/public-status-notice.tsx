type PublicStatusNoticeProps = {
  message: string;
};

export function PublicStatusNotice({ message }: PublicStatusNoticeProps) {
  return (
    <main className="page">
      <div className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        {message}
      </div>
    </main>
  );
}
