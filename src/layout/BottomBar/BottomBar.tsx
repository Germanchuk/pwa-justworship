import { ReactNode, RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { HomeIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Loader2 } from "lucide-react";

import { Routes, bandPath } from "#constants/routes";
import { usePageBar } from "#layout/PageBar/hooks";
import { useBandOrNull } from "#modules/Band/BandLayout";
import { cn } from "@/lib/utils";
import { barSpot } from "./path";

/** Скільки літер назви гурту влазить у шлях на 375px (`APP-33`). */
const BAND_NAME_MAX = 10;
/** Одна тривалість на всі рухи бару — пункти й підсвітка йдуть разом. */
const MOTION = "duration-250 ease-out";
/** Висота бару (44px) + відступ від низу. Під нього сторінка лишає місце. */
const BAR_SPACE = "calc(44px + 1rem + env(safe-area-inset-bottom))";

const shorten = (name: string) =>
  name.length > BAND_NAME_MAX ? `${name.slice(0, BAND_NAME_MAX).trimEnd()}…` : name;

/**
 * Нижній бар (`APP-5`, `APP-8`, `APP-30`–`APP-36`): шлях `🏠 · Гурт · Екран`
 * у скляній плашці й дві круглі кнопки — пошук і профіль. Живе ВИЩЕ роутів:
 * гурт бере з адреси (`useBandOrNull`), підпис списку — від сторінки
 * (`ToPageBar`).
 *
 * Рух: весь бар стоїть по центру, тож коли пункт шляху виростає чи
 * стискається, бар розсувається від центру в обидва боки. Пункт, що зникає,
 * доживає анімацію зі своїм старим підписом.
 */
export default function BottomBar() {
  const { hidden, title } = usePageBar();
  const { pathname } = useLocation();
  const band = useBandOrNull();
  const user = useSelector((state: any) => state.user);
  const isLoading = useSelector((state: any) => state.viewConfig.globalLoader);
  const typing = useTyping();

  const spot = barSpot(pathname);
  // Підпис від сторінки — лише якщо його поставила саме ця адреса.
  const screenLabel =
    spot.screen && title?.path === pathname ? title.title : spot.screen;
  const bandCrumb = useLastValue(spot.bandId && band ? band : null);
  const screenCrumb = useLastValue(screenLabel);

  const pillRef = useRef<HTMLDivElement>(null);
  const homeRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const activeRef =
    spot.active === "home" ? homeRef
    : spot.active === "band" ? bandRef
    : spot.active === "screen" ? screenRef
    : null;
  const highlight = useHighlight(pillRef, activeRef, hidden);

  if (hidden) return null;

  return (
    <>
      {/* Місце під бар у потоці сторінки: останній рядок не ховається під ним. */}
      <div aria-hidden className="shrink-0" style={{ height: BAR_SPACE }} />

      <nav
        aria-label="Навігація"
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-2 transition-[translate,opacity] duration-200",
          // Поки вводять текст, бар іде з-під пальців і з-над клавіатури (`APP-35`).
          typing && "translate-y-full opacity-0"
        )}
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="pointer-events-auto flex items-center gap-1">
          <div ref={pillRef} className="glass relative flex h-11 items-center rounded-full p-[3px]">
            <span
              aria-hidden
              className={cn(
                "absolute inset-y-[3px] rounded-full bg-accent",
                highlight.animate && `transition-[left,width,opacity] ${MOTION}`
              )}
              style={{
                left: highlight.box?.left ?? 0,
                width: highlight.box?.width ?? 0,
                opacity: highlight.box ? 1 : 0,
              }}
            />

            <Slot open slotRef={homeRef}>
              <Crumb to={Routes.Root} active={spot.active === "home"} label="Додому" icon>
                {isLoading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <HomeIcon className="size-5" />
                )}
              </Crumb>
            </Slot>

            <Slot open={!!spot.bandId} slotRef={bandRef}>
              {bandCrumb && (
                <Crumb to={bandPath.home(bandCrumb.id)} active={spot.active === "band"}>
                  {shorten(bandCrumb.name)}
                </Crumb>
              )}
            </Slot>

            <Slot open={!!spot.screen} slotRef={screenRef}>
              {/* Екран у шляху завжди поточний — тапати по ньому нікуди. */}
              <Crumb active>{screenCrumb}</Crumb>
            </Slot>
          </div>

          <Circle to={Routes.SearchSongs} active={spot.active === "search"} label="Пошук">
            <MagnifyingGlassIcon className="size-5" />
          </Circle>
          <Circle to={Routes.Preferences} active={spot.active === "profile"} label="Профіль">
            <span className="text-xs font-bold">
              {(user?.username ?? "").slice(0, 2).toUpperCase()}
            </span>
          </Circle>
        </div>
      </nav>
    </>
  );
}

