/** AvatarUtils.getAvatarUrl from v1: an https image, otherwise a letter on #333. */
export function avatarUrl(avatar: string | null | undefined, username: string | null | undefined): string {
  if (avatar && avatar.startsWith('https://')) return avatar;
  const letter = (username || 'User').charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#333333"/><text x="50" y="55" font-family="Arial, sans-serif" font-weight="bold" font-size="50" fill="white" text-anchor="middle" dy=".3em">${escapeXml(letter)}</text></svg>`;
  const bytes = new TextEncoder().encode(svg);
  return `data:image/svg+xml;base64,${btoa(String.fromCharCode(...bytes))}`;
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
