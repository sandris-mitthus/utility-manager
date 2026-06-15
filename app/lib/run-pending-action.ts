export async function runPendingAction<T extends string>(
  action: T,
  setPending: (value: T | null) => void,
  fn: () => void | Promise<void>,
): Promise<void> {
  setPending(action);
  try {
    await fn();
  } finally {
    setPending(null);
  }
}
