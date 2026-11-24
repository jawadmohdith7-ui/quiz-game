import assert from "node:assert/strict";
import test from "node:test";
import { buildRoundStartedMessage } from "./sendRound.js";

test("sends slider settings without exposing the answer", () => {
  const message = buildRoundStartedMessage(
    { roundIndex: 0, totalRounds: 1, roundDurationMs: 30000 },
    {
      id: 1,
      text: "Question",
      min: 10,
      max: 110,
      step: 1,
      correctAnswer: 40,
      unit: "km",
      difficulty: "media",
      explanation: "Hidden until results.",
    }
  );

  assert.deepEqual(message.question, {
    id: 1,
    text: "Question",
    min: 10,
    max: 110,
    step: 1,
    unit: "km",
    difficulty: "media",
  });
});
