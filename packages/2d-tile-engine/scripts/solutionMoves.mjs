/** Shared encode/decode for cc1-ms-solutions.json move arrays (Node scripts). */
export const TO_LETTER = { up: "U", down: "D", left: "L", right: "R" };
export const TO_DIRECTION = { U: "up", D: "down", L: "left", R: "right" };

export function encodeSolutionMoves(moves) {
  return moves.map((move) => (TO_DIRECTION[move] ? move : TO_LETTER[move]));
}

export function decodeSolutionMoves(moves) {
  return moves.map((move) => TO_DIRECTION[move] ?? move);
}
