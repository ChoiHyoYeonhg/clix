// VerifyComponent.tsx (클라이언트 컴포넌트)
'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase/firebase'

export default function VerifyComponent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading'
  )

  useEffect(() => {
    const email = searchParams.get('email')
    if (!email) {
      setStatus('error')
      return
    }

    const verifyEmail = async () => {
      try {
        const ref = doc(db, 'pendingUsers', email)
        const docSnap = await getDoc(ref)

        if (!docSnap.exists()) {
          setStatus('error')
          return
        }

        const data = docSnap.data()
        if (data.isVerified) {
          setStatus('success')
          return
        }

        await updateDoc(ref, {
          isVerified: true,
        })
        setStatus('success')
      } catch (error) {
        console.error('이메일 인증 처리 실패:', error)
        setStatus('error')
      }
    }

    verifyEmail()
  }, [searchParams])

  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <div className="bg-gray-900 text-white text-center p-10 rounded-2xl shadow-xl max-w-md">
        {status === 'loading' && (
          <>
            <h1 className="text-3xl font-bold mb-4">인증 처리 중...</h1>
            <p className="text-gray-300">잠시만 기다려 주세요...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <h1 className="text-3xl font-bold mb-4">이메일 인증 완료!</h1>
            <p className="text-gray-300">이제 회원가입을 완료할 수 있습니다.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="text-3xl font-bold mb-4">인증 실패</h1>
            <p className="text-gray-300">
              유효하지 않은 이메일입니다. 다시 시도해주세요.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
