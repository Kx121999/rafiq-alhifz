// One sound at a time. The surah player and the guided session both play recitations; before either starts, the other is stopped.
const stops = new Map();
let current = '';

/** Registers how to silence an owner of sound (called once per owner). */
export const registerAudio = (name, stop) => { stops.set(name, stop) };

/** Called right before an owner starts a sound: stops whoever else was playing. */
export function takeAudio(name) {
  if (current && current !== name) { const stop = stops.get(current); if (stop) { try { stop() } catch (e) {} } }
  current = name;
}
export const audioOwner = () => current;
