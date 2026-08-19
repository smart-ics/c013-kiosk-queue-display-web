import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWavBuffer(frequency, durationSec) {
  const sampleRate = 8000;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate, 28); // ByteRate
  buffer.writeUInt16LE(1, 32); // BlockAlign
  buffer.writeUInt16LE(8, 34); // BitsPerSample

  // data
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write sine wave
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.round(127 + 127 * Math.sin(2 * Math.PI * frequency * t));
    buffer.writeUInt8(sample, 44 + i);
  }

  return buffer;
}

const audioDir = path.join(__dirname, '../apps/display-web/public/audio');
const lettersDir = path.join(audioDir, 'letters');

if (!fs.existsSync(lettersDir)) {
  fs.mkdirSync(lettersDir, { recursive: true });
}

// Generate chime.wav
const chimeBuffer = createWavBuffer(523.25, 0.4); // C5
fs.writeFileSync(path.join(audioDir, 'chime.wav'), chimeBuffer);
console.log('Generated chime.wav');

// Generate letters A-Z (a.wav to z.wav)
for (let i = 0; i < 26; i++) {
  const char = String.fromCharCode(97 + i); // a-z
  // Slightly vary frequency so they sound different (e.g. 300Hz + i * 20Hz)
  const freq = 300 + i * 20;
  const letterBuffer = createWavBuffer(freq, 0.2);
  fs.writeFileSync(path.join(lettersDir, `${char}.wav`), letterBuffer);
}
console.log('Generated letters a.wav to z.wav');
