const SLOT_DEFINITIONS = [
  { key: '08:00-10:00', startHour: 8, endHour: 10 },
  { key: '10:00-12:00', startHour: 10, endHour: 12 },
  { key: '14:00-16:00', startHour: 14, endHour: 16 },
  { key: '16:00-18:00', startHour: 16, endHour: 18 },
  { key: '18:00-20:00', startHour: 18, endHour: 20 }
];

function normalizeDate(dateInput) {
  if (!dateInput) return null;
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) {
    return null;
  }
  const normalized = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return normalized;
}

function buildSlotsForDate(dateInput) {
  const normalized = normalizeDate(dateInput);
  if (!normalized) return null;

  return SLOT_DEFINITIONS.map((slotDef) => {
    const start = new Date(normalized);
    start.setUTCHours(slotDef.startHour, 0, 0, 0);

    const end = new Date(normalized);
    end.setUTCHours(slotDef.endHour, 0, 0, 0);

    return {
      key: slotDef.key,
      startTime: start,
      endTime: end
    };
  });
}

function findSlotByKey(dateInput, slotKey) {
  const slots = buildSlotsForDate(dateInput);
  if (!slots) return null;
  return slots.find((slot) => slot.key === slotKey) || null;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

module.exports = {
  SLOT_DEFINITIONS,
  buildSlotsForDate,
  findSlotByKey,
  normalizeDate,
  overlaps
};
