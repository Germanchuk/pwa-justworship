/**
 * Tiny one-slot registry to hand off "please focus this comment's textarea"
 * intent from the action that creates the note to the NoteCard that mounts
 * shortly after. Module-scoped so it works across components without
 * threading state through props or context.
 */

let pending: string | null = null;

/**
 * Викликати ЛИШЕ з обробника тапу: тут же, синхронно, відкривається клавіатура.
 *
 * iOS Safari відкриває клавіатуру від `focus()` тільки всередині жесту
 * користувача — або якщо вона вже відкрита. Картка ж монтується пізніше, після
 * зміни документа, і її `focus()` жестом уже не є. Поки режим приміток був
 * contentEditable, клавіатура зазвичай уже стояла; тепер (`MODE-19`) її нема.
 *
 * Тому в самому тапі фокусуємо невидиме поле-заступник: клавіатура
 * відкривається, а коли картка змонтується, фокус переходить у її поле —
 * перенесення фокуса при відкритій клавіатурі iOS дозволяє. Заступник
 * прибирає себе сам, щойно втратив фокус.
 */
export const setPendingFocus = (commentId: string): void => {
  pending = commentId;
  primeKeyboard();
};

export const consumePendingFocus = (commentId: string): boolean => {
  if (pending !== commentId) return false;
  pending = null;
  return true;
};

// Скільки чекати картку, перш ніж здатись і сховати клавіатуру.
const PROXY_TIMEOUT_MS = 1000;

const primeKeyboard = (): void => {
  const proxy = document.createElement("input");
  proxy.setAttribute("aria-hidden", "true");
  proxy.tabIndex = -1;
  // 16px — інакше iOS зумить сторінку на фокусі; 1px і прозорість — щоб поле
  // лишалось «фокусованим» для iOS, але не було видне.
  proxy.style.cssText =
    "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;pointer-events:none;";
  document.body.appendChild(proxy);
  proxy.addEventListener("blur", () => proxy.remove(), { once: true });
  proxy.focus({ preventScroll: true });
  setTimeout(() => {
    if (document.activeElement === proxy) proxy.blur();
  }, PROXY_TIMEOUT_MS);
};
