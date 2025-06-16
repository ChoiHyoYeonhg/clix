// page.tsx (서버 컴포넌트)
import { Suspense } from 'react'
import VerifyComponent from './VerifyComponent'

export default function Page() {
  return (
    <Suspense fallback={<div>로딩 중...</div>}>
      <VerifyComponent />
    </Suspense>
  )
}
