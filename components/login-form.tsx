"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { api } from "@/lib/utils"

export default function LoginForm() {
  const [studentId, setStudentId] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Login API call
      const loginData = await api.login(studentId, password)
      
      // Store student data in localStorage
      localStorage.setItem(
        "studentData",
        JSON.stringify({
          studentId: loginData.student.id,
          username: loginData.student.username,
          fId: loginData.student.f_id,
          fullName: loginData.student.full_name,
          email: loginData.student.email,
          createdAt: loginData.student.created_at,
          message: loginData.message
        }),
      )
      
      // Fetch exam schedule (keep for backward compatibility)
      try {
        const scheduleData = await api.getSchedules()
        localStorage.setItem('examSchedule', JSON.stringify(scheduleData))
      } catch (scheduleError) {
        console.error('Failed to fetch schedule:', scheduleError)
        // Continue to dashboard even if old schedule fetch fails
      }
      
      
      router.push("/dashboard")
    } catch (error) {
      console.error('Login error:', error)
      setError("Invalid Student ID or Password. Please try again.")
    }

    setIsLoading(false)
  }

  return (
    <Card className="w-full bg-white border border-gray-200 shadow-lg rounded-lg overflow-hidden">
      <CardHeader className="bg-white text-center p-8 border-b border-gray-100">
        <div className="space-y-2">
          <h1 className="text-2xl text-gray-900 font-light tracking-wide">Access your admission test dashboard</h1>
          <p className="text-sm text-gray-500 font-normal">Enter your credentials to continue</p>
        </div>
      </CardHeader>
      <CardContent className="p-8">
        {error && (
          <Alert className="border-red-200 bg-red-50 mb-6">
            <AlertDescription className="text-red-700 flex items-center text-sm">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="studentId" className="text-gray-700 font-medium">
              Username            </Label>
            <Input
              id="studentId"
              type="text"
              placeholder="Enter your username"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
              className="border-gray-300 focus:border-[#2E3094] focus:ring-1 focus:ring-[#2E3094] h-12 bg-white text-gray-900 placeholder:text-gray-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-gray-700 font-medium">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border-gray-300 focus:border-[#2E3094] focus:ring-1 focus:ring-[#2E3094] h-12 bg-white text-gray-900 placeholder:text-gray-500"
            />
          </div>

          <div className="pt-4">
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#2E3094] to-[#4C51BF] hover:from-[#252865] hover:to-[#3d42a3] text-white font-medium py-3 px-4 rounded-md transition-all duration-200 h-12"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Signing in...
                </div>
              ) : (
                "Login"
              )}
            </Button>
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100">
          <div className="text-center text-xs text-gray-500">
            <p>© 2026 Daffodil International University</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
