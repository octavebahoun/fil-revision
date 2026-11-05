"use client";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronRight, List, Network } from "lucide-react";
import { Button } from "@/components/ui/button";

export type MapNode = { id: string; label: string; href?: string; mastery?: number | null; children?: MapNode[] };

type Flat = { node: MapNode; depth: number; parent: string | null };

function flatten(
  nodes: MapNode[],
  open: Set<string>,
  depth = 0,
  parent: string | null = null,
  out: Flat[] = [],
): Flat[] {
  for (const n of nodes) {
    out.push({ node: n, depth, parent });
    if (n.children?.length && open.has(n.id)) flatten(n.children, open, depth + 1, n.id, out);
  }
  return out;
}

/**
 * Carte mentale d'une matière : arbre navigable au clavier (flèches, Entrée, Origine/Fin),
 * avec une version texte équivalente.
 */
export function MindMap({ root }: { root: MapNode }) {
  const router = useRouter();
  const [open, setOpen] = useState<Set<string>>(() => new Set([root.id, ...(root.children ?? []).map((c) => c.id)]));
  const [focusId, setFocusId] = useState(root.id);
  const [textView, setTextView] = useState(false);
  const refs = useRef(new Map<string, HTMLDivElement>());
  const flat = useMemo(() => flatten([root], open), [root, open]);

  const focus = (id: string) => {
    setFocusId(id);
    requestAnimationFrame(() => refs.current.get(id)?.focus());
  };
  const toggle = (id: string, value?: boolean) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (value ?? !next.has(id)) next.add(id);
      else next.delete(id);
      return next;
    });

  const onKey = (e: KeyboardEvent, f: Flat, i: number) => {
    const hasKids = Boolean(f.node.children?.length);
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (flat[i + 1]) focus(flat[i + 1]!.node.id);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (flat[i - 1]) focus(flat[i - 1]!.node.id);
        break;
      case "ArrowRight":
        e.preventDefault();
        if (hasKids && !open.has(f.node.id)) toggle(f.node.id, true);
        else if (hasKids) focus(f.node.children![0]!.id);
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (hasKids && open.has(f.node.id)) toggle(f.node.id, false);
        else if (f.parent) focus(f.parent);
        break;
      case "Home":
        e.preventDefault();
        focus(flat[0]!.node.id);
        break;
      case "End":
        e.preventDefault();
        focus(flat.at(-1)!.node.id);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (f.node.href) router.push(f.node.href);
        else if (hasKids) toggle(f.node.id);
        break;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Button variant="outline" className="w-fit" onClick={() => setTextView((t) => !t)} aria-pressed={textView}>
        {textView ? <Network aria-hidden="true" /> : <List aria-hidden="true" />}
        {textView ? "Voir la carte" : "Version texte"}
      </Button>
      {textView ? (
        <TextVersion node={root} />
      ) : (
        <div role="tree" aria-label={`Carte mentale : ${root.label}`} className="flex flex-col gap-1">
          {flat.map((f, i) => {
            const hasKids = Boolean(f.node.children?.length);
            const expanded = hasKids ? open.has(f.node.id) : undefined;
            return (
              <div
                key={f.node.id}
                ref={(el) => {
                  if (el) refs.current.set(f.node.id, el);
                }}
                role="treeitem"
                aria-level={f.depth + 1}
                aria-expanded={expanded}
                aria-selected={focusId === f.node.id}
                tabIndex={focusId === f.node.id ? 0 : -1}
                onKeyDown={(e) => onKey(e, f, i)}
                onClick={() => {
                  setFocusId(f.node.id);
                  if (f.node.href) router.push(f.node.href);
                  else if (hasKids) toggle(f.node.id);
                }}
                className="relative flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl pr-3 outline-none focus-visible:outline-3 focus-visible:outline-ring"
                style={{ paddingLeft: `${f.depth * 1.5 + 0.5}rem` }}
              >
                {f.depth > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 bottom-0 border-l-2 border-border"
                    style={{ left: `${f.depth * 1.5 - 0.6}rem` }}
                  />
                ) : null}
                {hasKids ? (
                  <ChevronRight
                    className={`size-5 shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
                    aria-hidden="true"
                  />
                ) : (
                  <span aria-hidden="true" className="ml-1.5 size-2 shrink-0 rounded-full bg-primary/60" />
                )}
                <span
                  className={`rounded-xl px-3 py-2 ${
                    f.depth === 0
                      ? "bg-primary text-lg font-bold text-primary-foreground"
                      : f.depth === 1
                        ? "bg-secondary font-semibold text-secondary-foreground"
                        : "bg-card"
                  }`}
                >
                  {f.node.label}
                  {typeof f.node.mastery === "number" ? (
                    <span className="ml-2 text-sm font-normal opacity-80">{f.node.mastery} %</span>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Clavier : ↑ ↓ pour se déplacer, → ← pour ouvrir ou fermer, Entrée pour ouvrir une notion.
      </p>
    </div>
  );
}

function TextVersion({ node }: { node: MapNode }) {
  return (
    <ul className="flex flex-col gap-1 pl-5" style={{ listStyleType: "disc" }}>
      <li>
        {node.href ? (
          <a href={node.href} className="text-primary underline-offset-4 hover:underline">
            {node.label}
          </a>
        ) : (
          <span className="font-semibold">{node.label}</span>
        )}
        {node.children?.length ? (
          <ul className="mt-1 flex flex-col gap-1 pl-5" style={{ listStyleType: "circle" }}>
            {node.children.map((c) => (
              <TextVersion key={c.id} node={c} />
            ))}
          </ul>
        ) : null}
      </li>
    </ul>
  );
}
