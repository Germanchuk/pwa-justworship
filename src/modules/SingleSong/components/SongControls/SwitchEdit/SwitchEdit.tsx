import {useEditMode, useSetEditMode} from "../../../redux/selectors";
import React from "react";
import {LockClosedIcon, LockOpenIcon} from "@heroicons/react/24/outline";
import {useDispatch} from "react-redux";
import {showChordsAgainstPreferences} from "#modules/SingleSong/redux/songSlice";
import { Button } from "@/components/ui/button";

export function SwitchEdit() {
  const dispatch = useDispatch();
  const setEditMode = useSetEditMode();
  const editMode = useEditMode();

  const enableEditing = () => {
    setEditMode(true);
    dispatch(showChordsAgainstPreferences(true));
  }

  const disableEditing = () => {
    setEditMode(false);
    dispatch(showChordsAgainstPreferences(false));
  }

  return (
    <div className="animate__bounceIn">
      {!editMode ?
      (
        <Button
          variant="outline"
          size="icon"
          className="rounded-full border-dashed"
          onClick={enableEditing}
        >
          <LockClosedIcon className="w-6 h-6" />
        </Button>
      ) : (
        <Button
          variant="outline"
          size="icon"
          className="rounded-full border-dashed"
          onClick={disableEditing}
        >
          <LockOpenIcon className="w-6 h-6" />
        </Button>
      )}
    </div>
  );
}