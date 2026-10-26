export function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function fileBase(title: string) {
  const cleaned = title.replace(/[\\/:*?"<>|]+/g, '-').trim();
  return cleaned || 'Untitled';
}

export function stripExtension(name: string) {
  return name.replace(/\.[^.]+$/, '');
}

export function folderOf(filePath: string) {
  const parts = filePath.split(/[\\/]/);
  return parts.slice(0, -1).join('\\');
}

export function clockTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function relativeTime(timestamp: number, now = Date.now()) {
  const minutes = Math.round((now - timestamp) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(timestamp).toLocaleDateString([], { day: 'numeric', month: 'short' });
}
