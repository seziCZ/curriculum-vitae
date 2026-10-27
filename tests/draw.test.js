import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapText } from '../src/js/draw.js';
import { LAYERS } from '../src/js/palette.js';
import { LABEL_W } from '../src/js/layout.js';
import { canvasStub } from './helpers.js';

test('wrapText keeps every line within the width', () => {
  const ctx = canvasStub();
  const sentence = LAYERS[0].sentence;
  const lines = wrapText(ctx, sentence, LABEL_W);
  assert.ok(lines.length > 1, 'the sentence needs more than one line');
  for (const line of lines) assert.ok(line.length * 7.5 <= 220, `line too wide: "${line}"`);
  assert.equal(lines.join(' '), sentence);
});
