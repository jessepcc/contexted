import type { ReactElement } from 'react';

interface CountdownProps {
  days: string;
  hours: string;
  minutes: string;
  label?: string;
}

function TimeBox({ value, unit }: { value: string; unit: string }): ReactElement {
  return (
    <div className="flex h-14 w-[3.25rem] min-w-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-md bg-bg-elevated px-1">
      <span className="font-heading text-[22px] font-bold text-text-primary">{value}</span>
      <span className="text-[10px] font-bold tracking-[0.18em] text-text-muted">{unit}</span>
    </div>
  );
}

export function Countdown({ days, hours, minutes, label = 'NEXT DROP' }: CountdownProps): ReactElement {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[12px] font-bold tracking-[0.18em] text-accent-ink">{label}</span>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <TimeBox value={days} unit="DAYS" />
        <span className="font-heading text-xl font-bold text-text-muted">:</span>
        <TimeBox value={hours} unit="HRS" />
        <span className="font-heading text-xl font-bold text-text-muted">:</span>
        <TimeBox value={minutes} unit="MIN" />
      </div>
    </div>
  );
}
