import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { errorMessage } from "../System/types";
import type { UserRole } from "../../Contexts/Auth_Context";

export interface AdminUser {
  id: string;
  username: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export const useUsers = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // State changes only in the callbacks, so the effect can call it on mount.
  const load = () =>
    http
      .get<AdminUser[]>(End_Points.Admin_Users_Endpoint(), { withCredentials: true })
      .then((response) => {
        setUsers(response.data);
        setError('');
      })
      .catch((error: unknown) => setError(errorMessage(error)))
      .finally(() => setLoading(false));

  const fetchUsers = async () => {
    setLoading(true);
    await load();
  };

  useEffect(() => {
    void load();
  }, []);

  return { users, loading, error, fetchUsers };
};
