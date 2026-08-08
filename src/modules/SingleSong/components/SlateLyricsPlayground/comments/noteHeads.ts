/**
 * ДЕ МАЛЮЄТЬСЯ КАРТКА ПРИМІТКИ.
 *
 * Позиція картки ніде не зберігається — вона щоразу виводиться з міток на
 * тексті. Правило одне:
 *
 *   картка примітки малюється над ПЕРШИМ (у порядку документа) ВИДИМИМ
 *   рядком, який несе хоч один непорожній символ з її міткою.
 *
 * З нього автоматично випливають обидві вимоги специфікації:
 *   `NOTE-10` — картка фізично над своїм текстом, розсовує рядки;
 *   `NOTE-13` — картка жива, доки видно хоч один символ якоря: сховані
 *               фільтрами рядки просто не можуть бути «головою», тож картка
 *               переїжджає на наступний видимий, а коли видимих не лишилось —
 *               не малюється взагалі.
 *
 * Саме тому редагування не може розʼїхатись із виділенням: новий рядок,
 * розрив секції чи чужа правка міняють ДЕ лежить мітка, а картка йде за нею.
 */

import { Element, Text, type Descendant } from "slate";

import type { DisplayState } from "../display/model";
import { isRowHiddenAt } from "../display/operations";
import type { CustomText } from "../types";

/** Ключ рядка в мапі голів — шлях `[rootIndex, rowIndex]` у вигляді рядка. */
export const rowKey = (rootIndex: number, rowIndex: number): string =>
  `${rootIndex},${rowIndex}`;

/**
 * `nodes` — корінь документа (`editor.children`).
 * Повертає `rowKey → commentId[]` у порядку першої появи мітки в рядку.
 */
export const collectNoteHeads = (
  nodes: Descendant[],
  state: DisplayState,
): Map<string, string[]> => {
  const heads = new Map<string, string[]>();
  const placed = new Set<string>();

  for (let rootIndex = 0; rootIndex < nodes.length; rootIndex++) {
    const section = nodes[rootIndex];
    if (!Element.isElement(section) || section.type !== "section") continue;

    const rows = section.children;
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (!Element.isElement(row)) continue;
      // Схований рядок головою бути не може — мітка чекає наступного видимого.
      if (isRowHiddenAt(rows, rowIndex, state)) continue;

      for (const leaf of row.children) {
        if (!Text.isText(leaf)) continue;
        const text = leaf as CustomText;
        // Порожній лист не «видимий символ»: під ним нічого не підсвічено.
        if (text.text.length === 0) continue;
        if (!Array.isArray(text.comment)) continue;

        for (const mark of text.comment) {
          if (placed.has(mark.commentId)) continue;
          placed.add(mark.commentId);
          const key = rowKey(rootIndex, rowIndex);
          const list = heads.get(key);
          if (list) list.push(mark.commentId);
          else heads.set(key, [mark.commentId]);
        }
      }
    }
  }

  return heads;
};
