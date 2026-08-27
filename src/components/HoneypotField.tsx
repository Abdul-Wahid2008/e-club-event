'use client';

/**
 * Hidden field naive bots commonly auto-fill ("company_website" reads as a
 * normal field name to a scraper, but no real user sees or fills it since
 * it's visually and semantically hidden from assistive tech too). Any
 * non-empty value on submit is treated as a bot signal -- see
 * isHoneypotTripped() in src/lib/antiAbuse.ts, and callers must reject
 * SILENTLY, not with an error that reveals the trap.
 */
export default function HoneypotField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }} aria-hidden="true">
      <label htmlFor="company_website">Website</label>
      <input
        type="text"
        id="company_website"
        name="company_website"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
