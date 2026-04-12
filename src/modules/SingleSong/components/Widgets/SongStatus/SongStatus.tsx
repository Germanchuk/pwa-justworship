import {Status} from "#components";
import {useStatus} from "../../../redux/selectors";
import ReactDOM from "react-dom";

export const SongStatus = () => {
  const status = useStatus();

  return ReactDOM.createPortal(
    <div className={"sticky top-30 right-0 z-40"}>
      <div className={"glass rounded-l-2xl pr-2"}>
        <Status status={status} />
      </div>
    </div>,
    document.body
  );
}
