import { Shell } from '@/components/dashboard/Shell'
import { OperatorCard } from '@/components/dashboard/OperatorCard'
import { SessionCard } from '@/components/dashboard/SessionCard'
import { HabitsCard } from '@/components/dashboard/HabitsCard'
import { GoalsCard } from '@/components/dashboard/GoalsCard'
import { BlockersCard } from '@/components/dashboard/BlockersCard'
import { NutritionCard } from '@/components/dashboard/NutritionCard'
import { FinanceCard } from '@/components/dashboard/FinanceCard'
import { CalendarCard } from '@/components/dashboard/CalendarCard'
import { WhoopCard } from '@/components/dashboard/WhoopCard'
import { CaptureBox } from '@/components/dashboard/CaptureBox'

export default function HomePage() {
  return (
    <Shell>
      <div className="grid gap-4" style={{ gridTemplateColumns: '260px 1fr 260px' }}>

        {/* Left column */}
        <div className="flex flex-col gap-4">
          <OperatorCard />
          <BlockersCard />
          <CalendarCard />
        </div>

        {/* Centre column */}
        <div className="flex flex-col gap-4">
          <SessionCard />
          <HabitsCard />
          <GoalsCard />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <WhoopCard />
          <NutritionCard />
          <FinanceCard />
        </div>
      </div>

      <CaptureBox />
    </Shell>
  )
}
