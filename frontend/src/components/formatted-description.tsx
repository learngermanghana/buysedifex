import type { ReactNode } from 'react';

type FormattedDescriptionProps = {
  text: string;
  className?: string;
};

type ParsedLine = {
  kind: 'paragraph' | 'heading' | 'listItem';
  text: string;
};

const cleanLine = (line: string) =>
  line
    .replace(/^[-–—•·▪◦]\s*$/, '')
    .replace(/^[-–—•·▪◦]\s+/, '- ')
    .replace(/\*\*\s*([^*]+?)\s*\*\*/g, '**$1**')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeDescription = (input: string) => {
  const withBreaks = input
    .replace(/\r\n/g, '\n')
    .replace(/\s-\s(?=\*\*[^*]{1,80}:)/g, '\n- ')
    .replace(/\n\s*[-–—•·▪◦]\s*\n/g, '\n')
    .replace(/\*\*(?=[^*]{1,80}:\*\*)/g, '\n**')
    .replace(/(Key benefits?|Benefits?|What you get|Includes?|Highlights?)\s*:\s*/gi, '\n$1:\n')
    .replace(/\n{3,}/g, '\n\n');

  return withBreaks
    .split('\n')
    .map(cleanLine)
    .filter(Boolean)
    .join('\n')
    .trim();
};

const renderInlineBold = (line: string) => {
  const normalized = line.replace(/\*\*([^*]+?):\*\*/g, '**$1:**');
  const segments = normalized.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return segments.map((segment, index) => {
    if (segment.startsWith('**') && segment.endsWith('**')) {
      return <strong key={`bold-${index}`}>{segment.slice(2, -2)}</strong>;
    }

    return <span key={`text-${index}`}>{segment}</span>;
  });
};

const parseLines = (text: string): ParsedLine[] => {
  const lines = text.split(/\n+/).map(cleanLine).filter(Boolean);

  return lines.map((line) => {
    if (line.startsWith('- ')) {
      return { kind: 'listItem', text: line.slice(2).trim() };
    }

    if (/^(Key benefits?|Benefits?|What you get|Includes?|Highlights?|Why choose this|What is included):?$/i.test(line)) {
      return { kind: 'heading', text: line.replace(/:$/, '') };
    }

    if (/^\*\*[^*]{1,80}:\*\*\s+/.test(line)) {
      return { kind: 'listItem', text: line };
    }

    return { kind: 'paragraph', text: line };
  });
};

const renderParagraph = (line: string, key: string): ReactNode => {
  const trimmedLine = line.trim();

  if (!trimmedLine) {
    return null;
  }

  return <p key={key}>{renderInlineBold(trimmedLine)}</p>;
};

export function FormattedDescription({ text, className }: FormattedDescriptionProps) {
  const normalizedText = normalizeDescription(text);

  if (!normalizedText) {
    return null;
  }

  const lines = parseLines(normalizedText);
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (keyPrefix: string) => {
    if (listItems.length === 0) {
      return;
    }

    blocks.push(
      <ul key={`${keyPrefix}-list`}>
        {listItems.map((item, index) => (
          <li key={`${keyPrefix}-item-${index}`}>{renderInlineBold(item)}</li>
        ))}
      </ul>,
    );

    listItems = [];
  };

  lines.forEach((line, index) => {
    if (line.kind === 'listItem') {
      listItems.push(line.text);
      return;
    }

    flushList(`block-${index}`);

    if (line.kind === 'heading') {
      blocks.push(<h3 key={`heading-${index}`}>{line.text}</h3>);
      return;
    }

    const renderedLine = renderParagraph(line.text, `paragraph-${index}`);
    if (renderedLine) {
      blocks.push(renderedLine);
    }
  });

  flushList('final');

  if (blocks.length === 0) {
    return null;
  }

  return <div className={className}>{blocks}</div>;
}
