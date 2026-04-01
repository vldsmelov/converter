import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { requestJson } from "../api/request";
import PageHeader from "../components/PageHeader";

type RolesResponse = {
  permissions: string[];
  bundles: { name: string; description: string; permissions: string[] }[];
};

type UserRow = {
  id: string;
  username: string;
  enabled: boolean;
  email: string;
  first_name: string;
  last_name: string;
  roles: string[];
};

type DefaultField = {
  id: number;
  code: string;
  label: string;
  field_type: "string" | "number" | "boolean";
  default_value: string;
  required: boolean;
  is_system: boolean;
  created_at: string;
};

function sortedUnique(v: string[]) {
  return Array.from(new Set((v ?? []).filter(Boolean))).sort();
}

function boolRu(v: boolean) {
  return v ? "Да" : "Нет";
}

function fieldTypeRu(v: string) {
  if (v === "string") return "Строка";
  if (v === "number") return "Число";
  if (v === "boolean") return "Логическое";
  return v;
}

export default function AdminConsolePage() {
  const { token, keycloak } = useAuth();
  const roles: string[] = ((keycloak.tokenParsed as any)?.realm_access?.roles ?? []) as string[];
  const isAdmin = roles.includes("system.admin");

  const [loading, setLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [permissions, setPermissions] = useState<string[]>([]);
  const [bundles, setBundles] = useState<RolesResponse["bundles"]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [fields, setFields] = useState<DefaultField[]>([]);

  const [bundleName, setBundleName] = useState("");
  const [bundleDescription, setBundleDescription] = useState("");
  const [bundlePerms, setBundlePerms] = useState<string[]>([]);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newRoles, setNewRoles] = useState<string[]>([]);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUserRoles, setSelectedUserRoles] = useState<string[]>([]);

  const [fieldCode, setFieldCode] = useState("");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState<"string" | "number" | "boolean">("string");
  const [fieldDefaultValue, setFieldDefaultValue] = useState("");
  const [fieldRequired, setFieldRequired] = useState(false);

  const allRoles = useMemo(() => sortedUnique([...(permissions ?? []), ...(bundles ?? []).map((b) => b.name)]), [permissions, bundles]);

  const selectedUser = useMemo(() => users.find((u) => u.id === selectedUserId) ?? null, [users, selectedUserId]);

  async function loadAll() {
    if (!token || !isAdmin) return;
    setLoading(true);
    setErr(null);
    try {
      const [rolesRes, usersRes, fieldsRes] = await Promise.all([
        requestJson<RolesResponse>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/admin/iam/roles/`, token }),
        requestJson<UserRow[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/admin/iam/users/`, token }),
        requestJson<DefaultField[]>({ method: "GET", url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/admin/default-fields/`, token }),
      ]);
      setPermissions(rolesRes.permissions ?? []);
      setBundles(rolesRes.bundles ?? []);
      setUsers(usersRes ?? []);
      setFields(fieldsRes ?? []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAdmin]);

  useEffect(() => {
    if (!selectedUser) return;
    setSelectedUserRoles(sortedUnique(selectedUser.roles ?? []));
  }, [selectedUserId, selectedUser]);

  function toggle(list: string[], value: string, set: (v: string[]) => void) {
    if (list.includes(value)) set(list.filter((x) => x !== value));
    else set(sortedUnique([...list, value]));
  }

  async function createBundle() {
    if (!token) return;
    if (!bundleName.trim() || bundlePerms.length === 0) {
      setErr("Заполните имя роли и выберите минимум одно право.");
      return;
    }
    setErr(null);
    try {
      await requestJson({
        method: "POST",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/admin/iam/roles/`,
        token,
        body: {
          name: bundleName.trim(),
          description: bundleDescription.trim(),
          permissions: bundlePerms,
        },
      });
      setBundleName("");
      setBundleDescription("");
      setBundlePerms([]);
      await loadAll();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function createUser() {
    if (!token) return;
    if (!newUsername.trim() || !newPassword.trim()) {
      setErr("Укажите логин и пароль пользователя.");
      return;
    }
    setErr(null);
    try {
      await requestJson({
        method: "POST",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/admin/iam/users/`,
        token,
        body: {
          username: newUsername.trim(),
          password: newPassword,
          enabled: true,
          email: newEmail.trim(),
          first_name: newFirstName.trim(),
          last_name: newLastName.trim(),
          roles: newRoles,
        },
      });
      setNewUsername("");
      setNewPassword("");
      setNewEmail("");
      setNewFirstName("");
      setNewLastName("");
      setNewRoles([]);
      await loadAll();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function saveUserRoles() {
    if (!token || !selectedUserId) return;
    setErr(null);
    try {
      await requestJson({
        method: "PUT",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/admin/iam/users/${selectedUserId}/roles/`,
        token,
        body: { roles: selectedUserRoles },
      });
      await loadAll();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function createField() {
    if (!token) return;
    if (!fieldCode.trim() || !fieldLabel.trim()) {
      setErr("Для системного поля нужны код и название.");
      return;
    }
    setErr(null);
    try {
      await requestJson({
        method: "POST",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/admin/default-fields/`,
        token,
        body: {
          code: fieldCode.trim(),
          label: fieldLabel.trim(),
          field_type: fieldType,
          default_value: fieldDefaultValue,
          required: fieldRequired,
        },
      });
      setFieldCode("");
      setFieldLabel("");
      setFieldType("string");
      setFieldDefaultValue("");
      setFieldRequired(false);
      await loadAll();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function resetAllData() {
    if (!token || isResetting) return;
    const ok = window.confirm("Сбросить накладные и НСИ к состоянию по умолчанию? Системные поля сохранятся.");
    if (!ok) return;

    setErr(null);
    setIsResetting(true);
    try {
      await requestJson({
        method: "POST",
        url: `${import.meta.env.VITE_NSI_BASE_URL}/api/v1/admin/reset-defaults/`,
        token,
      });
      await requestJson({
        method: "POST",
        url: `${import.meta.env.VITE_DOCS_BASE_URL}/api/v1/admin/reset-defaults/`,
        token,
      });
      await loadAll();
      window.alert("Сброс выполнен");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setIsResetting(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="card">
        <PageHeader title="Администрирование" subtitle="Недостаточно прав (нужна роль system.admin)." />
      </div>
    );
  }

  return (
    <div className="card">
      <PageHeader
        title="Администрирование"
        subtitle="Пользователи, роли-доступы и системные поля по умолчанию."
        right={
          <>
            <button className="btn btn-tight" onClick={loadAll} disabled={loading || isResetting}>
              {loading ? "Загрузка..." : "Обновить"}
            </button>
            <button className="btn danger btn-tight" onClick={resetAllData} disabled={isResetting || loading}>
              {isResetting ? "Сброс..." : "Сбросить данные"}
            </button>
          </>
        }
      />

      {err && <div style={{ padding: 8, color: "#fca5a5" }}>{err}</div>}

      <div className="card" style={{ marginTop: 10 }}>
        <h4 style={{ marginTop: 0 }}>Роли доступа (наборы)</h4>
        <div className="modal-grid">
          <label>
            <small>Имя набора роли</small><br />
            <input value={bundleName} onChange={(e) => setBundleName(e.target.value)} placeholder="экономист" />
          </label>
          <label>
            <small>Описание</small><br />
            <input value={bundleDescription} onChange={(e) => setBundleDescription(e.target.value)} placeholder="Права экономиста" />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            <small>Права внутри роли</small>
            <div className="admin-check-grid">
              {permissions.map((r) => (
                <label key={r} className="admin-check-item">
                  <input type="checkbox" checked={bundlePerms.includes(r)} onChange={() => toggle(bundlePerms, r, setBundlePerms)} />
                  <span>{r}</span>
                </label>
              ))}
            </div>
          </label>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn primary btn-tight" onClick={createBundle}>Создать роль-набор</button>
        </div>
        <table className="compact-table" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Роль</th>
              <th>Описание</th>
              <th>Состав</th>
            </tr>
          </thead>
          <tbody>
            {bundles.map((b) => (
              <tr key={b.name}>
                <td><code>{b.name}</code></td>
                <td>{b.description || "-"}</td>
                <td><small>{(b.permissions ?? []).join(", ") || "-"}</small></td>
              </tr>
            ))}
            {bundles.length === 0 && <tr><td colSpan={3}><small>Наборов ролей пока нет.</small></td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 10 }}>
        <h4 style={{ marginTop: 0 }}>Пользователи</h4>
        <div className="modal-grid">
          <label>
            <small>Логин</small><br />
            <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
          </label>
          <label>
            <small>Пароль</small><br />
            <input value={newPassword} type="password" onChange={(e) => setNewPassword(e.target.value)} />
          </label>
          <label>
            <small>Эл. почта</small><br />
            <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </label>
          <label>
            <small>Имя/Фамилия</small><br />
            <div className="row" style={{ gap: 6 }}>
              <input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} placeholder="Имя" />
              <input value={newLastName} onChange={(e) => setNewLastName(e.target.value)} placeholder="Фамилия" />
            </div>
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            <small>Роли нового пользователя</small>
            <div className="admin-check-grid">
              {allRoles.map((r) => (
                <label key={r} className="admin-check-item">
                  <input type="checkbox" checked={newRoles.includes(r)} onChange={() => toggle(newRoles, r, setNewRoles)} />
                  <span>{r}</span>
                </label>
              ))}
            </div>
          </label>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn primary btn-tight" onClick={createUser}>Создать пользователя</button>
        </div>

        <table className="compact-table" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Логин</th>
              <th>Активен</th>
              <th>Роли</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{boolRu(u.enabled)}</td>
                <td><small>{(u.roles ?? []).join(", ") || "-"}</small></td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={3}><small>Пользователей не найдено.</small></td></tr>}
          </tbody>
        </table>

        <div className="card" style={{ marginTop: 10 }}>
          <h4 style={{ marginTop: 0 }}>Изменить роли пользователя</h4>
          <div className="row">
            <label>
              <small>Пользователь</small><br />
              <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                <option value="">- выбрать -</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>
            </label>
            <div style={{ flex: 1 }} />
            <button className="btn btn-tight" onClick={saveUserRoles} disabled={!selectedUserId}>Сохранить роли</button>
          </div>
          {selectedUserId && (
            <div className="admin-check-grid" style={{ marginTop: 8 }}>
              {allRoles.map((r) => (
                <label key={r} className="admin-check-item">
                  <input type="checkbox" checked={selectedUserRoles.includes(r)} onChange={() => toggle(selectedUserRoles, r, setSelectedUserRoles)} />
                  <span>{r}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 10 }}>
        <h4 style={{ marginTop: 0 }}>Системные поля по умолчанию</h4>
        <div className="modal-grid">
          <label>
            <small>Код (уникальный)</small><br />
            <input value={fieldCode} onChange={(e) => setFieldCode(e.target.value)} placeholder="project_code" />
          </label>
          <label>
            <small>Название</small><br />
            <input value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} placeholder="Код проекта" />
          </label>
          <label>
            <small>Тип</small><br />
            <select value={fieldType} onChange={(e) => setFieldType(e.target.value as any)}>
              <option value="string">Строка</option>
              <option value="number">Число</option>
              <option value="boolean">Логическое</option>
            </select>
          </label>
          <label>
            <small>Значение по умолчанию</small><br />
            <input value={fieldDefaultValue} onChange={(e) => setFieldDefaultValue(e.target.value)} />
          </label>
          <label className="admin-check-item" style={{ marginTop: 22 }}>
            <input type="checkbox" checked={fieldRequired} onChange={(e) => setFieldRequired(e.target.checked)} />
            <span>Обязательное поле</span>
          </label>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn primary btn-tight" onClick={createField}>Создать системное поле</button>
        </div>
        <table className="compact-table" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Код</th>
              <th>Название</th>
              <th>Тип</th>
              <th>По умолчанию</th>
              <th>Обязательное</th>
              <th>Системное</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.id}>
                <td><code>{f.code}</code></td>
                <td>{f.label}</td>
                <td>{fieldTypeRu(f.field_type)}</td>
                <td>{f.default_value || "-"}</td>
                <td>{boolRu(f.required)}</td>
                <td>{boolRu(f.is_system)}</td>
              </tr>
            ))}
            {fields.length === 0 && <tr><td colSpan={6}><small>Системных полей пока нет.</small></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
