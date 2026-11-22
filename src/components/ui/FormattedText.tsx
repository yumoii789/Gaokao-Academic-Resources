import MathText from './MathText';

export default function FormattedText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        const bold = part.startsWith('**') && part.endsWith('**');
        const body = bold ? part.slice(2, -2) : part;
        return bold
          ? <strong key={i} className='font-semibold text-indigo-900'><MathText text={body} /></strong>
          : <MathText key={i} text={body} />;
      })}
    </span>
  );
}
