import katex from 'katex';

/**
 * Renders a string that may contain inline LaTeX delimited by single `$...$`
 * (the format produced by the AI question scrapper). Math segments are
 * rendered with KaTeX; everything else is plain text. Mirrors the admin
 * frontend's MathText component so both apps display questions identically.
 * KaTeX styles are loaded globally in app/layout.tsx.
 */
export function MathText({ text, className }: { text?: string | null; className?: string }) {
  const value = text ?? '';
  if (!value) return <span className={className} />;

  // Split on $...$ while keeping the delimiters' content. Escaped \$ is left as literal.
  const segments = value.split(/(\$[^$]+\$)/g);

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.length > 1 && seg.startsWith('$') && seg.endsWith('$')) {
          const expr = seg.slice(1, -1);
          try {
            const html = katex.renderToString(expr, {
              throwOnError: false,
              displayMode: false,
            });
            return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
          } catch {
            return <span key={i}>{seg}</span>;
          }
        }
        return <span key={i}>{seg}</span>;
      })}
    </span>
  );
}

export default MathText;
