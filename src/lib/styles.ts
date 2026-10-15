// Shared Tailwind class strings, so every button and input looks the same.
// (Kept in a plain .ts file, not a component file.)

// Press feedback + keyboard focus ring, used on everything you can tap
const press =
  "transition-transform duration-150 ease-snappy active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100";
const focus = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral";

export const btnPrimary = `inline-flex h-13 w-full shrink-0 items-center justify-center gap-2 rounded-card bg-coral px-5 text-base font-bold text-white disabled:opacity-60 ${press} ${focus}`;

export const btnQuiet = `inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-line bg-white px-4 text-sm font-bold text-ink disabled:opacity-60 ${press} ${focus}`;

export const btnText = `inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-bold text-muted disabled:opacity-60 ${press} ${focus}`;

export const btnDanger = `inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-bold text-owes disabled:opacity-60 ${press} ${focus}`;

export const chip = `inline-flex h-11 items-center rounded-full border px-4 text-[15px] font-semibold ${press} ${focus}`;

// 16px text stops iPhones zooming in when you tap an input
export const input = `h-12 w-full rounded-card bg-surface px-3.5 text-base font-medium text-ink placeholder:text-muted/70 ${focus}`;

export const label = "flex flex-col gap-1.5 text-sm font-semibold";

export const cardLink = `block overflow-hidden rounded-card bg-surface ${focus} transition-transform duration-150 ease-snappy active:scale-[0.985] motion-reduce:transition-none motion-reduce:active:scale-100`;

export const h1 = "text-[32px] font-extrabold leading-tight tracking-tight";
export const h1Small = "text-[26px] font-extrabold leading-tight tracking-tight";
export const h2 = "text-[17px] font-bold";
