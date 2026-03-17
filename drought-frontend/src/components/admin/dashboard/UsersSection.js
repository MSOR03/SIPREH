'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  EyeOff,
  Mail,
  Plus,
  User,
  Users,
  X,
} from 'lucide-react';
import { usersApi } from '@/services/adminApi';
import Badge from '@/components/admin/dashboard/Badge';
import { formatDate } from '@/components/admin/dashboard/helpers';

export default function UsersSection() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    is_active: true,
    is_superuser: false,
  });

  const loadUsers = useCallback(async () => {
    try {
      const data = await usersApi.list();
      setUsers(data);
    } catch (err) {
      setError('Error cargando usuarios: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const resetForm = () => {
    setFormData({ email: '', full_name: '', password: '', is_active: true, is_superuser: false });
    setShowCreateForm(false);
    setEditingUser(null);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await usersApi.create(formData);
      setSuccess('Usuario creado correctamente');
      resetForm();
      loadUsers();
    } catch (err) {
      setError('Error creando usuario: ' + err.message);
    }
    setTimeout(() => {
      setSuccess('');
      setError('');
    }, 4000);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const updateData = { ...formData };
      if (!updateData.password) delete updateData.password;
      delete updateData.is_superuser;
      await usersApi.update(editingUser.id, updateData);
      setSuccess('Usuario actualizado');
      resetForm();
      loadUsers();
    } catch (err) {
      setError('Error actualizando: ' + err.message);
    }
    setTimeout(() => {
      setSuccess('');
      setError('');
    }, 4000);
  };

  const startEdit = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      full_name: user.full_name || '',
      password: '',
      is_active: user.is_active,
      is_superuser: user.is_superuser,
    });
    setShowCreateForm(false);
  };

  return (
    <div className="ds-section-gap">
      {error && (
        <div className="ds-alert ds-alert--error">
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}
      {success && (
        <div className="ds-alert ds-alert--success">
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
          {success}
        </div>
      )}

      {(showCreateForm || editingUser) && (
        <div className="ds-card" style={{ borderTop: '3px solid #3b82f6' }}>
          <div className="ds-card-header">
            <div className="ds-card-header-left">
              <div className="ds-card-icon" style={{ background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)' }}>
                <User size={20} color="white" />
              </div>
              <div>
                <p className="ds-card-title">{editingUser ? 'Editar usuario' : 'Nuevo usuario'}</p>
                <p className="ds-card-subtitle">
                  {editingUser ? editingUser.email : 'Completa los campos para crear la cuenta'}
                </p>
              </div>
            </div>
            <button className="ds-icon-btn ds-icon-btn--gray" onClick={resetForm}>
              <X size={16} />
            </button>
          </div>

          <form
            onSubmit={editingUser ? handleUpdateUser : handleCreateUser}
            style={{ padding: '1.5rem 1.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}
          >
            <div>
              <label className="ds-field-label">
                <Mail size={12} />
                Correo electrónico
              </label>
              <input
                className="ds-input"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div>
              <label className="ds-field-label">
                <User size={12} />
                Nombre completo
              </label>
              <input
                className="ds-input"
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Juan Pérez"
              />
            </div>
            <div>
              <label className="ds-field-label">
                <EyeOff size={12} />
                {editingUser ? 'Nueva contraseña (vacío para no cambiar)' : 'Contraseña'}
              </label>
              <input
                className="ds-input"
                type="password"
                required={!editingUser}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5rem', paddingBottom: '0.125rem' }}>
              <label className="ds-check-label">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                Activo
              </label>
              {!editingUser && (
                <label className="ds-check-label">
                  <input
                    type="checkbox"
                    checked={formData.is_superuser}
                    onChange={(e) => setFormData({ ...formData, is_superuser: e.target.checked })}
                  />
                  Administrador
                </label>
              )}
            </div>
            <div
              style={{
                gridColumn: '1/-1',
                display: 'flex',
                gap: '0.75rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <button type="submit" className="ds-btn ds-btn--primary">
                {editingUser ? 'Guardar cambios' : 'Crear usuario'}
              </button>
              <button type="button" className="ds-btn ds-btn--ghost" onClick={resetForm}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="ds-card" style={{ borderTop: '3px solid #3b82f6' }}>
        <div className="ds-card-header">
          <div className="ds-card-header-left">
            <div className="ds-card-icon" style={{ background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)' }}>
              <Users size={20} color="white" />
            </div>
            <div>
              <p className="ds-card-title">Usuarios registrados</p>
              <p className="ds-card-subtitle">{users.length} usuario{users.length !== 1 ? 's' : ''} en el sistema</p>
            </div>
          </div>
          {!showCreateForm && !editingUser && (
            <button
              className="ds-btn ds-btn--primary"
              onClick={() => {
                setShowCreateForm(true);
                setEditingUser(null);
              }}
            >
              <Plus size={14} />
              Nuevo usuario
            </button>
          )}
        </div>

        {loading ? (
          <div className="ds-loader">
            <div className="ds-spinner" />
          </div>
        ) : users.length === 0 ? (
          <div className="ds-empty">
            <Users size={40} color="#cbd5e1" />
            <p className="ds-empty-title">No hay usuarios registrados</p>
          </div>
        ) : (
          <div>
            {users.map((user) => (
              <div key={user.id} className="ds-file-row">
                <div
                  className="ds-avatar"
                  style={{
                    background: user.is_superuser
                      ? 'linear-gradient(135deg,#f59e0b,#d97706)'
                      : 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
                  }}
                >
                  {(user.full_name || user.email).charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1e293b' }}>
                      {user.full_name || user.email}
                    </span>
                    {user.is_superuser && <Badge color="amber">Admin</Badge>}
                    {user.is_active ? <Badge color="green">Activo</Badge> : <Badge color="red">Inactivo</Badge>}
                  </div>
                  <div className="ds-file-meta">
                    <span>{user.email}</span>
                    <span className="ds-file-meta-item">
                      <Clock size={11} />
                      Creado: {formatDate(user.created_at)}
                    </span>
                  </div>
                </div>
                <div className="ds-file-actions">
                  <button className="ds-btn ds-btn--ghost" style={{ fontSize: '0.8125rem' }} onClick={() => startEdit(user)}>
                    Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
