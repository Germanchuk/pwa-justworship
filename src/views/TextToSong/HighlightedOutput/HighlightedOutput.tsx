import React, { useEffect } from "react";
import Block from "./Block/Block";
import EditIcon from "../../../icons/EditIcon";
import ArrowLeftIcon from "../../../icons/ArrowLeftIcon";
import {MagicInput} from "#components";
import { useEditMode, useSetEditMode } from "#modules/SingleSong/redux/selectors";
import { ContentBlock } from "#utils/compiler/compiler";
import ReactDOM from "react-dom";
import { Button } from "@/components/ui/button";

export default function SingleSong({
  songObject,
  hideSongName = false,
}: {
  songObject;
  hideSongName?: boolean;
}) {
  // const { songId } = useParams();
  const editMode = useEditMode();
  const setEditMode = useSetEditMode();

  useEffect(() => {
    setEditMode(false);
  }, [setEditMode]);
  // const [song, setSong] = React.useState<SongObject>(songObject);
  // useEffect(() => {
  //   fetchAPI(`/songs/${songId}`).then((data) => {
  //     setSong(data.data.attributes);
  //   });
  // }, [songId]);

  if (Object.keys(songObject).length === 0) {
    return null;
  }

  return (
    <div className="p-4">
      {!hideSongName && (
        <div className="mb-4">
          <SongTitle>{songObject?.name}</SongTitle>
        </div>
      )}
      <div className="grid grid-cols-1 gap-7 text-lg">
        {songObject.blocks.map((block: ContentBlock, index) => {
          return <Block data={block} key={index} />;
        })}
      </div>
      <ToggleModeButton setEditMode={setEditMode} editMode={editMode} />
    </div>
  );
}

function SongTitle({ children }) {
  const editMode = useEditMode();
  if (editMode) {
    return (
      <MagicInput className="text-3xl font-bold tracking-tight focus:outline-neutral">
        {children}
      </MagicInput>
    );
  } else {
    return <h1 className="text-3xl font-bold tracking-tight">{children}</h1>;
  }
}

function ToggleModeButton({ setEditMode, editMode }) {
  return ReactDOM.createPortal(
    <div className="fixed bottom-4 right-4">
      <Button
        size="icon"
        variant="secondary"
        className="ring-1 ring-neutral-400"
        onClick={() => setEditMode(!editMode)}
      >
        {editMode ? <ArrowLeftIcon /> : <EditIcon />}
      </Button>
    </div>, document.body
  );
}
