// Fuzzy-match a capture's text against the dashboard's tracked habits.
// Returns the canonical habit name if a confident match is found, else null.

interface HabitRule { habit: string; pattern: RegExp }

const HABIT_RULES: HabitRule[] = [
  {
    habit: 'Hit the gym',
    pattern: /\b(gym|lift(ed|ing)?|work(ed)?\s?out|train(ed|ing)?|chest|tricep|bicep|back day|leg day|legs?|shoulders?|squat|bench|deadlift|pull[- ]?ups?|cardio)\b/i,
  },
  {
    habit: 'Eat clean + calorie surplus',
    pattern: /\b(ate clean|eat clean|calorie surplus|hit (my )?calories|protein shake|meal prep|ate enough|bulk(ing)?|surplus|macros)\b/i,
  },
  {
    habit: 'No social media before noon',
    pattern: /\b(no social media|stayed off social|off social media|avoided social|no phone (this )?morning|no instagram|no tiktok|no scroll(ing)?)\b/i,
  },
  {
    habit: 'Work on business / clients',
    pattern: /\b(work(ed)? on (the )?(business|client|ai business)|client work|landing page|demo page|cold (outreach|email)|built (a|the|my)? ?(site|website|app)|ai business|new client)\b/i,
  },
  {
    habit: 'Wake up early (before 8am)',
    pattern: /\b(woke up early|wake up early|woke up at|up before 8|early (wake|rise)|got up early|5\s?am|6\s?am|7\s?am)\b/i,
  },
  {
    habit: 'Review North Star goals',
    pattern: /\b(review(ed)? (my )?goals|north star|checked (my )?goals|goal review)\b/i,
  },
]

// Phrases that mean the habit has NOT been done (aspiration, plan, negation, skip).
// If present, we don't auto-mark — avoids false positives like "should hit the gym".
const NOT_DONE = /\b(should|need(s)? to|want(s)? to|wanna|gonna|going to|plan(ning)? to|have to|has to|gotta|remember to|skip(ped|ping)?|missed?|forgot|haven'?t|hope to|hoping to|trying to|try to)\b/i

export function matchHabit(text: string): string | null {
  if (!text) return null
  if (NOT_DONE.test(text)) return null
  for (const { habit, pattern } of HABIT_RULES) {
    if (pattern.test(text)) return habit
  }
  return null
}
