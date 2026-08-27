'use client';

/**
 * Hidden field naive bots commonly auto-fill. Any non-empty value on
 * submit is treated as a bot signal -- see isHoneypotTripped() in
 * src/lib/antiAbuse.ts, and callers must reject SILENTLY, not with an
 * error that reveals the trap.
 *
 * DELIBERATELY avoids realistic field names ("company_website", "phone",
 * "address", etc.) -- those are exactly what trigger a mobile browser's
 * own profile/form-fill heuristics (Chrome/Safari autofill can match on
 * `name` even through `autocomplete="off"` and even when the field is
 * positioned off-screen, not just when it's `display:none`). A real
 * registrant on a mobile browser silently autofilling this field would
 * get a fake "success" response and never know their registration was
 * actually dropped -- worse than any bot this is meant to catch. Uses a
 * nonsense field name plus `display:none` + zero size (autofill engines
 * generally respect true non-rendering, unlike off-screen positioning)
 * as a second layer.
 */
export default function HoneypotField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div
      style={{ display: 'none', width: 0, height: 0, overflow: 'hidden', position: 'absolute' }}
      aria-hidden="true"
    >
      <label htmlFor="hp_field_x92k">Leave this field empty</label>
      <input
        type="text"
        id="hp_field_x92k"
        name="hp_field_x92k"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
