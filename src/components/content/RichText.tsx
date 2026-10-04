import { parseInline, type Block } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

function InlineText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((t, i) =>
        t.kind === "bold" ? <strong key={i} className="font-semibold text-foreground">{t.text}</strong>
        : t.kind === "italic" ? <em key={i}>{t.text}</em>
        : t.kind === "link" ? (
          <a key={i} href={t.href} className="underline decoration-accent underline-offset-4 hover:text-accent" {...(t.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{t.text}</a>
        ) : <span key={i}>{t.text}</span>,
      )}
    </>
  );
}

/** Renders validated blocks as semantic, script-free markup. */
export function RichText({ blocks, className }: { blocks: Block[]; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-6 text-body-lg text-foreground/85", className)}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading":
            return b.level === 2
              ? <h2 key={i} className="text-h2 mt-8 text-foreground"><InlineText text={b.text} /></h2>
              : <h3 key={i} className="text-h3 mt-4 text-foreground"><InlineText text={b.text} /></h3>;
          case "paragraph":
            return <p key={i} className="whitespace-pre-line"><InlineText text={b.text} /></p>;
          case "quote":
            return (
              <blockquote key={i} className="my-4 border-l-2 border-accent pl-6">
                <p className="text-h3 text-foreground"><InlineText text={b.text} /></p>
                {b.cite && <footer className="text-small mt-3 text-muted-foreground">— {b.cite}</footer>}
              </blockquote>
            );
          case "list": {
            const L = b.ordered ? "ol" : "ul";
            return (
              <L key={i} className={cn("flex flex-col gap-2 pl-6", b.ordered ? "list-decimal" : "list-disc")}>
                {b.items.map((it, j) => <li key={j}><InlineText text={it} /></li>)}
              </L>
            );
          }
          case "image":
            return (
              <figure key={i} className="my-4">
                <img src={b.url} alt={b.alt} loading="lazy" decoding="async" className="w-full rounded-[6px] object-cover" />
                {b.caption && <figcaption className="text-small mt-3 text-muted-foreground">{b.caption}</figcaption>}
              </figure>
            );
        }
      })}
    </div>
  );
}
