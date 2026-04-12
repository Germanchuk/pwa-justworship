import {describe, it, expect} from "vitest";
import {chordLineToProgressionMap} from "../chordLineToProgressionMap";


describe("stringToMeasurableChordProgression", () => {
  it("", () => {
    const input = "| C |";
    const output = [{chord: "C", duration: 4}];

    expect(chordLineToProgressionMap(input)).toEqual(output);
  });

  it("", () => {
    const input = "| . . . C |";
    const output = [{chord: null, duration: 3}, {chord: "C", duration: 1}];

    expect(chordLineToProgressionMap(input)).toEqual(output);
  });

  it("", () => {
    const input = "| C . G . |";
    const output = [{chord: "C", duration: 2}, {chord: "G", duration: 2}];

    expect(chordLineToProgressionMap(input)).toEqual(output);
  });

  it("", () => {
    const input = "| C G . Em |";
    const output = [
      {chord: "C", duration: 1},
      {chord: "G", duration: 2},
      {chord: "Em", duration: 1},
    ];

    expect(chordLineToProgressionMap(input)).toEqual(output);
  });

  it("", () => {
    const input = "| C . . . |";
    const output = [{chord: "C", duration: 4}];

    expect(chordLineToProgressionMap(input)).toEqual(output);
  });

  it("", () => {
    const input = "| . C F . |";
    const output = [
      {chord: null, duration: 1},
      {chord: "C", duration: 1},
      {chord: "F", duration: 2},
    ];

    expect(chordLineToProgressionMap(input)).toEqual(output);
  });

  it("", () => {
    const input = "| C . |";
    const output = [
      {chord: "C", duration: 2},
    ];

    expect(chordLineToProgressionMap(input)).toEqual(output);
  });

  it("", () => {
    const input = "| C . . |";
    const output = [
      {chord: "C", duration: 3},
    ];

    expect(chordLineToProgressionMap(input)).toEqual(output);
  });

});
