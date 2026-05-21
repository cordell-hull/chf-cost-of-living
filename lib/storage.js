const STORAGE_VERSION = 1;

export function saveDraft(formKey, data) {
  try {
    const envelope = {
      version: STORAGE_VERSION,
      savedAt: new Date().toISOString(),
      data
    };
    localStorage.setItem(formKey, JSON.stringify(envelope));
  } catch {
    // Quota exceeded or storage unavailable — silently skip
  }
}

export function loadDraft(formKey) {
  try {
    const raw = localStorage.getItem(formKey);
    if (!raw) return null;

    const envelope = JSON.parse(raw);
    if (!envelope || envelope.version !== STORAGE_VERSION || !envelope.data) {
      clearDraft(formKey);
      return null;
    }

    return { data: envelope.data, savedAt: envelope.savedAt };
  } catch {
    clearDraft(formKey);
    return null;
  }
}

export function clearDraft(formKey) {
  try {
    localStorage.removeItem(formKey);
  } catch {
    // Storage unavailable — nothing to do
  }
}

export function hasDraft(formKey) {
  return loadDraft(formKey) !== null;
}
