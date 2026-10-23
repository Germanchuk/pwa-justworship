/** Модель пісні — що з неї бачать місток (`bridge`) і застосунок. Почни читати з `song.ts`. */
export * from "./song";
export * from "./lanes";
export * from "./cells";
export * from "./read";
export * from "./write";
export * from "./meta";
export * from "./personal";
export * from "./dynamics";
export * from "./rules/slash";
export * from "./rules/enter";
export * from "./rules/merge";
export * from "./rules/deleteRange";
export * from "./rules/paste";
export { addNote, ALL, canSee, isTimeRange, moveNoteTo, noteRange, notesOf, othersSeeing, removeNote, STRIKE, updateNote } from "./notes/marks";
export type { Audience, NoteRange, NoteRecord, TextAt } from "./notes/marks";
export { noteCounts, resolveNotes } from "./notes/show";
export type { NoteView } from "./notes/show";
