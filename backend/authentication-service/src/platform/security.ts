export function safeReturnPath(value: unknown, allowedOrigins: string[] = []): string {
  if (typeof value !== "string" || value.includes("\\")) {
    return "/";
  }
  if (value.startsWith("/")) {
    if (value.startsWith("//") || value.startsWith("/api/auth") || value.startsWith("/signin")) return "/";
    return value;
  }

  try {
    const target = new URL(value);
    if (!allowedOrigins.includes(target.origin) || target.username || target.password || target.hash ||
        target.pathname.startsWith("/api/auth") || target.pathname.startsWith("/signin")) return "/";
    return target.toString();
  } catch {
    return "/";
  }
}
