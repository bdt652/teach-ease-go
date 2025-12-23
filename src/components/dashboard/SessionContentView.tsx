import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, ArrowLeft, Copy, Check } from 'lucide-react';

interface SessionContentViewProps {
  title: string;
  sessionOrder: number;
  content: string | null;
  className?: string;
  classCode?: string;
  onBack?: () => void;
  showControls?: boolean;
}

export default function SessionContentView({
  title,
  sessionOrder,
  content,
  className,
  classCode,
  onBack,
  showControls = true,
}: SessionContentViewProps) {
  const [fontSize, setFontSize] = useState(24); // Large default for TV
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const increaseFontSize = () => setFontSize((prev) => Math.min(prev + 4, 48));
  const decreaseFontSize = () => setFontSize((prev) => Math.max(prev - 4, 16));

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div>
              {classCode && (
                <Badge variant="outline" className="font-mono mb-1">
                  {classCode}
                </Badge>
              )}
              <h1 className="text-xl md:text-2xl font-bold text-foreground">
                Buổi {sessionOrder}: {title}
              </h1>
              {className && (
                <p className="text-muted-foreground text-sm">{className}</p>
              )}
            </div>
          </div>

          {showControls && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={decreaseFontSize}
                title="Giảm cỡ chữ"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground w-12 text-center">
                {fontSize}px
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={increaseFontSize}
                title="Tăng cỡ chữ"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {content ? (
            <article
              className="prose prose-lg dark:prose-invert max-w-none session-content"
              style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}
            >
              <ReactMarkdown
                components={{
                  // Custom image rendering for better TV display
                  img: ({ src, alt }) => (
                    <figure className="my-8">
                      <img
                        src={src}
                        alt={alt || ''}
                        className="rounded-xl shadow-lg max-h-[70vh] mx-auto object-contain"
                        loading="lazy"
                      />
                      {alt && (
                        <figcaption className="text-center text-muted-foreground mt-3 text-base">
                          {alt}
                        </figcaption>
                      )}
                    </figure>
                  ),
                  // Enhanced headings
                  h1: ({ children }) => (
                    <h1 className="text-4xl font-bold mt-12 mb-6 text-foreground border-b border-border pb-4">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-3xl font-semibold mt-10 mb-4 text-foreground">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-2xl font-semibold mt-8 mb-3 text-foreground">
                      {children}
                    </h3>
                  ),
                  // Enhanced paragraphs
                  p: ({ children }) => (
                    <p className="my-4 text-foreground leading-relaxed">
                      {children}
                    </p>
                  ),
                  // Enhanced code blocks with syntax highlighting
                  code: ({ className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeString = String(children).replace(/\n$/, '');
                    const isInline = !className && !codeString.includes('\n');
                    
                    if (isInline) {
                      return (
                        <code
                          className="bg-muted px-2 py-1 rounded text-primary font-mono text-[0.9em]"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }
                    
                    return (
                      <div className="relative group my-6">
                        <button
                          onClick={() => copyCode(codeString)}
                          className="absolute right-3 top-3 p-2 rounded-md bg-background/50 hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Copy code"
                        >
                          {copiedCode === codeString ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                        <SyntaxHighlighter
                          style={oneDark as { [key: string]: React.CSSProperties }}
                          language={match ? match[1] : 'text'}
                          PreTag="div"
                          customStyle={{
                            margin: 0,
                            borderRadius: '0.75rem',
                            fontSize: '0.875em',
                            padding: '1.5rem',
                          }}
                        >
                          {codeString}
                        </SyntaxHighlighter>
                        {match && (
                          <span className="absolute left-3 top-3 text-xs text-muted-foreground uppercase font-mono">
                            {match[1]}
                          </span>
                        )}
                      </div>
                    );
                  },
                  // Enhanced lists
                  ul: ({ children }) => (
                    <ul className="my-6 space-y-3 list-disc list-inside">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="my-6 space-y-3 list-decimal list-inside">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-foreground">{children}</li>
                  ),
                  // Enhanced blockquote
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary pl-6 my-6 italic text-muted-foreground bg-muted/50 py-4 pr-4 rounded-r-lg">
                      {children}
                    </blockquote>
                  ),
                  // Enhanced table
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-6">
                      <table className="w-full border-collapse border border-border rounded-lg overflow-hidden">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="bg-muted px-4 py-3 text-left font-semibold border border-border">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-4 py-3 border border-border">{children}</td>
                  ),
                  // Links
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {children}
                    </a>
                  ),
                  // Horizontal rule
                  hr: () => <hr className="my-8 border-border" />,
                }}
              >
                {content}
              </ReactMarkdown>
            </article>
          ) : (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-xl">
                Chưa có nội dung cho buổi học này
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
