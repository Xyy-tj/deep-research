import React, { useEffect, useState } from 'react';
import { User } from '../user/types';

interface UserStatusProps {
  userId: string;
  onError?: (error: Error) => void;
}

export const UserStatus: React.FC<UserStatusProps> = ({ userId, onError }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserStatus = async () => {
    try {
      const response = await fetch(`/api/user/${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user status');
      }
      const userData = await response.json();
      setUser(userData);
    } catch (error) {
      onError?.(error as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserStatus();
    // 每30秒更新一次用户状态
    const interval = setInterval(fetchUserStatus, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  if (loading) {
    return <div className="user-status loading">Loading...</div>;
  }

  if (!user) {
    return <div className="user-status error">User not found</div>;
  }

  return (
    <div className="user-status">
      <div className="credits-display">
        <span className="credits-label">Credits:</span>
        <span className="credits-value">{user.credits}</span>
      </div>
      <div className="usage-history">
        <h4>Recent Activity</h4>
        <ul>
          {user.usageHistory.slice(0, 5).map((record, index) => (
            <li key={index}>
              <div className="usage-record">
                <span className="query">{record.query}</span>
                <span className="credits">-{record.creditsUsed} credits</span>
                <span className="timestamp">
                  {new Date(record.timestamp).toLocaleString()}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <style jsx>{`
        .user-status {
          padding: 1rem;
          border-radius: 8px;
          background: #f5f5f5;
          margin: 1rem 0;
        }

        .credits-display {
          font-size: 1.2rem;
          margin-bottom: 1rem;
        }

        .credits-label {
          font-weight: bold;
          margin-right: 0.5rem;
        }

        .credits-value {
          color: #2c5282;
        }

        .usage-history {
          font-size: 0.9rem;
        }

        .usage-history h4 {
          margin: 0 0 0.5rem 0;
        }

        .usage-history ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .usage-record {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem;
          border-bottom: 1px solid #e2e8f0;
        }

        .query {
          flex: 1;
          margin-right: 1rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .credits {
          color: #e53e3e;
          margin: 0 1rem;
        }

        .timestamp {
          color: #718096;
          font-size: 0.8rem;
        }

        .loading {
          text-align: center;
          color: #718096;
        }

        .error {
          color: #e53e3e;
          text-align: center;
        }
      `}</style>
    </div>
  );
};
