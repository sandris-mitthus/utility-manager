type UserAvatarProps = {
  avatarUrl: string | null;
  name: string;
  size?: "xs" | "sm" | "md";
};

const sizeClasses = {
  xs: "size-8 rounded-md text-[11px]",
  sm: "size-9 rounded-lg text-xs",
  md: "size-12 rounded-xl text-sm",
} as const;

const sizePixels = {
  xs: 32,
  sm: 36,
  md: 48,
} as const;

export function UserAvatar({
  avatarUrl,
  name,
  size = "md",
}: UserAvatarProps) {
  const sizeClass = sizeClasses[size];
  const pixels = sizePixels[size];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        width={pixels}
        height={pixels}
        className={`${sizeClass} shrink-0 object-cover ring-1 ring-zinc-200`}
      />
    );
  }

  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center bg-zinc-100 font-semibold text-zinc-500 ring-1 ring-zinc-200 ${sizeClass}`}
    >
      {initial}
    </div>
  );
}
