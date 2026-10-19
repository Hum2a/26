import { Link } from "react-router";
import { EntryNotice } from "../ui/entry-frame";
import { Button } from "../ui/primitives";
import { useAdminRoom, type CommandScope } from "./room-provider";

export function CommandFeedback({ scope }: { scope: CommandScope }) {
  const { command, retry, connection, snapshot } = useAdminRoom();
  if (
    command.status === "idle" ||
    (command.scope !== scope && command.status === "success")
  )
    return null;
  return (
    <div className="admin-command-feedback" aria-busy={command.status === "pending"}>
      {command.scope !== scope ? (
        <Link
          className="entry-text-link"
          to={`/admin/rooms/${snapshot.gameId}/${command.scope === "room" ? "live" : command.scope}`}
        >
          Action from {command.scope === "room" ? "Live controls" : command.scope}
        </Link>
      ) : null}
      <EntryNotice message={command.message} />
      {command.status === "error" && command.retryable ? (
        <Button
          variant="secondary"
          disabled={connection !== "open"}
          onClick={() => void retry()}
        >
          Retry the same action
        </Button>
      ) : null}
    </div>
  );
}
