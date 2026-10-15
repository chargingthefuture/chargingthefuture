import type { CSSProperties, ReactNode } from 'react';
import { parseMarkdown, type MdBlock, type MdInline } from 'lib/markdown/simple-markdown';

// Renders Markdown read by lib/markdown/simple-markdown.ts as React elements. Text is always set as
// text, never as HTML, so nothing in the source can add markup to the page.

type Palette = { text: string; muted: string; accent: string; border: string };

function renderInline(nodes: MdInline[], palette: Palette): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'text':
        return node.text;
      case 'strong':
        return <strong key={index}>{renderInline(node.children, palette)}</strong>;
      case 'em':
        return <em key={index}>{renderInline(node.children, palette)}</em>;
      case 'code':
        return (
          <code key={index} style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.92em', whiteSpace: 'pre-wrap' }}>
            {node.text}
          </code>
        );
      case 'link': {
        const external = /^https?:/i.test(node.href);
        return (
          <a
            key={index}
            href={node.href}
            style={{ color: palette.accent, textDecoration: 'underline', textUnderlineOffset: 3, overflowWrap: 'anywhere' }}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {renderInline(node.children, palette)}
          </a>
        );
      }
      default:
        return null;
    }
  });
}

function renderBlock(block: MdBlock, index: number, palette: Palette): ReactNode {
  const paragraph: CSSProperties = { margin: 0, lineHeight: 1.6, overflowWrap: 'anywhere' };
  switch (block.type) {
    case 'heading': {
      const size = block.level === 2 ? 16 : block.level === 3 ? 15 : 14;
      const Tag = `h${block.level + 1}` as 'h3' | 'h4' | 'h5';
      return <Tag key={index} style={{ margin: '4px 0 0', fontSize: size, fontWeight: 700, color: palette.text }}>{renderInline(block.children, palette)}</Tag>;
    }
    case 'quote':
      return (
        <blockquote key={index} style={{ ...paragraph, borderLeft: `3px solid ${palette.border}`, paddingLeft: 12, color: palette.muted }}>
          {renderInline(block.children, palette)}
        </blockquote>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag key={index} style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4, lineHeight: 1.6 }}>
          {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, palette)}</li>)}
        </Tag>
      );
    }
    case 'rule':
      return <hr key={index} style={{ border: 0, borderTop: `1px solid ${palette.border}`, margin: '4px 0' }} />;
    default:
      return <p key={index} style={paragraph}>{renderInline(block.children, palette)}</p>;
  }
}

/** Markdown as page content. The heading levels start at h3, under the card's own title. */
export function SimpleMarkdown({ source, palette }: { source: string; palette: Palette }) {
  const blocks = parseMarkdown(source);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, color: palette.text }}>
      {blocks.map((block, index) => renderBlock(block, index, palette))}
    </div>
  );
}
