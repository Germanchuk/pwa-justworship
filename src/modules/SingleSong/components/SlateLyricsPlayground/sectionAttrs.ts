import type { DynamicsStepKey } from "./constants/dynamicsSteps";
import type { SectionChild, SectionElement } from "./types";

/**
 * Правила поведінки атрибутів секції при злитті й діленні.
 *
 * Межі секцій рухаються самі (порожній рядок між текстом — `SONG-7`), тож
 * користувач ніколи не «зливає» і не «ділить» секцію свідомо: він просто
 * стирає або ставить порожній рядок. Тому кожен атрибут мусить мати
 * передбачувану долю, інакше повтори чи динаміка тихо зникають або двояться.
 *
 * Тут — сама логіка, без Slate. Точка застосування одна — `withSections.ts`.
 */

/** Атрибути, долю яких вирішують ці правила. Решта пропсів секції не чіпається. */
type SectionAttrs = Pick<SectionElement, "repeat" | "collapsedFor" | "dynamicsSteps">;

/**
 * Готує атрибути до `Transforms.setNodes`.
 *
 * Проп знімається ЛИШЕ значенням `null`: @slate-yjs робить `removeAttribute`
 * на строгому `null`, а `undefined` поїхав би в спільний документ як значення
 * атрибута. У локальному Slate різниці немає, у Yjs — є.
 *
 * `reference` — вузол, чиї пропси секція вже має (при діленні нова секція ще
 * не існує й успадкує пропси старої). Ключі, яких у ньому немає, викидаємо,
 * щоб не слати операції-пустушки.
 */
export const toSetNodesProps = (
  attrs: SectionAttrs,
  reference: SectionElement,
): Partial<SectionElement> => {
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined) {
      props[key] = value;
    } else if (reference[key as keyof SectionAttrs] !== undefined) {
      props[key] = null;
    }
  }
  return props as Partial<SectionElement>;
};

const stepsOrUndefined = (
  steps: readonly DynamicsStepKey[],
): DynamicsStepKey[] | undefined => (steps.length === 0 ? undefined : [...steps]);

/**
 * Скільки рядків займає частина секції — міра «тексту» для пропорційного
 * ділення динаміки. Рахуємо саме рядки, а не символи: смужка динаміки — це
 * висота секції, а кожен рядок зошита однакової висоти незалежно від довжини.
 * `comment-anchor` — застарілий невидимий якір, висоти не має.
 */
const countLines = (children: readonly SectionChild[]): number =>
  children.filter((child) => child.type !== "comment-anchor").length;

/**
 * Склеює кроки динаміки двох секцій згори вниз, стягуючи однакові кроки НА
 * СТИКУ в один.
 *
 * Стик — єдине місце, де дублікат виник не з волі користувача: ділення
 * навмисно віддає межовий крок обом частинам (див. `splitDynamicsSteps`).
 * Тому склейка знімає рівно те, що додало ділення, — і `розділити → зʼєднати`
 * повертає початкову динаміку. Дублікати всередині секції не чіпаємо: їх
 * поставили руками.
 */
const concatDynamicsSteps = (
  upper: readonly DynamicsStepKey[],
  lower: readonly DynamicsStepKey[],
): DynamicsStepKey[] => {
  let seam = 0;
  while (
    seam < lower.length &&
    upper.length > 0 &&
    lower[seam] === upper[upper.length - 1]
  ) {
    seam += 1;
  }
  return [...upper, ...lower.slice(seam)];
};

/**
 * Верхня секція + нижня → одна.
 *
 * - повтори: домінує верхня;
 * - динаміка: натуральна склейка згори вниз, однакові кроки на стику
 *   зливаються в один. Ліміт у 10 кроків (`SONG-12`) свідомо не застосовуємо —
 *   він обмежує ручне редагування у вікні, а тут обрізання означало б втрату
 *   вже проставленої динаміки нижньої секції;
 * - згортання: завжди скидається для всіх. Навіть якщо обидві секції були
 *   закриті: після склейки заголовком лишається перший рядок верхньої, і
 *   текст нижньої зник би без жодної видимої причини.
 */
export const mergeSectionAttrs = (
  upper: SectionElement,
  lower: SectionElement,
): SectionAttrs => ({
  repeat: upper.repeat,
  dynamicsSteps: stepsOrUndefined(
    concatDynamicsSteps(upper.dynamicsSteps ?? [], lower.dynamicsSteps ?? []),
  ),
  collapsedFor: undefined,
});

/**
 * Ділить кроки динаміки пропорційно до кількості рядків у кожній частині.
 *
 * Крок на межі належить ОБОМ частинам: верхня дістає його останнім, нижня —
 * першим. Смужку розрізають по кроку, а не між кроками, тож колір у місці
 * розрізу лишається тим самим з обох боків, і жодна частина не втрачає
 * динаміку. Три кроки навпіл → `[1, 2] + [2, 3]`.
 *
 * Кроки — це опорні точки градієнта по висоті секції: крок `i` стоїть на
 * `i / (N-1)` висоти. Тому межовий крок — найближчий до частки, що дісталась
 * верхній частині. Один крок (суцільний колір) сюди вкладається сам собою:
 * межовим завжди буде він, і його дістануть обидві частини.
 */
const splitDynamicsSteps = (
  steps: readonly DynamicsStepKey[] | undefined,
  upperLines: number,
  lowerLines: number,
): [DynamicsStepKey[] | undefined, DynamicsStepKey[] | undefined] => {
  const all = steps ?? [];
  if (all.length === 0) return [undefined, undefined];

  const total = upperLines + lowerLines;
  const upperShare = total === 0 ? 0.5 : upperLines / total;
  const edge = Math.round(upperShare * (all.length - 1));
  return [all.slice(0, edge + 1), all.slice(edge)];
};

/**
 * Секція розпалась на дві: верхня лишається тією самою секцією, нижня — нова.
 *
 * - повтори: лишаються верхній, нова без повторів;
 * - динаміка: ділиться пропорційно до тексту (див. `splitDynamicsSteps`);
 * - згортання: верхня зберігає свій стан, нова завжди розгорнута.
 *
 * Нижні атрибути треба задавати явно: Slate при розділенні вузла копіює всі
 * пропси в новий, тож без цього нова секція успадкувала б і повтори, і
 * чужий стан згортання.
 */
export const splitSectionAttrs = (
  section: SectionElement,
  upperChildren: readonly SectionChild[],
  lowerChildren: readonly SectionChild[],
): { upper: SectionAttrs; lower: SectionAttrs } => {
  const [upperSteps, lowerSteps] = splitDynamicsSteps(
    section.dynamicsSteps,
    countLines(upperChildren),
    countLines(lowerChildren),
  );

  return {
    upper: {
      repeat: section.repeat,
      collapsedFor: section.collapsedFor,
      dynamicsSteps: upperSteps,
    },
    lower: {
      repeat: undefined,
      collapsedFor: undefined,
      dynamicsSteps: lowerSteps,
    },
  };
};
