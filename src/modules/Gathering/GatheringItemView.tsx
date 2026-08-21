import { memo, useMemo } from "react";

import { PlayerHighlightContext } from "#modules/SingleSong/components/SlateLyricsPlayground/player/PlayerHighlightContext";
import { StaticSong } from "#modules/SingleSong/components/StaticSong/StaticSong";
import { prefixTokenKey } from "#modules/SingleSong/services/ChordsProgressionPlayer/segments/model";
import type { GatheringItem } from "./buildGathering";

/**
 * Один пункт служіння на екрані — і його частка спільної голки.
 *
 * ─── ГОЛКА ПРИХОДИТЬ УЖЕ СВОЯ ──────────────────────────────────────────────
 * Ключ ріже екран (`unprefixTokenKey`), тож сюди приходить `null` у всіх
 * пунктах, крім того, що звучить. Саме тому `memo` тут працює, а не просто
 * стоїть: голка рухається кілька разів на такт, а на екрані до десятка живих
 * Slate-документів, і декорація проходить кожен акордовий рядок кожної пісні.
 * Прийшов би цілий ключ — перемальовувалось би все служіння на кожен акорд.
 *
 * ─── А ТАП ІДЕ НАЗАД УЖЕ ЦІЛИМ ─────────────────────────────────────────────
 * Тап по акорду означає «грай звідси й до кінця СЛУЖІННЯ» (`LIST-43`), а не
 * «грай цю пісню». Тому пункт тут же вертає ключеві свою ознаку
 * (`prefixTokenKey`) — тією самою адресою, якою вона їде по мережі: `0:1:3`
 * є в кожній пісні служіння, і без ознаки старт потрапив би в однойменний
 * акорд геть іншої.
 */
interface Props {
  item: GatheringItem;
  /** Токен, що звучить, уже без префікса пункту. `null` — звучить не тут. */
  tokenKey: string | null;
  /** Запустити служіння з цієї адреси. Стабільна — інакше `memo` дарма. */
  onPlayFrom: (from: string) => void;
}

export const GatheringItemView = memo(function GatheringItemView({
  item,
  tokenKey,
  onPlayFrom,
}: Props) {
  const highlight = useMemo(
    () => ({
      currentTokenKey: tokenKey,
      // Позначеного акорда в зібранні не буває: тап не вибирає місце старту, а
      // одразу з нього грає — чекати тут нічого (рішення Германа 2026-08-20:
      // «тап запускає одразу; якщо зловимо мисклік — тоді й розберемось»).
      selectedTokenKey: null,
      onChordTap: (key: string) => onPlayFrom(prefixTokenKey(key, item.tokenKeyPrefix)!),
    }),
    [tokenKey, onPlayFrom, item.tokenKeyPrefix],
  );

  return (
    <PlayerHighlightContext.Provider value={highlight}>
      <section className="border-t border-dashed border-border/70 py-4 first:border-t-0 first:pt-0">
        {item.kind === "song" && (
          <>
            {/* Номер над піснею: єдина навігаційна підказка на екрані, де
                гортають пальцем. На репетиції домовляються саме номерами. */}
            <div className="mb-1 text-sm font-semibold text-muted-foreground">
              {item.number}
            </div>
            <StaticSong docId={item.point.songId} slate={item.nodes} />
          </>
        )}

        {/* Програш — такий самий документ, як пісня: акорди, згенеровані зі
            стику сусідів, під текстом примітки. Свого вмісту він не має й мати
            не може (`LIST-26`). */}
        {item.kind === "sounding" && <StaticSong docId={item.key} slate={item.nodes} />}

        {/* Примітка без програша — просто рядок: тут говорить ведучий. */}
        {item.kind === "note" && (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-base text-foreground/80">
            {item.text}
          </p>
        )}
      </section>
    </PlayerHighlightContext.Provider>
  );
});
