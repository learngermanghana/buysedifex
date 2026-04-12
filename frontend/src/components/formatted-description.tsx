import type { ReactNode } from 'react';

type FormattedDescriptionProps = {
  text: string;
  className?: string;
};

const normalizeDescription = (input: string) => {
  const withBulletBreaks = input.replace(/\s-\s(?=\*\*)/g, '\n- ');
  return withBulletBreaks
    .replace(/\*\*(?=[^*]{1,60}:\*\*)/g, '\n**')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const renderInlineBold = (line: string) => {
  const segments = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return segments.map((segment, index) => {
    if (segment.startsWith('**') && segment.endsWith('**')) {
      return <strong key={`bold-${index}`}>{segment.slice(2, -2)}</strong>;
    }

    return <span key={`text-${index}`}>{segment}</span>;
  });
};

const renderLine = (line: string, key: string): ReactNode => {
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

  const lines = normalizedText.split(/\n+/);
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
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('- ')) {
      listItems.push(trimmedLine.slice(2).trim());
      return;
    }

    flushList(`block-${index}`);
    const renderedLine = renderLine(trimmedLine, `paragraph-${index}`);
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