/**
 * Місце пункту в шляху. Ширина росте від нуля до своєї через
 * `grid-template-columns: 0fr → 1fr`: так CSS уміє анімувати «до авто».
 */
function Slot({
  open,
  slotRef,
  children,
}: {
  open: boolean;
  slotRef: RefObject<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <div
      ref={slotRef}
      aria-hidden={!open}
      // `relative` — щоб пункт малювався НАД підсвіткою: та позиціонована.
      className={cn(
        "relative grid transition-[grid-template-columns,opacity]",
        MOTION,
        !open && "pointer-events-none"
      )}
      style={{ gridTemplateColumns: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
    >
      <div className="min-w-0 overflow-hidden">{children}</div>
    </div>
  );
}

/** Пункт шляху. Поточний — не посилання: тап по ньому нічого не робить (`APP-31`). */
function Crumb({
  to,
  active,
  label,
  icon,
  children,
}: {
  to?: string;
  active: boolean;
  label?: string;
  icon?: boolean;
  children: ReactNode;
}) {
  const className = cn(
    "flex h-[36px] items-center justify-center whitespace-nowrap rounded-full text-sm font-semibold",
    icon ? "w-[36px]" : "px-3"
  );

  if (active || !to) {
    return (
      <span aria-current="page" aria-label={label} className={className}>
        {children}
      </span>
    );
  }
  return (
    <Link to={to} aria-label={label} className={className}>
      {children}
    </Link>
  );
}

/** Кругла кнопка поруч зі шляхом: пошук чи профіль (`APP-8`, `APP-32`). */
function Circle({
  to,
  active,
  label,
  children,
}: {
  to: string;
  active: boolean;
  label: string;
  children: ReactNode;
}) {
  const className = cn(
    "glass flex size-11 shrink-0 items-center justify-center rounded-full",
    active && "bg-accent"
  );

  if (active) {
    return (
      <span aria-current="page" aria-label={label} className={className}>
        {children}
      </span>
    );
  }
  return (
    <Link to={to} aria-label={label} title={label} className={className}>
      {children}
    </Link>
  );
}

/** Останнє непорожнє значення: пункт, що стискається, не лишається без підпису. */
function useLastValue<T>(value: T | null): T | null {
  const last = useRef(value);
  if (value != null) last.current = value;
  return last.current;
}

/**
 * Підсвітка поточного пункту — окрема плашка під пунктами, що перетікає з
 * місця на місце. Поки пункти ростуть, плашка міряє поточний щокадру (зміну
 * ширини шляху ловить `ResizeObserver`) і наздоганяє його своїм переходом.
 * Перший замір — без переходу, щоб бар не «виїжджав» при відкритті.
 */
function useHighlight(
  pillRef: RefObject<HTMLElement>,
  activeRef: RefObject<HTMLElement> | null,
  hidden: boolean
) {
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const pill = pillRef.current;
    const active = activeRef?.current;
    if (!pill || !active) {
      setBox(null);
      // Бар сховали (пісня) — повернеться на місце без «виїжджання».
      if (!pill) setAnimate(false);
      return;
    }
    const measure = () => setBox({ left: active.offsetLeft, width: active.offsetWidth });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(pill);
    observer.observe(active);
    return () => observer.disconnect();
  }, [pillRef, activeRef, hidden]);

  useEffect(() => {
    if (box && !animate) requestAnimationFrame(() => setAnimate(true));
  }, [box, animate]);

  return { box, animate };
}

/** Чи вводять зараз текст — тоді на телефоні відкрита клавіатура. */
function useTyping() {
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    // `focusout` приходить раніше, ніж фокус сяде на нове поле, тож активний
    // елемент перевіряємо вже після того, як подія відбулась.
    const check = () =>
      setTimeout(() => setTyping(isTextField(document.activeElement)));
    document.addEventListener("focusin", check);
    document.addEventListener("focusout", check);
    return () => {
      document.removeEventListener("focusin", check);
      document.removeEventListener("focusout", check);
    };
  }, []);

  return typing;
}

const NOT_TEXT = new Set(["checkbox", "radio", "button", "submit", "reset", "range", "file", "color"]);

function isTextField(el: Element | null) {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el instanceof HTMLTextAreaElement) return true;
  return el instanceof HTMLInputElement && !NOT_TEXT.has(el.type);
}
