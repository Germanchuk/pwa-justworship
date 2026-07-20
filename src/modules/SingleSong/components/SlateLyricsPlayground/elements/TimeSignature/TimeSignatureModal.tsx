import { MetaModal } from "../MetaModal/MetaModal";

const COMMON_SIGNATURES = ["4/4", "3/4", "6/8", "2/4", "12/8", "5/4"];

interface Props {
  current: string;
  onPick: (value: string) => void;
  onClose: () => void;
}

export function TimeSignatureModal({ current, onPick, onClose }: Props) {
  return (
    <MetaModal title="Розмір такту" onClose={onClose}>
      <div className="grid grid-cols-3 gap-2">
        {COMMON_SIGNATURES.map((ts) => (
          <button
            key={ts}
            type="button"
            className={`px-2 py-1.5 rounded border text-sm font-semibold tabular-nums ${
              ts === current
                ? "bg-blue-600 border-blue-600 text-white"
                : "bg-white border-gray-300 hover:bg-gray-50"
            }`}
            onClick={() => {
              onPick(ts);
              onClose();
            }}
          >
            {ts}
          </button>
        ))}
      </div>
    </MetaModal>
  );
}
