// Comprehensive title cleaning and HTML decoding
// Optionally removes the artist name if it's found within the title string
export default function FormatTitleAndArtist(data, artistName = '') {
  if (!data) {
    return '';
  }
  let str = data.toString();

  // 1. Decode common HTML entities
  str = str
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&#039;', "'")
    .replaceAll('&amp;', 'and')
    .replaceAll('&trade;', '™')
    .replaceAll('&rsquo;', "'")
    .replaceAll('&lsquo;', "'")
    .replaceAll('&ndash;', '–')
    .replaceAll('&mdash;', '—')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  // 2. Remove Artist name from title if present (Heuristic for "Artist - Title")
  if (artistName && typeof artistName === 'string' && artistName.length > 0) {
    const cleanArtist = artistName.trim().toLowerCase();
    // Try to remove "Artist - " at start
    if (str.toLowerCase().startsWith(cleanArtist)) {
      const skipLength = cleanArtist.length;
      const remaining = str.substring(skipLength).trim();
      // Remove leading dash or separator
      if (
        remaining.startsWith('-') ||
        remaining.startsWith('–') ||
        remaining.startsWith('—') ||
        remaining.startsWith('|') ||
        remaining.startsWith('•')
      ) {
        str = remaining.substring(1).trim();
      } else {
        str = remaining;
      }
    }
    // Try to remove " - Artist" at end
    else if (str.toLowerCase().endsWith(cleanArtist)) {
      const remaining = str
        .substring(0, str.length - cleanArtist.length)
        .trim();
      if (
        remaining.endsWith('-') ||
        remaining.endsWith('–') ||
        remaining.endsWith('—') ||
        remaining.endsWith('|') ||
        remaining.endsWith('•')
      ) {
        str = remaining.substring(0, remaining.length - 1).trim();
      } else {
        str = remaining;
      }
    }
  }

  // 3. Aggressively remove extra parts (garbage)
  // Remove everything in brackets or parentheses that contains common garbage keywords
  const garbagePattern = '(?:official|full|lyric|audio|video|visualizer|hq|hd|high|remastered|4k|1080p|original|soundtrack|prod\\.|feat\\.|ft\\.|with|from|version|extended|edit|remix|karaoke|instrumental|cover|live|performance|session|directed|music)';
  const garbageInParentheses = new RegExp('\\s*\\([^\\)]*' + garbagePattern + '[^\\)]*\\)', 'gi');
  const garbageInSquareBrackets = new RegExp('\\s*\\[[^\\]]*' + garbagePattern + '[^\\]]*\\]', 'gi');
  str = str.replace(garbageInParentheses, '').replace(garbageInSquareBrackets, '');

  // Remove known garbage words/suffixes that aren't in brackets
  const standaloneGarbage = [
    /\s+from\s+.*/gi, // Removes "From [Album/Movie]" or " from [Album]"
    /\(from\s+.*\)/gi, // Removes "(From Album)"
    /\[from\s+.*\]/gi, // Removes "[From Album]"
    /\s+feat\s+.*/gi,
    /\s+ft\s+.*/gi,
    /\s+with\s+.*/gi,
    /\s+prod\s+\..*/gi,
    /\s+official\s+video.*/gi,
    /\s+full\s+video.*/gi,
    /\s+lyric\s+video.*/gi,
    /\s+music\s+video.*/gi,
    /\s+original\s+sound.*/gi,
    /\s+lyrical.*/gi,
    /\s+etc.*/gi,
    /\s*-\s*Topic/g,
  ];

  standaloneGarbage.forEach(pattern => {
    str = str.replace(pattern, '');
  });

  // 4. Handle separators like " - ", " – ", " — ", " • "
  // If we haven't already solved it with the artist name check
  const separators = [' - ', ' – ', ' — ', ' • ', ' | ', ' / '];
  for (const sep of separators) {
    if (str.includes(sep)) {
      const parts = str.split(sep);
      if (parts.length >= 2) {
        // If we have "Artist - Title", and artist matches one of the parts, take the other
        if (artistName) {
          const cleanArt = artistName.toLowerCase().trim();
          if (parts[0].toLowerCase().trim() === cleanArt) {
            str = parts[1];
            break;
          } else if (parts[1].toLowerCase().trim() === cleanArt) {
            str = parts[0];
            break;
          }
        }
        // Fallback: take the part that looks more like a title (usually first part for most sources)
        // But for YouTube it's often swapped.
        str = parts[0];
        break;
      }
    }
  }

  // 5. Final cleanup
  return str.replace(/\s\s+/g, ' ').trim();
}
