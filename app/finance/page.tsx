import { Shell } from '@/components/dashboard/Shell'
import { FinanceCard } from '@/components/dashboard/FinanceCard'

export default function FinancePage() {
  return (
    <Shell>
      <div className="max-w-md flex flex-col gap-4">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Finance</h1>
        <FinanceCard />
        <div className="rounded-lg p-4 text-xs" style={{ background: 'var(--ink-1)', border: '1px solid oklch(1 0 0 / 0.06)', color: 'var(--ink-4)' }}>
          <p className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Setup</p>
          <ol className="list-decimal list-inside flex flex-col gap-1">
            <li>Go to console.cloud.google.com → create a project</li>
            <li>Enable Drive API + Sheets API</li>
            <li>Create a service account → generate JSON key</li>
            <li>Share your Google Sheet with the service account email</li>
            <li>Add GOOGLE_SHEETS_FINANCE_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY to .env.local</li>
            <li>Hit the Refresh button above</li>
          </ol>
        </div>
      </div>
    </Shell>
  )
}
