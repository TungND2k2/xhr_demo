import { useEffect, useState } from 'react';
import { getAuthState, subscribeAuth, refreshMe, logout as apiLogout } from '../api/payload';

/**
 * useAuth — subscribe vào state token + user trong api/payload.
 *
 * Trả về:
 *  - user: object hoặc null (chưa login / token hết hạn)
 *  - token: string hoặc null
 *  - loading: bool (true khi đang fetch user lần đầu)
 *  - logout(): clear session
 */
export default function useAuth() {
  const initial = getAuthState();
  const [token, setToken] = useState(initial.token);
  const [user, setUser] = useState(initial.user);
  const [loading, setLoading] = useState(!!initial.token && !initial.user);

  useEffect(() => {
    const unsubscribe = subscribeAuth(({ token: t, user: u }) => {
      setToken(t);
      setUser(u);
    });
    return unsubscribe;
  }, []);

  // Khi mount: nếu có token nhưng chưa có user info → fetch /me
  useEffect(() => {
    let cancel = false;
    if (token && !user) {
      setLoading(true);
      refreshMe().then((u) => {
        if (cancel) return;
        setUser(u);
        setLoading(false);
      });
    } else if (!token) {
      setLoading(false);
    }
    return () => { cancel = true; };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    token,
    user,
    loading,
    isAuthenticated: !!token && !!user,
    logout: apiLogout,
  };
}
