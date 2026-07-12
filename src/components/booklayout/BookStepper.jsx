import React from "react";
import { Check } from "lucide-react";

export default function BookStepper({ steps, current, onJump }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {steps.map((s, i) => {
        const done = current > i;
        const active = current === i;
        return (
          <React.Fragment key={s.id}>
            <button
              type="button"
              onClick={() => onJump?.(i)}
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : done
                  ? "bg-primary/15 text-primary hover:bg-primary/25"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {done ? <Check className="w-3 h-3" /> : <span>{i + 1}</span>}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < steps.length - 1 && <div className="w-3 h-px bg-border shrink-0" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}