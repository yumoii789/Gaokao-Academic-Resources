import katex from 'katex';
import 'katex/dist/katex.min.css';

export default function MathText({ text, className }: { text: string; className?: string }) {
  const parts: { type: 'text' | 'math'; body: string }[] = [];
  const regex = /\$([^$]+)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: 'text', body: text.slice(last, m.index) });
    parts.push({ type: 'math', body: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', body: text.slice(last) });

  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.type === 'text' ? (
          <span key={i}>{p.body}</span>
        ) : (
          <span
            key={i}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(p.body, { throwOnError: false, output: 'html' }),
            }}
          />
        )
      )}
    </span>
  );
}
