import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { Link } from "react-router-dom";
import { SpeakerWaveIcon } from "@heroicons/react/24/outline";

import { fetchAPI } from "#utils/fetch-api";
import { setUser } from "#modules/AuthenticatedUser/userSlice";
import { useBand } from "#modules/Band/BandLayout";
import {
  bandApi,
  BAND_ROLE_LABEL,
  type BandMember,
} from "#modules/Band/api/band";
import DeleteBand from "./DeleteBand";
import { useCurrentUsername } from "#modules/SingleSong/components/SlateLyricsPlayground/elements/hooks";
import { bandPath } from "#constants/routes";
import { Button } from "@/components/ui/button";

/**
 * Склад гурту з ролями. Роль поки ні на що не впливає — жодна дія за нею не
 * закрита, — тож призначити хоста звуку так само може будь-який учасник.
 */
export default function BandMembers() {
  const band = useBand();
  const dispatch = useDispatch();
  const username = useCurrentUsername();

  const [members, setMembers] = useState<BandMember[]>([]);
  const [loading, setLoading] = useState(true);
  // Оптимістичний локальний стан; band.audioHostUserId у redux оновиться
  // фоновим рефетчем /users/me.
  const [audioHostId, setAudioHostId] = useState<number | null>(
    (band as { audioHostUserId?: number | null }).audioHostUserId ?? null,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    bandApi
      .getMembers(band.id)
      .then(({ data }) => {
        if (!cancelled) setMembers(Array.isArray(data) ? data : []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [band.id]);

  const assignHost = async (userId: number | null) => {
    const previous = audioHostId;
    setAudioHostId(userId);
    setSaving(true);
    try {
      await bandApi.setAudioHost(band.id, userId);
      // Тримаємо redux-гурт свіжим, щоб інші екрани бачили нове призначення.
      fetchAPI("/users/me", { populate: ["bands"] }).then((data) => {
        dispatch(setUser(data));
      });
    } catch {
      setAudioHostId(previous);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <p className="mt-4 mb-3 text-sm text-stone-500">
        Хост звуку — акаунт пристрою, підключеного до звукового обладнання:
        коли будь-хто з гурту тисне «грати», фон звучить саме з нього.
      </p>

      {loading ? (
        <div className="text-sm text-stone-400">Завантаження…</div>
      ) : (
        <ul className="flex flex-col gap-2 m-0 p-0 list-none">
          {members.map((member) => {
            const isHost = audioHostId != null && Number(member.id) === Number(audioHostId);
            const isMe = member.username === username;
            return (
              <li
                key={member.id}
                className={`flex flex-wrap items-center gap-3 rounded-md border px-3 py-2.5 ${
                  isHost ? "border-blue-900 bg-blue-50/60" : "border-stone-200"
                }`}
              >
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="text-sm font-semibold text-stone-800 truncate">
                    {member.username}
                    {isMe && (
                      <span className="text-stone-400 font-normal"> (я)</span>
                    )}
                  </span>
                  <span className="text-xs text-stone-500">
                    {BAND_ROLE_LABEL[member.role] ?? BAND_ROLE_LABEL.member}
                  </span>
                </span>
                {isHost && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-blue-900 shrink-0">
                    <SpeakerWaveIcon className="size-4" />
                    хост звуку
                  </span>
                )}
                <Button
                  variant={isHost ? "ghost" : "outline"}
                  size="sm"
                  disabled={saving}
                  onClick={() => assignHost(isHost ? null : Number(member.id))}
                >
                  {isHost ? "зняти" : "зробити хостом"}
                </Button>
                {/* Режим хоста вмикають на пристрої призначеного акаунта. */}
                {isHost && isMe && (
                  <Link
                    to={bandPath.audioHost(band.id)}
                    className="w-full text-center text-sm font-semibold text-blue-900 hover:underline"
                  >
                    Відкрити режим хоста на цьому пристрої →
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Видалення гурту бачить лише лідер. Сервер перевіряє це незалежно. */}
      {members.some(
        (member) => member.username === username && member.role === "leader",
      ) && <DeleteBand bandId={band.id} bandName={band.name} />}
    </>
  );
}
