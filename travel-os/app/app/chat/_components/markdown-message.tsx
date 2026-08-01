"use client";

import { copyTextToClipboard } from "@/app/app/chat/_lib/chat-client-actions";
import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

type MarkdownMessageProps = {
  content: string;
  className?: string;
};

function isSafeHref(href: string) {
  return (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("/") ||
    href.startsWith("mailto:")
  );
}

function isSafeImageSrc(src: string) {
  return src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/");
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const ok = await copyTextToClipboard(code);
    if (ok) {
      setCopied(true);
      toast.success("Code copied");
      window.setTimeout(() => setCopied(false), 1600);
    } else {
      toast.error("Couldn’t copy code");
    }
  };

  return (
    <div className="overflow-hidden rounded-xl bg-slate-900 ring-1 ring-slate-800">
      <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 px-3 py-1.5">
        <span className="truncate font-mono text-[0.65rem] uppercase tracking-wide text-slate-400">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={() => void onCopy()}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.65rem] font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[0.8rem] leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function SafeImage({ src, alt }: { src: string; alt: string }) {
  if (!isSafeImageSrc(src)) {
    return <span>{alt || src}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- chat markdown may reference arbitrary https URLs
    <img
      src={src}
      alt={alt || "Image"}
      loading="lazy"
      className="my-1 max-h-80 w-auto max-w-full rounded-lg border border-slate-200 object-contain"
    />
  );
}

function inlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${idx}`} className="font-semibold text-slate-900">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("*")) {
      nodes.push(
        <em key={`${keyPrefix}-i-${idx}`} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${idx}`}
          className="rounded bg-slate-900/10 px-1 py-0.5 font-mono text-[0.85em] text-slate-800"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("![")) {
      const imageMatch = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(token);
      if (imageMatch) {
        nodes.push(
          <SafeImage
            key={`${keyPrefix}-img-${idx}`}
            alt={imageMatch[1] ?? ""}
            src={imageMatch[2]!.trim()}
          />,
        );
      } else {
        nodes.push(token);
      }
    } else {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) {
        const href = linkMatch[2]!.trim();
        if (isSafeHref(href)) {
          nodes.push(
            <a
              key={`${keyPrefix}-a-${idx}`}
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel={href.startsWith("http") ? "noreferrer" : undefined}
              className="font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800"
            >
              {linkMatch[1]}
            </a>,
          );
        } else {
          nodes.push(token);
        }
      } else {
        nodes.push(token);
      }
    }
    last = match.index + token.length;
    idx += 1;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length > 0 ? nodes : [text];
}

function parseTableBlock(trimmed: string): { headers: string[]; rows: string[][] } | null {
  const lines = trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;
  if (!lines.every((l) => l.includes("|"))) return null;

  const splitRow = (line: string) => {
    let s = line;
    if (s.startsWith("|")) s = s.slice(1);
    if (s.endsWith("|")) s = s.slice(0, -1);
    return s.split("|").map((c) => c.trim());
  };

  const headers = splitRow(lines[0]!);
  const sep = lines[1]!;
  const sepCells = splitRow(sep);
  const isSeparator =
    sepCells.length === headers.length &&
    sepCells.every((c) => /^:?-{3,}:?$/.test(c.replace(/\s/g, "")));
  if (!isSeparator || headers.length === 0) return null;

  const rows = lines.slice(2).map(splitRow).filter((r) => r.some((c) => c.length > 0));
  return { headers, rows };
}

type Block =
  | { type: "code"; language?: string; code: string }
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "hr" }
  | { type: "blockquote"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "paragraph"; text: string };

