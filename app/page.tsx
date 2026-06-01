import { Shell } from '@/components/dashboard/Shell'
import { OperatorCard } from '@/components/dashboard/OperatorCard'
import { SessionCard } from '@/components/dashboard/SessionCard'
import { HabitsCard } from '@/components/dashboard/HabitsCard'
import { GoalsCard } from '@/components/dashboard/GoalsCard'
import { NutritionCard } from '@/components/dashboard/NutritionCard'
import { FinanceCard } from '@/components/dashboard/FinanceCard'
import { CalendarCard } from '@/components/dashboard/CalendarCard'
import { CaptureBox } from '@/components/dashboard/CaptureBox'

export default function HomePage() {
  return (
    <Shell>
      <div className="grid gap-4" style={{ gridTemplateColumns: '260px 1fr 260px' }}>

        {/* Left column */}
        <div className="flex flex-col gap-4">
          <OperatorCard />
          <CalendarCard />
          <GoalsCard />
        </div>

        {/* Centre column */}
        <div className="flex flex-col gap-4">
          <SessionCard />
          <HabitsCard />
          <div className="panel p-4 flex items-center justify-center min-h-[160px]">
            <a href="/crm" className="text-xs font-mono" style={{ color: 'var(--accent)' }}>
              Open CRM →
            </a>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <NutritionCard />
          <FinanceCard />
        </div>
      </div>

      <CaptureBox />
    </Shell>
  )
}
