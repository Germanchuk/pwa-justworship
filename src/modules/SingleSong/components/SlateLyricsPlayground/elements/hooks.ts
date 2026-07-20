import { useSelector } from "react-redux";
import { ReactEditor, useSlate } from "slate-react";
import { Element, Node } from "slate";

export const useCurrentUsername = (): string | undefined =>
  useSelector((state: any) => state.user?.username);

export const useFirstInSectionInfo = (element: Element) => {
  // useSlate (not useSlateStatic) so the hook re-runs on every editor change.
  // Otherwise sibling inserts/removes don't shift this element's cached path.
  const editor = useSlate();
  try {
    const path = ReactEditor.findPath(editor, element);
    if (path.length !== 2) return { isFirst: false };
    const sectionNode = Node.get(editor, path.slice(0, 1));
    if (!Element.isElement(sectionNode) || sectionNode.type !== "section") {
      return { isFirst: false };
    }
    // First "real" line in the section, ignoring comment-anchor pseudo-rows.
    let firstLineIdx = -1;
    for (let i = 0; i < sectionNode.children.length; i++) {
      const child = sectionNode.children[i];
      if (Element.isElement(child) && child.type !== "comment-anchor") {
        firstLineIdx = i;
        break;
      }
    }
    return { isFirst: path[path.length - 1] === firstLineIdx };
  } catch {
    return { isFirst: false };
  }
};