function tokenizeMarkdown(content: string): Block[] {
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Fenced code
    const fence = line.trim().match(/^```([\w+-]*)\s*$/);
    if (fence) {
      const language = fence[1] || undefined;
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]!.trim().startsWith("```")) {
        body.push(lines[i]!);
        i += 1;
      }
      if (i < lines.length) i += 1; // closing fence
      blocks.push({ type: "code", language, code: body.join("\n") });
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    // Heading
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1]!.length as 1 | 2 | 3,
        text: heading[2]!.trim(),
      });
      i += 1;
      continue;
    }

    // Table: peek ahead
    if (line.includes("|") && i + 1 < lines.length) {
      const tableLines: string[] = [];
      let j = i;
      while (j < lines.length && lines[j]!.trim() && lines[j]!.includes("|")) {
        tableLines.push(lines[j]!);
        j += 1;
      }
      const parsed = parseTableBlock(tableLines.join("\n"));
      if (parsed) {
        blocks.push({ type: "table", headers: parsed.headers, rows: parsed.rows });
        i = j;
        continue;
      }
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] ?? "")) {
        quoteLines.push((lines[i] ?? "").replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ type: "blockquote", lines: quoteLines });
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test((lines[i] ?? "").trim())) {
        items.push((lines[i] ?? "").trim().replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test((lines[i] ?? "").trim())) {
        items.push((lines[i] ?? "").trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Paragraph — collect until blank or next special block start
    const para: string[] = [line];
    i += 1;
    while (i < lines.length) {
      const next = lines[i] ?? "";
      if (!next.trim()) break;
      if (next.trim().startsWith("```")) break;
      if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(next.trim())) break;
      if (/^#{1,3}\s+/.test(next)) break;
      if (/^>\s?/.test(next)) break;
      if (/^[-*]\s+/.test(next.trim())) break;
      if (/^\d+\.\s+/.test(next.trim())) break;
      if (next.includes("|") && i + 1 < lines.length) {
        const peek = [next, lines[i + 1] ?? ""].join("\n");
        if (parseTableBlock(peek)) break;
      }
      para.push(next);
      i += 1;
    }
    blocks.push({ type: "paragraph", text: para.join("\n") });
  }

  return blocks;
}

function renderBlock(block: Block, index: number): ReactNode {
  switch (block.type) {
    case "code":
      return <CodeBlock key={`code-${index}`} code={block.code} language={block.language} />;
    case "heading": {
      const className =
        block.level === 1
          ? "text-base font-semibold tracking-tight text-slate-900"
          : block.level === 2
            ? "text-[0.95rem] font-semibold text-slate-900"
            : "text-sm font-semibold text-slate-800";
      return (
        <p key={`h-${index}`} className={className}>
          {inlineMarkdown(block.text, `h${index}`)}
        </p>
      );
    }
    case "hr":
      return <hr key={`hr-${index}`} className="border-slate-200" />;
    case "blockquote":
      return (
        <blockquote
          key={`bq-${index}`}
          className="border-l-2 border-slate-300 pl-3 text-slate-600"
        >
          {block.lines.map((line, li) => (
            <p key={`bql-${index}-${li}`} className="leading-relaxed">
              {inlineMarkdown(line, `bq${index}${li}`)}
            </p>
          ))}
        </blockquote>
      );
    case "ul":
      return (
        <ul key={`ul-${index}`} className="list-disc space-y-1 pl-5 marker:text-slate-400">
          {block.items.map((item, ii) => (
            <li key={`uli-${index}-${ii}`} className="leading-relaxed">
              {inlineMarkdown(item, `uli${index}${ii}`)}
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={`ol-${index}`} className="list-decimal space-y-1 pl-5 marker:text-slate-500">
          {block.items.map((item, ii) => (
            <li key={`oli-${index}-${ii}`} className="leading-relaxed">
              {inlineMarkdown(item, `oli${index}${ii}`)}
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div key={`table-${index}`} className="overflow-x-auto rounded-lg ring-1 ring-slate-200">
          <table className="min-w-full border-collapse text-left text-[0.8rem]">
            <thead className="bg-slate-100/80">
              <tr>
                {block.headers.map((h, hi) => (
                  <th
                    key={`th-${index}-${hi}`}
                    className="border-b border-slate-200 px-2.5 py-1.5 font-semibold text-slate-800"
                  >
                    {inlineMarkdown(h, `th${index}${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={`tr-${index}-${ri}`} className="odd:bg-white even:bg-slate-50/60">
                  {block.headers.map((_, ci) => (
                    <td
                      key={`td-${index}-${ri}-${ci}`}
                      className="border-b border-slate-100 px-2.5 py-1.5 text-slate-700"
                    >
                      {inlineMarkdown(row[ci] ?? "", `td${index}${ri}${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "paragraph":
      return (
        <p key={`p-${index}`} className="whitespace-pre-wrap leading-relaxed">
          {inlineMarkdown(block.text, `p${index}`)}
        </p>
      );
    default:
      return null;
  }
}

export default function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  const blocks = tokenizeMarkdown(content);

  return (
    <div className={`space-y-2.5 text-sm text-slate-800 ${className ?? ""}`}>
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  );
}
