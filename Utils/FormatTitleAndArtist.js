// Decode common HTML entities to original characters
export default function FormatTitleAndArtist(data){
  const str = (data ?? "").toString();
  return str
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&#039;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&trade;", "™")
    .replaceAll("&rsquo;", "'")
    .replaceAll("&lsquo;", "'")
    .replaceAll("&ndash;", "–")
    .replaceAll("&mdash;", "—");
}
