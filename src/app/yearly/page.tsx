import { Suspense } from 'react'
import YearlyPageContent from './YearlyPageContent'

export default function YearlyPage() {
  return (
    <Suspense fallback={<div>로딩 중입니다...</div>}>
      <YearlyPageContent />
    </Suspense>
  )
}
