import {useSyncExternalStore} from "react";
import {CheckIcon} from "@heroicons/react/24/outline";
import {Music, Piano} from "lucide-react";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {Switch} from "@/components/ui/switch";
import {Slider} from "@/components/ui/slider";
import {PAD_PRESETS} from "../../../services/ChordsProgressionPlayer/createPad/padPresets";
import {
  getPlayerSettings,
  HUMANIZE_LEVELS,
  PIANO_VOLUME_RANGE,
  subscribePlayerSettings,
  updatePlayerSettings,
} from "../../../services/ChordsProgressionPlayer/playerSettings";

interface Props {
  open: boolean;
  onClose: () => void;
}

const usePlayerSettings = () =>
  useSyncExternalStore(subscribePlayerSettings, getPlayerSettings);

/**
 * Меню плеєра. Налаштування особисті (пристрою), тож застосовуються одразу,
 * без «Зберегти» — на відміну від BpmModal, який редагує спільний документ.
 */
export function PlayerSettingsDrawer({open, onClose}: Props) {
  const settings = usePlayerSettings();

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="px-4 pb-6 select-none bg-white">
        <DrawerHeader className="pb-1 text-center shrink-0">
          <DrawerTitle className="text-sm font-semibold text-stone-500 uppercase tracking-wider">
            Плеєр
          </DrawerTitle>
        </DrawerHeader>

        <div className="flex flex-col gap-5 py-2 mt-2">
          {/* Пресет фону */}
          <section>
            <h3 className="flex items-center gap-1.5 text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2">
              <Music className="size-3.5" />
              Фон
            </h3>
            <ul className="flex flex-col gap-2 m-0 p-0 list-none">
              {PAD_PRESETS.map((preset) => {
                const active = settings.padPreset === preset.key;
                return (
                  <li key={preset.key}>
                    <button
                      type="button"
                      onClick={() => updatePlayerSettings({padPreset: preset.key})}
                      className={`w-full flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-all cursor-pointer active:scale-[0.98] bg-transparent ${
                        active
                          ? "border-blue-900 bg-blue-50/60"
                          : "border-stone-200 hover:bg-stone-50"
                      }`}
                    >
                      <span className="flex-1 min-w-0">
                        <span
                          className={`block text-sm font-semibold ${
                            active ? "text-blue-900" : "text-stone-800"
                          }`}
                        >
                          {preset.label}
                        </span>
                        <span className="block text-xs text-stone-500 mt-0.5">
                          {preset.description}
                        </span>
                      </span>
                      {active && <CheckIcon className="size-5 shrink-0 text-blue-900" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Піаніно поверх педа */}
          <section>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-stone-800">Піаніно</div>
                <div className="text-xs text-stone-500 mt-0.5">
                  Акордовий стаб поверх фону
                </div>
              </div>
              <Switch
                checked={settings.piano}
                onCheckedChange={(piano) => updatePlayerSettings({piano})}
                aria-label="Піаніно поверх фону"
                iconOn={<Piano />}
                iconOff={<Piano />}
              />
            </div>
            <div
              className={`flex items-center gap-3 mt-3 transition-opacity ${
                settings.piano ? "" : "opacity-40 pointer-events-none"
              }`}
            >
              <Slider
                min={PIANO_VOLUME_RANGE[0]}
                max={PIANO_VOLUME_RANGE[1]}
                step={1}
                value={[settings.pianoVolume]}
                onValueChange={([pianoVolume]) => updatePlayerSettings({pianoVolume})}
                disabled={!settings.piano}
                aria-label="Гучність піаніно"
                className="flex-1"
              />
              <span className="w-14 shrink-0 text-right text-xs font-semibold text-stone-600 tabular-nums">
                {settings.pianoVolume > 0 ? `+${settings.pianoVolume}` : settings.pianoVolume} дБ
              </span>
            </div>
          </section>

          {/* Гуманізація */}
          <section>
            <h3 className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2">
              Гуманізація
            </h3>
            <div className="grid grid-cols-4 gap-1 rounded-md bg-stone-100 p-1">
              {HUMANIZE_LEVELS.map((level) => {
                const active = settings.humanize === level.key;
                return (
                  <button
                    key={level.key}
                    type="button"
                    onClick={() => updatePlayerSettings({humanize: level.key})}
                    className={`rounded px-1 py-1.5 text-[11px] font-semibold transition-all cursor-pointer border-none active:scale-95 ${
                      active
                        ? "bg-white text-blue-900 shadow-sm"
                        : "bg-transparent text-stone-500 hover:text-stone-700"
                    }`}
                  >
                    {level.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-stone-500 mt-1.5 m-0">
              Наскільки «по-людськи» плавають гучність і час нот.
            </p>
          </section>

          <p className="text-[11px] text-stone-400 text-center m-0">
            Зміни звучання діють з наступного запуску програвання.
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
