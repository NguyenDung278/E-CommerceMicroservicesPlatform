const technicalCopyPatterns = [
  /\bworkbook\b/i,
  /\bexcel\b/i,
  /\bbackend api\b/i,
  /\bhardcoded\b/i,
  /\bstitch editorial\b/i,
  /\beditable in excel\b/i,
];

export function resolveStorefrontCopy(value: string | null | undefined, fallback: string) {
  const trimmedValue = value?.trim() ?? "";

  if (!trimmedValue) {
    return fallback;
  }

  return technicalCopyPatterns.some((pattern) => pattern.test(trimmedValue))
    ? fallback
    : trimmedValue;
}
