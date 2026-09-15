import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorMessage, PageHeader, formatDate } from "../components/Ui";
import type { ManagedUser, Role } from "../types";

const roles: Role[] = ["STUDENT", "TECHNICIAN", "ADMIN"];

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | null>(null);

  const load = async () => {
    try {
      const result = await api.users();
      setUsers(result.users);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load users.",
      );
    }
  };

  useEffect(() => {
    void load();
  }, []);

  async function update(
    user: ManagedUser,
    changes: { role?: Role; isActive?: boolean },
  ) {
    setSaving(user.id);

    try {
      await api.updateUser(user.id, changes);
      await load();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not update user.",
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <PageHeader title="Users" />
      <ErrorMessage error={error} />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Active</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.displayName}</strong>
                  <small>{user.email}</small>
                </td>
                <td>
                  <select
                    disabled={saving === user.id}
                    value={user.role}
                    onChange={(event) =>
                      void update(user, { role: event.target.value as Role })
                    }
                  >
                    {roles.map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={user.isActive}
                      disabled={saving === user.id}
                      onChange={(event) =>
                        void update(user, { isActive: event.target.checked })
                      }
                    />
                    {user.isActive ? "Active" : "Inactive"}
                  </label>
                  {currentUser?.id === user.id && (
                    <small> Your own access is protected by the backend.</small>
                  )}
                </td>
                <td>{formatDate(user.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
