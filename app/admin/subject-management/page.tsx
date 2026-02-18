"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SubjectManagement } from "@/components/subject-management"

export default function SubjectManagementPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const accountType = sessionStorage.getItem("accountType")
    if (!accountType) {
      router.push("/admin/login")
    } else {
      setIsAuthenticated(true)
    }
  }, [router])

  if (!isAuthenticated) {
    return null
  }

  return <SubjectManagement />
}
