import LoginForm from '@/components/login-form';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="mb-4 flex justify-center">
            <img
              src="/assets/img/diu-logo.png"
              alt="Daffodil International University"
              className="h-20 w-auto"
            />
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
