import { REMIND_OPTIONS } from "@/lib/reminders";

/** Escolhe quanto tempo antes da hora da tarefa o Orion deve avisar (pode marcar vários). */
export function RemindPicker({ value, onChange, disabled }: { value: number[]; onChange: (v: number[]) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="lembrar-antes">
      {REMIND_OPTIONS.map((o) => {
        const on = value.includes(o.min);
        return (
          <button key={o.min} type="button" disabled={disabled} aria-pressed={on} onClick={() => onChange(on ? value.filter((m) => m !== o.min) : [...value, o.min].sort((a, b) => a - b))}
            className={`rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-40 ${on ? "border-cyan bg-cyan/15 text-cyan" : "border-border text-muted-foreground hover:text-foreground"}`}>{o.label}</button>
        );
      })}
    </div>
  );
}
