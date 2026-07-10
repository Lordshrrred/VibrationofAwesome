const VOA_ORIGIN = "https://vibrationofawesome.com";

export function cleanPublicPath(value) {
  if (!value) return value;
  return String(value)
    .replace(/\/index\.html(?=([?#]|$))/gi, "/")
    .replace(/\.html(?=([?#]|$))/gi, "");
}

export function cleanPublicUrl(value) {
  return cleanPublicPath(value);
}

export function absoluteVoaUrl(pathOrUrl) {
  const value = cleanPublicUrl(pathOrUrl || "/");
  if (/^https?:\/\//i.test(value)) return value;
  return `${VOA_ORIGIN}${value.startsWith("/") ? "" : "/"}${value}`;
}

export { VOA_ORIGIN };
