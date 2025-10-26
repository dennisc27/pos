export const toPositiveInteger = (value, { allowZero = false } = {}) => {
  if (typeof value === 'bigint') {
    const asNumber = Number(value);
    if (!Number.isSafeInteger(asNumber)) {
      return null;
    }

    if (allowZero) {
      return asNumber >= 0 ? asNumber : null;
    }

    return asNumber > 0 ? asNumber : null;
  }

  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      return null;
    }

    if (allowZero) {
      return value >= 0 ? value : null;
    }

    return value > 0 ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    if (!/^[-+]?\d+$/.test(trimmed)) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isSafeInteger(parsed)) {
      return null;
    }

    if (allowZero) {
      return parsed >= 0 ? parsed : null;
    }

    return parsed > 0 ? parsed : null;
  }

  return null;
};
