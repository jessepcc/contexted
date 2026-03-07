export function getViewerIdFromToken(): string | null {
  const token = localStorage.getItem('contexted_token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
