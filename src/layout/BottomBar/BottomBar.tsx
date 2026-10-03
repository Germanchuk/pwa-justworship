import { ReactNode, RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { HomeIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Loader2 } from "lucide-react";

import { Routes, bandPath } from "#constants/routes";
import { usePageBar } from "#layout/PageBar/hooks";
import { useBandOrNull, type Band } from "#modules/Band/BandLayout";
import { cn } from "@/lib/utils";
import { barSpot } from "./path";

/** Скільки літер назви гурту влазить у шлях на 375px (`APP-33`). */
const BAND_NAME_MAX = 10;
/** Висота бару (52px) + відступ від низу. Під нього сторінка лишає місце. */
const BAR_SPACE = "calc(52px + 1rem + env(safe-area-inset-bottom))";
const GOO_FILTER = "bar-goo";
/** Скільки триває рух одного пункту — поява чи зникнення. */
const ITEM_MS = 400;

const shorten = (name: string) =>
  name.length > BAND_NAME_MAX ? `${name.slice(0, BAND_NAME_MAX).trimEnd()}…` : name;

/**
 * Шари бару, знизу вгору: `frost` — розмиття сторінки під кожною кнопкою;
 * `goo` — напівпрозорі краплі, що злипаються; `buttons` — самі кнопки.
 */
type Layer = "frost" | "goo" | "buttons";

/** Що показує бар — однаково для всіх шарів. */
type BarContent = {
  spot: ReturnType<typeof barSpot>;
  band: Band | null;
  screen: string | null;
  initials: string;
  isLoading: boolean;
  /** Місця ряду по порядку — 🏠, гурт, екран, пошук, профіль (`useQueue`). */
  slots: { open: boolean; delay: number }[];
};

/**
 * Нижній бар (`APP-5`, `APP-8`, `APP-30`–`APP-36`). На головній — пошук і
 * профіль; деінде — шлях `🏠 · Гурт · Екран`. Кожен пункт — окрема кнопка, а
 * сусідні кнопки злипаються, як краплі. Живе ВИЩЕ роутів: гурт бере з адреси
 * (`useBandOrNull`), підпис списку — від сторінки (`ToPageBar`).
 *
 * Злипання — SVG-фільтр «goo» (`GooFilter`) на окремому шарі суцільних плям:
 * розмиття зливає краї сусідів, різкий поріг прозорості повертає формі чіткий
 * край. Кнопки з текстом лежать над плямами без фільтра — їх він розмив би.
 * Обидва шари — один і той самий ряд (`BarRow`), тож форма завжди під кнопкою.
 *
 * Рух: весь бар стоїть по центру, тож коли пункт шляху виростає чи
 * стискається, бар розсувається від центру в обидва боки, а пляма
 * відбруньковується від сусідньої. Пункт, що зникає, доживає анімацію зі
 * своїм старим підписом.
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
  const atHome = spot.active === "home";
  const content: BarContent = {
    spot,
    band: useLastValue(spot.bandId && band ? band : null),
    screen: useLastValue(screenLabel),
    initials: (user?.username ?? "").slice(0, 2).toUpperCase(),
    isLoading,
    slots: useQueue([!atHome, !!spot.bandId, !!spot.screen, atHome, atHome]),
  };

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
        <GooFilter />
        <div className="grid">
          <BarRow content={content} layer="frost" />
          <BarRow content={content} layer="goo" />
          <BarRow content={content} layer="buttons" />
        </div>
      </nav>
    </>
  );
}

/**
 * Краплі бару. Розмиття + поріг прозорості = злипання (`goo`). Далі з тієї
 * ж форми: напівпрозоре тіло краплі (крізь нього видно розмиту сторінку з
 * шару `frost`), глянцевий відблиск по краю — підсвічений «рельєф» з
 * розмитої форми — і тінь лише назовні, щоб не темнила скло зсередини.
 * Область фільтра з запасом: розмиття й тінь виходять за ряд.
 */
function GooFilter() {
  return (
    <svg aria-hidden className="absolute size-0">
      <filter
        id={GOO_FILTER}
        x="-10%"
        y="-60%"
        width="120%"
        height="220%"
        colorInterpolationFilters="sRGB"
      >
        <feGaussianBlur in="SourceGraphic" stdDeviation="8" />
        <feColorMatrix
          mode="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -6"
          result="goo"
        />

        <feComponentTransfer in="goo" result="body">
          <feFuncA type="linear" slope="0.55" />
        </feComponentTransfer>

        <feGaussianBlur in="goo" stdDeviation="3" result="bump" />
        <feSpecularLighting
          in="bump"
          surfaceScale="4"
          specularConstant="0.9"
          specularExponent="18"
          lightingColor="#ffffff"
          result="light"
        >
          <feDistantLight azimuth="235" elevation="50" />
        </feSpecularLighting>
        <feComposite in="light" in2="goo" operator="in" result="gloss" />

        <feGaussianBlur in="goo" stdDeviation="5" />
        <feOffset dy="3" result="drop" />
        <feFlood floodColor="#3b2f1a" floodOpacity="0.18" />
        <feComposite in2="drop" operator="in" />
        <feComposite in2="goo" operator="out" result="shadow" />

        <feMerge>
          <feMergeNode in="shadow" />
          <feMergeNode in="body" />
          <feMergeNode in="gloss" />
        </feMerge>
      </filter>
    </svg>
  );
}

/**
 * Ряд бару — один і той самий для всіх шарів (`Layer`), тож розмиття й
 * крапля завжди точно під кнопкою.
 *
 * На головній — лише пошук і профіль, без 🏠; деінде — лише шлях
 * (`APP-8`). Кожен пункт сидить у своєму місці (`Slot`), тож набір кнопок
 * змінюється тією самою анімацією, що й шлях.
 */
function BarRow({ content, layer }: { content: BarContent; layer: Layer }) {
  const { spot, band, screen, initials, isLoading, slots } = content;
  const [homeSlot, bandSlot, screenSlot, searchSlot, profileSlot] = slots;
  const buttons = layer === "buttons";
  const decor = !buttons;
  const item = { layer };

  return (
    <div
      aria-hidden={!buttons || undefined}
      className={cn(
        // `-ml-2` знімає відступ першого відкритого місця — хоч яке воно.
        "col-start-1 row-start-1 -ml-2 flex items-center",
        // Фільтр піднімає шар крапель над звичайними блоками, тож шар кнопок
        // позиціонований — тоді він знову згори.
        buttons ? "pointer-events-auto relative" : "pointer-events-none"
      )}
      style={layer === "goo" ? { filter: `url(#${GOO_FILTER})` } : undefined}
    >
      <Slot decor={decor} {...homeSlot}>
        <BarItem {...item} to={Routes.Root} active={false} label="Додому">
          {isLoading ? <Loader2 className="size-6 animate-spin" /> : <HomeIcon className="size-6" />}
        </BarItem>
      </Slot>

      <Slot decor={decor} {...bandSlot}>
        {band && (
          <BarItem {...item} to={bandPath.home(band.id)} active={spot.active === "band"}>
            {shorten(band.name)}
          </BarItem>
        )}
      </Slot>

      <Slot decor={decor} {...screenSlot}>
        {/* Екран у шляху завжди поточний — тапати по ньому нікуди. */}
        <BarItem {...item} active>
          {screen}
        </BarItem>
      </Slot>

      <Slot decor={decor} {...searchSlot}>
        <BarItem {...item} to={Routes.SearchSongs} active={false} label="Пошук">
          <MagnifyingGlassIcon className="size-6" />
        </BarItem>
      </Slot>

      <Slot decor={decor} {...profileSlot}>
        <BarItem {...item} to={Routes.Preferences} active={false} label="Профіль">
          <span className="text-sm font-bold">{initials}</span>
        </BarItem>
      </Slot>
    </div>
  );
}

/**
 * Місце пункту в ряду. Ширина анімується в пікселях — від нуля до
 * виміряної ширини пункту (`useWidth`): трюк `grid 0fr → 1fr` росте
 * нерівно, і пункт більшу частину часу лишається майже нульовим.
 *
 * Крапля й розмиття під нею (`decor`) не блякнуть, а лише стискаються —
 * тоді фільтр втягує краплю в сусідню, як рідину. Вони завжди на всю
 * поточну ширину місця (`BarItem`), тож вузька крапля кругла, а не зрізаний
 * край кнопки. Текст гасне швидше, ніж зникає місце, і зʼявляється, коли
 * місця вже вдосталь, — інакше підписи налазять один на одного. `delay` —
 * черга місця в переході (`useQueue`).
 */
function Slot({
  open,
  delay,
  decor,
  children,
}: {
  open: boolean;
  delay: number;
  decor: boolean;
  children: ReactNode;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const width = useWidth(innerRef);
  // До першого заміру — без переходу: бар не має «виїжджати» при відкритті.
  const motion = (prop: string) =>
    width == null ? `${prop} 0s` : `${prop} ${ITEM_MS}ms ease-in-out ${delay}ms`;
  const fade = open
    ? `opacity ${ITEM_MS / 2}ms ease-out ${delay + ITEM_MS / 2}ms`
    : `opacity ${ITEM_MS / 3}ms ease-out ${delay}ms`;

  return (
    <div
      aria-hidden={!open}
      className={cn("relative overflow-hidden", !open && "pointer-events-none")}
      style={{
        width: open ? (width ?? "auto") : 0,
        opacity: open || decor ? 1 : 0,
        transition: `${motion("width")}, ${fade}`,
        // Крапля й розмиття (`BarItem`) стискаються ще й по висоті — до
        // точки посередині — в тому самому темпі, що й ширина місця.
        ["--pill-inset" as string]: open ? "0px" : "50%",
        ["--pill-motion" as string]: `${motion("top")}, ${motion("bottom")}`,
      }}
    >
      {/* Відступ живе в самому місці: закрите не лишає по собі проміжку. */}
      <div ref={innerRef} className="w-max pl-2">
        {children}
      </div>
    </div>
  );
}

/**
 * Пункт бару: пункт шляху чи кругла кнопка. Без підпису (`label`) — текстовий,
 * з ним — круглий з іконкою. У шарах `frost` і `goo` — лише розмиття чи
 * крапля того самого розміру. Поточний пункт — крапля іншого кольору й не
 * посилання: тап по ньому нічого не робить (`APP-31`).
 */
function BarItem({
  layer,
  to,
  active,
  label,
  children,
}: {
  layer: Layer;
  to?: string;
  active: boolean;
  label?: string;
  children: ReactNode;
}) {
  const className = cn(
    "flex h-13 shrink-0 items-center justify-center whitespace-nowrap rounded-full",
    label ? "w-13" : "px-5 text-base font-semibold"
  );

  if (layer !== "buttons") {
    // Невидимий пункт тримає місцю ширину; розмиття й крапля — на всю
    // поточну ширину місця (`left-2` — його відступ), а не лише на видиму
    // частину кнопки.
    return (
      <>
        <span className={cn(className, "invisible")}>{children}</span>
        <span
          className={cn(
            "absolute left-2 right-0 rounded-full",
            layer === "frost"
              ? "backdrop-blur-md"
              : // Крапля напівпрозора, тож поточна темніша за `--accent`:
                // інакше крізь скло підсвітки не видно.
                active ? "bg-[#dccb9a]" : "bg-background"
          )}
          style={{
            top: "var(--pill-inset)",
            bottom: "var(--pill-inset)",
            transition:
              layer === "goo"
                ? `var(--pill-motion), background-color ${ITEM_MS}ms`
                : "var(--pill-motion)",
          }}
        />
      </>
    );
  }
  if (active || !to) {
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

/**
 * Черга переходу: місця, що закриваються, ідуть справа наліво, а за ними
 * ті, що відкриваються, — зліва направо. Строго по одному: наступне рушає,
 * коли попереднє вже доїхало. Зі списку пісень додому: «Пісні», гурт, 🏠,
 * пошук, профіль. Черга тримається, доки набір відкритих місць не
 * зміниться знову.
 */
function useQueue(opens: boolean[]): { open: boolean; delay: number }[] {
  const key = opens.map(Number).join("");
  const last = useRef({ key, delays: opens.map(() => 0) });
  if (last.current.key !== key) {
    const was = last.current.key;
    const closing = opens.map((_, i) => i).filter((i) => was[i] === "1" && !opens[i]).reverse();
    const opening = opens.map((_, i) => i).filter((i) => was[i] === "0" && opens[i]);
    const delays = opens.map(() => 0);
    closing.forEach((slot, turn) => (delays[slot] = turn * ITEM_MS));
    const openFrom = closing.length * ITEM_MS;
    opening.forEach((slot, turn) => (delays[slot] = openFrom + turn * ITEM_MS));
    last.current = { key, delays };
  }
  return opens.map((open, i) => ({ open, delay: last.current.delays[i] }));
}

/** Природна ширина елемента; стежить за зміною підпису. */
function useWidth(ref: RefObject<HTMLElement>): number | null {
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.offsetWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}

/** Останнє непорожнє значення: пункт, що стискається, не лишається без підпису. */
function useLastValue<T>(value: T | null): T | null {
  const last = useRef(value);
  if (value != null) last.current = value;
  return last.current;
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
