'use client'

import { redirect } from 'next/navigation'
import { useEffect } from 'react'

export default function DashboardPage() {
  useEffect(() => {
    // Redirect to the text page which has the new interface
    window.location.href = '/text'
  }, [])
  
  // This will never render because of the redirect
  return null
}
