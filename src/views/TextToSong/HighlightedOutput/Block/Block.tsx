import classNames from "classnames";
import {MagicInput} from "#components";
import { useEditMode } from "#modules/SingleSong/redux/selectors";

export default function Block({ data }) {
  const editMode = useEditMode();

  return (
    <div
      className={classNames(
        // "ring-1 ring-neutral shadow bg-muted rounded divide-y divide-neutral",
        {
          "Block--editabled": editMode,
        }
      )}
    >
      {data.title && <BlockTitle>{data.title}</BlockTitle>}
      <BlockContent data={data.content} />
    </div>
  );
}

function BlockTitle({ children }) {
  const editMode = useEditMode();
  if (editMode) {
    return (
      <MagicInput
        // className="px-4 py-2 focus:outline-neutral rounded-t"
      >
        {children}
      </MagicInput>
    );
  } else {
    return <div className="rounded bg-primary-content inline-block">{children}</div>;
  }
}

function BlockContent({ data }) {
  const editMode = useEditMode();
  if (editMode) {
    return (
      <MagicInput
        // className="px-4 py-2 focus:outline-neutral rounded-b"
      >
        {data
          .map((item) => item.content)
          .filter((item) => item.length)
          .join("\n")}
      </MagicInput>
    );
  } else {
    return <div>{data.map(renderLine)}</div>;
  }
}

function renderLine(data, index) {
  console.log("renderLine: ", data);
  if(!data.content) {
    return <br />
  }
  switch (data.type) {
    case "chord":
      return <div key={index} className="text-primary" style={{whiteSpace: 'pre'}}>{data.content}</div>;

    case "text":
      return <div style={{whiteSpace: 'pre'}} key={index}>{data.content}</div>;
  }
}
