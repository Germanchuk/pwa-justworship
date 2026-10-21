/**
 * Шапка пісні: назва, темп, розмір, тональність — спільне (правиться лише в
 * режимі правки); капо й видимі доріжки — особисте кожного.
 */
import { useState, type ReactNode } from "react";
import { MusicalNoteIcon, ChatBubbleBottomCenterTextIcon, Squares2X2Icon, AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import { Switch } from "@/components/ui/switch";
import { BpmModal } from "#modules/SingleSong/components/SlateLyricsPlayground/elements/Bpm/BpmModal";
import { CapoModal } from "#modules/SingleSong/components/SlateLyricsPlayground/elements/Capo/CapoModal";
import { KeyPickerModal } from "#modules/SingleSong/components/SlateLyricsPlayground/elements/SongKey/KeyPickerModal";
import { TimeSignatureModal } from "#modules/SingleSong/components/SlateLyricsPlayground/elements/TimeSignature/TimeSignatureModal";
import { keyDisplayName, keyForCapo } from "#modules/SingleSong/components/SlateLyricsPlayground/transposition/transposeChords";
import type { SongKeyValue } from "#modules/SingleSong/components/SlateLyricsPlayground/transposition/model";
import "#modules/SingleSong/components/SlateLyricsPlayground/elements/SongMetaRow/SongMetaRow.css";
import "#modules/SingleSong/components/SlateLyricsPlayground/display/DisplayToggles.css";
import { readCapo, readHiddenLanes, readMeta, Song, songLanes, writeCapo, writeHiddenLanes, writeMeta } from "../../model";
import { LanesPanel } from "./LanesPanel";
import { transposeSong } from "./transposeSong";

type Props = {
  song: Song;
  me: string | null;
  canEdit: boolean;
  capoApplies: boolean;
  /** Зміна доріжок пісні — один крок undo (`LaneView.change`). */
  change: (fn: () => void) => void;
};

const LANE_ICONS = { words: ChatBubbleBottomCenterTextIcon, chords: MusicalNoteIcon } as const;

function Badge(props: { label: string; value: ReactNode; readonly: boolean; muted?: boolean; title?: string; onOpen: () => void }) {
  return (
    <span
      className={`song-meta-badge ${props.readonly ? "song-meta-badge--readonly" : ""}`}
      title={props.title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => !props.readonly && props.onOpen()}
    >
      <span className="song-meta-badge__label">{props.label}</span>
      <span className={`song-meta-badge__value ${props.muted ? "song-meta-badge__value--muted" : ""}`}>{props.value}</span>
    </span>
  );
}

/** BPM рахує імпульси (одиниці знаменника): у 6/8 це вісімки — діапазон більший. */
const tempoScale = (timeSignature: string) =>
  Number(timeSignature.split("/")[1]) >= 8
    ? { max: 240, unitLabel: "вісімок/хв (BPM)" }
    : { max: 160, unitLabel: "уд/хв (BPM)" };

export function SongHeader({ song, me, canEdit, capoApplies, change }: Props) {
  const { doc } = song;
  const meta = readMeta(doc);
  const capo = me ? readCapo(doc, me) : { fret: 0, off: false };
  const hidden = me ? readHiddenLanes(doc, me) : [];
  const [open, setOpen] = useState<"bpm" | "ts" | "key" | "capo" | "lanes" | null>(null);
  const close = () => setOpen(null);
  const capoOn = capo.fret > 0 && !capo.off && capoApplies;
  const editTitle = canEdit ? undefined : "Змінюється в режимі редагування";

  const toggleLane = (lane: string) => {
    if (!me) return;
    const next = hidden.includes(lane) ? hidden.filter((l) => l !== lane) : [...hidden, lane];
    writeHiddenLanes(doc, me, next);
  };

  return (
    <div className="mb-2">
      {canEdit ? (
        <input
          className="song-name w-full text-2xl font-bold text-[#1e3a8a] outline-none mb-1 pl-4 bg-transparent"
          value={meta.name}
          placeholder="Назва пісні"
          onChange={(e) => writeMeta(doc, { name: e.target.value })}
        />
      ) : (
        <h1 className="song-name text-2xl font-bold text-[#1e3a8a] mb-1 min-h-[1.5em] pl-4">{meta.name}</h1>
      )}
      <div className="song-meta-row">
        <div className="song-meta-line">
          <Badge label="Темп:" value={meta.bpm || 0} readonly={!canEdit} title={editTitle} onOpen={() => setOpen("bpm")} />
        </div>
        <div className="song-meta-line">
          <Badge label="Розмір:" value={meta.timeSignature} readonly={!canEdit} title={editTitle} onOpen={() => setOpen("ts")} />
        </div>
        <div className="song-meta-line">
          <Badge
            label="Тональність:"
            value={meta.key.replace("sharp", "#")}
            readonly={!canEdit}
            title={editTitle}
            onOpen={() => setOpen("key")}
          />
          {capoOn && (
            <span className="song-meta-note">З капою: {keyDisplayName(keyForCapo(meta.key as SongKeyValue, capo.fret))}</span>
          )}
        </div>
        {me && (
          <div className="song-meta-line">
            <Badge
              label="Капо:"
              value={capo.fret}
              readonly={!capoApplies}
              muted={capo.fret > 0 && !capoOn}
              title={capoApplies ? undefined : "Капо діє лише в режимі читання"}
              onOpen={() => setOpen("capo")}
            />
            <span className="ml-1.5 inline-flex" onMouseDown={(e) => e.preventDefault()}>
              <Switch
                checked={capoOn}
                disabled={capo.fret === 0 || !capoApplies}
                onCheckedChange={() => writeCapo(doc, me, { off: !capo.off })}
                aria-label="Капо"
              />
            </span>
          </div>
        )}
        {me && (
          <span className="display-toggles">
            {songLanes(doc).map(({ id: lane, kind, name: label }) => {
              const Icon = kind === "words" || kind === "chords" ? LANE_ICONS[kind] : kind === "text" ? LANE_ICONS.words : Squares2X2Icon;
              return (
              <span key={lane} className="song-meta-line">
                <span
                  className="song-meta-badge display-toggle"
                  title={`${hidden.includes(lane) ? "Показати" : "Приховати"} ${label.toLowerCase()}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggleLane(lane)}
                >
                  <Icon />
                  <span className="song-meta-badge__label">{label}</span>
                </span>
                <span className="ml-1.5 inline-flex" onMouseDown={(e) => e.preventDefault()}>
                  <Switch checked={!hidden.includes(lane)} onCheckedChange={() => toggleLane(lane)} aria-label={label} />
                </span>
              </span>
              );
            })}
            {canEdit && (
              <span className="song-meta-line">
                <span
                  className="song-meta-badge display-toggle"
                  title="Доріжки пісні: порядок, додати, прибрати"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setOpen("lanes")}
                >
                  <AdjustmentsHorizontalIcon />
                  <span className="song-meta-badge__label">Доріжки</span>
                </span>
              </span>
            )}
          </span>
        )}
      </div>

      <BpmModal
        open={open === "bpm"}
        current={meta.bpm}
        {...tempoScale(meta.timeSignature)}
        onSave={(bpm) => writeMeta(doc, { bpm })}
        onClose={close}
      />
      {open === "ts" && <TimeSignatureModal current={meta.timeSignature} onPick={(timeSignature) => writeMeta(doc, { timeSignature })} onClose={close} />}
      {open === "key" && (
        <KeyPickerModal
          current={meta.key}
          onPick={(key, mode) => (mode === "relabel" ? writeMeta(doc, { key }) : transposeSong(song, meta.key, key))}
          onClose={close}
        />
      )}
      {open === "lanes" && <LanesPanel song={song} change={change} onClose={close} />}
      {open === "capo" && me && <CapoModal current={capo.fret} onSave={(fret) => writeCapo(doc, me, { fret, off: false })} onClose={close} />}
    </div>
  );
}
