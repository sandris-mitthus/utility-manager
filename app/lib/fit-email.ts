const DOMAIN_MARK = "....";

/** Īsākā saglabājamā forma: pilns vārds pirms @ un saīsināts domēns. */
export function minimumEmailLabel(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) {
    return email;
  }

  return `${email.slice(0, at)}@${DOMAIN_MARK}`;
}

/** Saīsina e-pastu no domēna puses, līdz tas ietilpst pieejamajā platumā. */
export function fitEmailToWidth(
  email: string,
  maxWidth: number,
  measure: (text: string) => number,
): string {
  if (!email || maxWidth <= 0 || measure(email) <= maxWidth) {
    return email;
  }

  const at = email.lastIndexOf("@");
  if (at <= 0) {
    return truncateWithMark(email, maxWidth, measure, "");
  }

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const maxDomainChars = Math.max(0, domain.length - DOMAIN_MARK.length - 1);
  let best = 0;
  let low = 0;
  let high = maxDomainChars;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = `${local}@${domain.slice(0, mid)}${DOMAIN_MARK}`;
    if (measure(candidate) <= maxWidth) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const fitted = `${local}@${domain.slice(0, best)}${DOMAIN_MARK}`;
  if (measure(fitted) <= maxWidth) {
    return fitted;
  }

  return truncateWithMark(local, maxWidth, measure, `@${DOMAIN_MARK}`);
}

function truncateWithMark(
  value: string,
  maxWidth: number,
  measure: (text: string) => number,
  suffix: string,
): string {
  const tail = `…${suffix}`;
  let best = 0;
  let low = 0;
  let high = value.length;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = `${value.slice(0, mid)}${tail}`;
    if (measure(candidate) <= maxWidth) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const fitted = `${value.slice(0, best)}${tail}`;
  return measure(fitted) <= maxWidth ? fitted : suffix || "…";
}
