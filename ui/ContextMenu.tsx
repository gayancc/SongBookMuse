import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** A command row, a thin divider, or a FL Studio style section heading bar. */
export type MenuItem =
  | { kind?: "item"; label: string; disabled?: boolean; items?: MenuItem[]; run?: () => void }
  | { kind: "separator" }
  | { kind: "heading"; label: string };

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  close: () => void;
}

type Command = Extract<MenuItem, { label: string; kind?: "item" }>;
const isCommand = (item: MenuItem): item is Command => item.kind === undefined || item.kind === "item";

/** Keeps a popup inside the window, flipping it to the other side of its anchor when it would overflow. */
function usePlacement(ref: React.RefObject<HTMLDivElement | null>, x: number, y: number, flipX: number) {
  const [position, setPosition] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const left = x + box.width > window.innerWidth ? Math.max(0, flipX - box.width) : x;
    const top = y + box.height > window.innerHeight ? Math.max(0, window.innerHeight - box.height) : y;
    setPosition({ left, top });
  }, [ref, x, y, flipX]);
  return position;
}

interface MenuListProps {
  items: MenuItem[];
  x: number;
  y: number;
  flipX: number;
  close: () => void;
  depth: number;
  /** Move keyboard focus to the first command (keyboard or click opening); otherwise focus the menu itself. */
  focusFirst: boolean;
}

function MenuList({ items, x, y, flipX, close, depth, focusFirst }: MenuListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const position = usePlacement(ref, x, y, flipX);
  const [open, setOpen] = useState<{ index: number; x: number; y: number; flipX: number; focus: boolean } | null>(null);

  useEffect(() => {
    const menu = ref.current;
    const first = menu?.querySelector<HTMLButtonElement>(":scope > button:not(:disabled)");
    if (focusFirst && first) first.focus();
    else menu?.focus({ preventScroll: true });
  }, [focusFirst]);

  function expand(index: number, target: HTMLElement, focusChild = false) {
    if (open?.index === index && !focusChild) return;
    const row = target.getBoundingClientRect();
    const menu = ref.current?.getBoundingClientRect() ?? row;
    // Submenus sit flush against the parent's edge with their first row level with the parent row.
    setOpen({ index, x: menu.right - 1, y: row.top - 2, flipX: menu.left + 1, focus: focusChild });
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.target !== ref.current && !ref.current?.contains(event.target as Node)) return;
    const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>(":scope > button:not(:disabled)") ?? []);
    if (!buttons.length) return;
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const handled = () => { event.preventDefault(); event.stopPropagation(); };
    if (event.key === "ArrowDown") { handled(); buttons[(at + 1) % buttons.length].focus(); }
    else if (event.key === "ArrowUp") { handled(); buttons[at <= 0 ? buttons.length - 1 : at - 1].focus(); }
    else if (event.key === "Home") { handled(); buttons[0].focus(); }
    else if (event.key === "End") { handled(); buttons[buttons.length - 1].focus(); }
    else if (event.key === "ArrowLeft" && depth > 0) { handled(); close(); }
    else if (event.key === "ArrowRight" && at >= 0) {
      const index = Number(buttons[at].dataset.index);
      const item = items[index];
      if (item && isCommand(item) && item.items) { handled(); expand(index, buttons[at], true); }
    }
  }

  const child = open ? items[open.index] : undefined;
  return <div ref={ref} className="popup-menu" role="menu" tabIndex={-1} style={{ left: position.left, top: position.top }}
    onKeyDown={onKeyDown}>
    {items.map((item, index) => {
      if (item.kind === "separator") return <div key={"s" + index} className="popup-separator" role="separator"/>;
      if (item.kind === "heading") return <div key={"h" + index} className="popup-heading" role="presentation">{item.label}</div>;
      const parent = Boolean(item.items);
      return <button key={item.label + index} type="button" role="menuitem" data-index={index} disabled={item.disabled}
        tabIndex={-1} aria-haspopup={parent ? "menu" : undefined} aria-expanded={parent ? open?.index === index : undefined}
        onMouseEnter={event => {
          event.currentTarget.focus({ preventScroll: true });
          if (parent && !item.disabled) expand(index, event.currentTarget); else setOpen(null);
        }}
        onClick={event => { if (parent) expand(index, event.currentTarget, true); else item.run?.(); }}>
        <span className="popup-label">{item.label}</span>
        {parent && <span className="popup-arrow" aria-hidden="true"/>}
      </button>;
    })}
    {open && child && isCommand(child) && child.items && <MenuList items={child.items} x={open.x} y={open.y} flipX={open.flipX}
      depth={depth + 1} focusFirst={open.focus} close={() => {
        setOpen(null);
        ref.current?.querySelector<HTMLButtonElement>(`[data-index="${open.index}"]`)?.focus();
      }}/>}
  </div>;
}

/** Right-click popup menu anchored at the pointer. Closes on outside press, Escape, blur, resize or scroll. */
export function ContextMenu({ x, y, items, close }: ContextMenuProps) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const outside = (event: Event) => { if (!root.current?.contains(event.target as Node)) close(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); close(); } };
    window.addEventListener("pointerdown", outside, true);
    window.addEventListener("wheel", outside, true);
    window.addEventListener("keydown", escape, true);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("wheel", outside, true);
      window.removeEventListener("keydown", escape, true);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
    };
  }, [close]);
  const wrap = (item: MenuItem): MenuItem => !isCommand(item) ? item :
    { ...item, items: item.items?.map(wrap), run: item.run && (() => { close(); item.run?.(); }) };
  return <div ref={root} className="context-menu-layer">
    <MenuList items={items.map(wrap)} x={x} y={y} flipX={x} close={close} depth={0} focusFirst={false}/>
  </div>;
}
