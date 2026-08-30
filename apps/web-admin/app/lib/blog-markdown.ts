export function renderBlogMarkdown(markdown: string): string {
  const escaped = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .replace(/```([\s\S]*?)```/g, (_match, code: string) => `<pre><code>${code.replace(/^\n/, "")}</code></pre>`)
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^\d+\. (.+)$/gm, '<li data-ol="1">$1</li>')
    .replace(/(<li(?! data-ol)[^>]*>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/(<li data-ol="1">.*<\/li>\n?)+/g, (match) => `<ol>${match}</ol>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br />");
}
