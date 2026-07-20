import {
  usePeers,
  useLeaderClientId,
  useMyClientId,
} from "../../redux/selectors";

interface Peer {
  clientId: number;
  username: string | null;
}

export function PresenceList() {
  const peers = usePeers() as Peer[];
  const leaderClientId = useLeaderClientId();
  const myClientId = useMyClientId();

  if (!peers || peers.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground border border-dashed border-gray-300 rounded p-2 bg-gray-50">
      <span className="font-medium">Підключені:</span>
      {peers.map((p) => {
        const isMe = p.clientId === myClientId;
        const isLeader = p.clientId === leaderClientId;
        return (
          <span
            key={p.clientId}
            className={`px-2 py-0.5 rounded ${
              isMe ? "bg-blue-100 text-blue-900 font-medium" : "bg-white"
            }`}
          >
            {isLeader && <span title="leader">👑 </span>}
            {p.username ?? "—"}
            {isMe && <span className="opacity-60"> (я)</span>}
          </span>
        );
      })}
    </div>
  );
}
