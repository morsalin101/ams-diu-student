import LoginForm from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="mb-4 flex justify-center">
            <img src="/assets/img/diu-logo.png" alt="Daffodil International University" className="h-20 w-auto" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Student Portal</h1>
          <p className="text-gray-600 text-sm">Admission Test System</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
