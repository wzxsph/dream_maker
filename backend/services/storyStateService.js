function appendUnique(target, values) {
  const existing = new Set(target);
  for (const value of values || []) {
    if (value && !existing.has(value)) {
      target.push(value);
      existing.add(value);
    }
  }
}

export function mergeStatePatch(storyState, statePatch = {}) {
  const nextState = structuredClone(storyState || {});

  if (statePatch.current_phase) {
    nextState.current_phase = statePatch.current_phase;
  }

  nextState.facts = Array.isArray(nextState.facts) ? nextState.facts : [];
  nextState.open_threads = Array.isArray(nextState.open_threads) ? nextState.open_threads : [];
  nextState.characters = Array.isArray(nextState.characters) ? nextState.characters : [];

  appendUnique(nextState.facts, statePatch.facts_add);
  appendUnique(nextState.open_threads, statePatch.open_threads_add);

  const resolved = new Set(statePatch.open_threads_resolved || []);
  nextState.open_threads = nextState.open_threads.filter((thread) => !resolved.has(thread));

  for (const character of statePatch.characters_update || []) {
    if (!character.name) {
      continue;
    }

    const index = nextState.characters.findIndex((item) => item.name === character.name);
    if (index >= 0) {
      nextState.characters[index] = {
        ...nextState.characters[index],
        ...character
      };
    } else {
      nextState.characters.push(character);
    }
  }

  return nextState;
}
