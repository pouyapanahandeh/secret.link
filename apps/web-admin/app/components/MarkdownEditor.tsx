import { useRef, type KeyboardEvent } from "react";

type MarkdownEditorProps = {
  name: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
};

type Tool = {
  label: string;
  title: string;
  run: (el: HTMLTextAreaElement) => { next: string; start: number; end: number };
};

function selected(el: HTMLTextAreaElement) {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  return { start, end, text: el.value.slice(start, end) };
}

function wrap(
  el: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder: string,
) {
  const { start, end, text } = selected(el);
  const inner = text || placeholder;
  const already =
    el.value.slice(Math.max(0, start - before.length), start) === before &&
    el.value.slice(end, end + after.length) === after;

  if (already && text) {
    const next =
      el.value.slice(0, start - before.length) + text + el.value.slice(end + after.length);
    const nextStart = start - before.length;
    return { next, start: nextStart, end: nextStart + text.length };
  }

  const next = el.value.slice(0, start) + before + inner + after + el.value.slice(end);
  const innerStart = start + before.length;
  return { next, start: innerStart, end: innerStart + inner.length };
}

function prefixLines(el: HTMLTextAreaElement, prefix: string, numbered = false) {
  const { start, end } = selected(el);
  const value = el.value;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEndSearch = value.indexOf("\n", end);
  const lineEnd = lineEndSearch === -1 ? value.length : lineEndSearch;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");
  const nextBlock = lines
    .map((line, i) => {
      if (!line.trim()) return line;
      if (numbered) {
        return /^\d+\.\s/.test(line) ? line.replace(/^\d+\.\s/, "") : `${i + 1}. ${line}`;
      }
      if (/^#{1,6}\s/.test(prefix)) {
        const stripped = line.replace(/^#{1,6}\s/, "");
        return line.startsWith(prefix) ? stripped : `${prefix}${stripped}`;
      }
      return line.startsWith(prefix) ? line.slice(prefix.length) : `${prefix}${line}`;
    })
    .join("\n");
  const next = value.slice(0, lineStart) + nextBlock + value.slice(lineEnd);
  return { next, start: lineStart, end: lineStart + nextBlock.length };
}

function insertSnippet(el: HTMLTextAreaElement, snippet: string, selectOffset: number, selectLength: number) {
  const { start, end } = selected(el);
  const next = el.value.slice(0, start) + snippet + el.value.slice(end);
  const caret = start + selectOffset;
  return { next, start: caret, end: caret + selectLength };
}

const TOOLS: Tool[] = [
  {
    label: "B",
    title: "Bold (⌘B)",
    run: (el) => wrap(el, "**", "**", "bold"),
  },
  {
    label: "I",
    title: "Italic (⌘I)",
    run: (el) => wrap(el, "*", "*", "italic"),
  },
  {
    label: "H2",
    title: "Heading",
    run: (el) => prefixLines(el, "## "),
  },
  {
    label: "H3",
    title: "Subheading",
    run: (el) => prefixLines(el, "### "),
  },
  {
    label: "Quote",
    title: "Quote",
    run: (el) => prefixLines(el, "> "),
  },
  {
    label: "List",
    title: "Bullet list",
    run: (el) => prefixLines(el, "- "),
  },
  {
    label: "1.",
    title: "Numbered list",
    run: (el) => prefixLines(el, "1. ", true),
  },
  {
    label: "Link",
    title: "Link (⌘K)",
    run: (el) => {
      const { text } = selected(el);
      const label = text || "link text";
      return wrap(el, "[", `](https://)`, label);
    },
  },
  {
    label: "Image",
    title: "Image",
    run: (el) => insertSnippet(el, "![alt text](https://)", 2, 8),
  },
  {
    label: "</>",
    title: "Inline code",
    run: (el) => wrap(el, "`", "`", "code"),
  },
  {
    label: "{ }",
    title: "Code block",
    run: (el) => wrap(el, "```\n", "\n```", "code"),
  },
  {
    label: "—",
    title: "Divider",
    run: (el) => insertSnippet(el, "\n\n---\n\n", 4, 3),
  },
];

export function MarkdownEditor({
  name,
  value,
  onChange,
  required,
  disabled,
  rows = 16,
}: MarkdownEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function apply(tool: Tool) {
    const el = ref.current;
    if (!el || disabled) return;
    const result = tool.run(el);
    onChange(result.next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.start, result.end);
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const meta = event.metaKey || event.ctrlKey;
    if (!meta) return;
    const key = event.key.toLowerCase();
    const tool =
      key === "b"
        ? TOOLS.find((item) => item.title.startsWith("Bold"))
        : key === "i"
          ? TOOLS.find((item) => item.title.startsWith("Italic"))
          : key === "k"
            ? TOOLS.find((item) => item.title.startsWith("Link"))
            : undefined;
    if (!tool) return;
    event.preventDefault();
    apply(tool);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface focus-within:border-accent">
      <div className="-mx-px flex gap-1 overflow-x-auto border-b border-border px-2 py-1.5">
        {TOOLS.map((tool) => (
          <button
            key={tool.title}
            type="button"
            title={tool.title}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => apply(tool)}
            className="shrink-0 rounded-lg px-2.5 py-1.5 font-mono text-[11px] font-semibold tracking-wide text-text-muted hover:bg-surface-hover hover:text-accent disabled:opacity-50"
          >
            {tool.label === "B" ? (
              <span className="font-extrabold">B</span>
            ) : tool.label === "I" ? (
              <span className="italic">I</span>
            ) : (
              tool.label
            )}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        name={name}
        required={required}
        disabled={disabled}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        className="w-full resize-y border-0 bg-transparent px-3 py-3 font-mono text-sm text-text outline-none"
        placeholder="Write in Markdown, or use the toolbar above."
      />
    </div>
  );
}
