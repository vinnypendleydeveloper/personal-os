export type Unit = 'weight' | 'reps' | 'time'

export interface ExerciseDef {
  name: string
  group: string
  sets: number
  target: string
  unit: Unit
  optional?: boolean
  isAbs?: boolean
}

export interface DayDef {
  day: number
  label: string
  rest?: boolean
  exercises: ExerciseDef[]
}

// ── Reusable blocks ───────────────────────────────────────────
const CHEST: ExerciseDef[] = [
  { name: 'Chest Press Machine', group: 'Chest', sets: 3, target: '8–10 reps', unit: 'weight' },
  { name: 'Cable Fly High → lower chest', group: 'Chest', sets: 3, target: '12 reps', unit: 'weight' },
  { name: 'Cable Fly Middle → mid chest', group: 'Chest', sets: 3, target: '12 reps', unit: 'weight' },
  { name: 'Cable Fly Low → upper chest', group: 'Chest', sets: 3, target: '12 reps', unit: 'weight' },
]

const TRICEPS: ExerciseDef[] = [
  { name: 'Cable Pushdowns', group: 'Triceps', sets: 3, target: '10–12 reps', unit: 'weight' },
  { name: 'Overhead Cable Tricep Extension', group: 'Triceps', sets: 3, target: '10 reps', unit: 'weight' },
  { name: 'Single Arm Cable Kickbacks', group: 'Triceps', sets: 3, target: '12 reps', unit: 'weight' },
]

const LATERALS: ExerciseDef[] = [
  { name: 'Lateral Raises', group: 'Shoulders', sets: 2, target: '12–15 reps', unit: 'weight' },
]

const BACK: ExerciseDef[] = [
  { name: 'Lat Pulldown', group: 'Back', sets: 3, target: '8–12 reps', unit: 'weight' },
  { name: 'Seated Cable Row', group: 'Back', sets: 3, target: '10 reps', unit: 'weight' },
  { name: 'Reverse Pec Deck', group: 'Back', sets: 3, target: '12 reps', unit: 'weight' },
  { name: 'Dumbbell Shrugs', group: 'Back', sets: 3, target: '12 reps', unit: 'weight' },
  { name: 'Straight Arm Pulldown', group: 'Back', sets: 3, target: '12 reps', unit: 'weight', optional: true },
]

const BICEPS: ExerciseDef[] = [
  { name: 'Dumbbell Curls', group: 'Biceps', sets: 3, target: '10 reps', unit: 'weight' },
  { name: 'Hammer Curls', group: 'Biceps', sets: 3, target: '10 reps', unit: 'weight' },
  { name: 'Preacher Curl Machine', group: 'Biceps', sets: 3, target: '10 reps', unit: 'weight' },
]

const SHOULDERS: ExerciseDef[] = [
  { name: 'Shoulder Press Machine', group: 'Shoulders', sets: 3, target: '8–10 reps', unit: 'weight' },
  { name: 'Dumbbell Lateral Raises', group: 'Shoulders', sets: 3, target: '12 reps', unit: 'weight' },
  { name: 'Cable Lateral Raises', group: 'Shoulders', sets: 3, target: '12 reps', unit: 'weight' },
  { name: 'Rear Delt Fly Machine', group: 'Shoulders', sets: 3, target: '12 reps', unit: 'weight' },
  { name: 'Front Plate Raises', group: 'Shoulders', sets: 3, target: '10 reps', unit: 'weight', optional: true },
]

const LEGS: ExerciseDef[] = [
  { name: 'Leg Press', group: 'Legs', sets: 3, target: '10 reps', unit: 'weight' },
  { name: 'Leg Extension', group: 'Legs', sets: 3, target: '12 reps', unit: 'weight' },
  { name: 'Seated Hamstring Curl', group: 'Legs', sets: 3, target: '12 reps', unit: 'weight' },
  { name: 'Calf Raises', group: 'Legs', sets: 3, target: '15 reps', unit: 'weight' },
]

const ABS: ExerciseDef[] = [
  { name: 'Sit-Ups', group: 'Abs', sets: 3, target: '15–20 reps', unit: 'reps', isAbs: true },
  { name: 'Crunches', group: 'Abs', sets: 3, target: '20 reps', unit: 'reps', isAbs: true },
  { name: 'Leg Raises (abs)', group: 'Abs', sets: 3, target: '12–15 reps', unit: 'reps', isAbs: true },
  { name: 'Russian Twists', group: 'Abs', sets: 3, target: '20 twists', unit: 'reps', isAbs: true },
  { name: 'Plank', group: 'Abs', sets: 3, target: '45–60 sec', unit: 'time', isAbs: true },
]

// ── The 8-day split ───────────────────────────────────────────
export const DAYS: DayDef[] = [
  { day: 1, label: 'Chest + Triceps + Abs', exercises: [...CHEST, ...TRICEPS, ...LATERALS, ...ABS] },
  { day: 2, label: 'Back + Biceps', exercises: [...BACK, ...BICEPS] },
  { day: 3, label: 'Shoulders + Legs + Abs', exercises: [...SHOULDERS, ...LEGS, ...ABS] },
  { day: 4, label: 'Rest / Light Cardio', rest: true, exercises: [] },
  { day: 5, label: 'Chest + Triceps', exercises: [...CHEST, ...TRICEPS, ...LATERALS] },
  { day: 6, label: 'Back + Biceps + Abs', exercises: [...BACK, ...BICEPS, ...ABS] },
  { day: 7, label: 'Shoulders + Legs', exercises: [...SHOULDERS, ...LEGS] },
  { day: 8, label: 'Rest / Light Cardio', rest: true, exercises: [] },
]

export function getDay(day: number): DayDef | undefined {
  return DAYS.find(d => d.day === day)
}
