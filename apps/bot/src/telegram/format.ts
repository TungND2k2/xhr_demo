// Re-used as-is from previous src/channel/telegram/telegram.format.ts.
// No bot/CMS coupling — pure string transformation, drop in.

export function mdToTelegramHtml(input: string): string {
  let text = input;
  text = text.replace(/```([^`]*?)```/gs, (_, code) => `<pre>${escapeHtml(code.trim())}</pre>`);
  text = text.replace(/`([^`\n]+?)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`);
  text = text.replace(/\*\*(.+?)\*\*/gs, "<b>$1</b>");
  text = text.replace(/\*([^*\n]+?)\*/g, "<i>$1</i>");
  text = text.replace(/_([^_\n]+?)_/g, "<i>$1</i>");
  text = text.replace(/\[([^\]]+?)\]\((https?:\/\/[^\)]+?)\)/g, '<a href="$2">$1</a>');
  text = text.replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>");
  text = text.replace(/^[\-\*]\s+(.+)$/gm, "• $1");
  text = escapeOutsideTags(text);
  return text;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeOutsideTags(input: string): string {
  return input.replace(/(<[^>]*>|&(?:[a-z]+|#\d+|#x[\da-f]+);)|([<>&])/gi, (m, tag, bare) => {
    if (tag) return tag;
    if (bare === "<") return "&lt;";
    if (bare === ">") return "&gt;";
    if (bare === "&") return "&amp;";
    return m;
  });
}

export function splitMessage(text: string, limit = 4096): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > limit) {
    let split = remaining.lastIndexOf("\n", limit);
    if (split <= 0) split = limit;
    chunks.push(remaining.slice(0, split));
    remaining = remaining.slice(split).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
