import React from 'react';
import { useRouter } from 'next/router';
import { UserStatus } from './UserStatus';

export const Header: React.FC = () => {
  const router = useRouter();
  const [userId, setUserId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    if (!storedUserId && router.pathname !== '/login') {
      router.push('/login');
    } else {
      setUserId(storedUserId);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('userId');
    router.push('/login');
  };

  if (!userId) return null;

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">深度研究助手</h1>
          <div className="flex items-center space-x-4">
            <UserStatus 
              userId={userId} 
              onError={(error) => {
                console.error('User status error:', error);
                if (error.message === 'User not found') {
                  handleLogout();
                }
              }} 
            />
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>
      <style jsx>{`
        .bg-white {
          background-color: #FFFFFF;
        }
        .shadow-sm {
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }
        .max-w-7xl {
          max-width: 80rem;
        }
        .mx-auto {
          margin-left: auto;
          margin-right: auto;
        }
        .px-4 {
          padding-left: 1rem;
          padding-right: 1rem;
        }
        .py-4 {
          padding-top: 1rem;
          padding-bottom: 1rem;
        }
        .text-2xl {
          font-size: 1.5rem;
          line-height: 2rem;
        }
        .font-bold {
          font-weight: 700;
        }
        .text-gray-900 {
          color: #111827;
        }
        .space-x-4 > * + * {
          margin-left: 1rem;
        }
        .bg-red-600 {
          background-color: #DC2626;
        }
        .hover\\:bg-red-700:hover {
          background-color: #B91C1C;
        }
      `}</style>
    </header>
  );
};
