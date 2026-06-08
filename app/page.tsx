import { Shell } from '@/components/dashboard/Shell'
import { OperatorCard } from '@/components/dashboard/OperatorCard'
import { SessionCard } from '@/components/dashboard/SessionCard'
import { HabitsCard } from '@/components/dashboard/HabitsCard'
import { GoalsCard } from '@/components/dashboard/GoalsCard'
import { BlockersCard } from '@/components/dashboard/BlockersCard'
import { WaterCard } from '@/components/dashboard/WaterCard'
import { WeightCard } from '@/components/dashboard/WeightCard'
import { FinanceCard } from '@/components/dashboard/FinanceCard'
import { CalendarCard } from '@/components/dashboard/CalendarCard'
import { WhoopCard } from '@/components/dashboard/WhoopCard'
import { MorningRoutineCard } from '@/components/dashboard/MorningRoutineCard'
import { CaptureBox } from '@/components/dashboard/CaptureBox'

export default function HomePage() {
  return (
    <Shell>
      <div className="grid gap-4" style={{ gridTemplateColumns: '340px minmax(0, 1fr) 340px' }}>

        {/* Left column — Operator · Key Blockers · Whoop */}
        <div className="flex flex-col gap-4 min-w-0">
          <OperatorCard />
          <MorningRoutineCard />
          <BlockersCard />
          <WhoopCard />
        </div>

        {/* Centre column — Session · Habits · Calendar */}
        <div className="flex flex-col gap-4 min-w-0">
          <SessionCard />
          <HabitsCard />
          <CalendarCard />
        </div>

        {/* Right column — Weight · Hydration · Finance · Goals */}
        <div className="flex flex-col gap-4 min-w-0">
          <WeightCard />
          <WaterCard />
          <FinanceCard />
          <GoalsCard />
        </div>
      </div>

      <CaptureBox />
    </Shell>
  )
}
