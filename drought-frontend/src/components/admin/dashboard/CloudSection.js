'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Clock,
  HardDrive,
  Hash,
  RefreshCw,
} from 'lucide-react';
import { filesApi } from '@/services/adminApi';
import Badge from '@/components/admin/dashboard/Badge';
import { classifyFile, formatDate } from '@/components/admin/dashboard/helpers';

export default function CloudSection() {
  const [cloudFiles, setCloudFiles] = useState([]);
  const [bucket, setBucket] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadCloud = useCallback(async () => {
    setLoading(true);
    try {
      const data = await filesApi.listCloud();
      setCloudFiles(data.files || []);
      setBucket(data.bucket || '');
    } catch (err) {
      setError('Error listando archivos en la nube: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCloud();
  }, [loadCloud]);

  const handleSync = async () => {
    setSyncing(true);
    setError('');
    try {
      const result = await filesApi.syncCloud();
      setSuccess(
        `Sincronización: ${result.registered} registrados, ${result.skipped} omitidos, ${result.deleted_from_db} eliminados de BD`
      );
      loadCloud();
    } catch (err) {
      setError('Error sincronizando: ' + err.message);
    } finally {
      setSyncing(false);
    }
    setTimeout(() => {
      setSuccess('');
      setError('');
    }, 6000);
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

      <div className="ds-card" style={{ borderTop: '3px solid #f97316' }}>
        <div className="ds-card-header">
          <div className="ds-card-header-left">
            <div className="ds-card-icon" style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}>
              <Cloud size={20} color="white" />
            </div>
            <div>
              <p className="ds-card-title">Cloudflare R2</p>
              <p className="ds-card-subtitle">Bucket: {bucket || '…'} — {cloudFiles.length} archivos</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <button className="ds-btn ds-btn--ghost" onClick={loadCloud} disabled={loading}>
              <RefreshCw size={14} style={loading ? { animation: 'ds-spin 0.65s linear infinite' } : {}} />
              Refrescar
            </button>
            <button className="ds-btn ds-btn--orange" onClick={handleSync} disabled={syncing}>
              <RefreshCw size={14} style={syncing ? { animation: 'ds-spin 0.65s linear infinite' } : {}} />
              {syncing ? 'Sincronizando…' : 'Sincronizar BD ↔ Nube'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="ds-loader">
            <div className="ds-spinner ds-spinner--orange" />
          </div>
        ) : cloudFiles.length === 0 ? (
          <div className="ds-empty">
            <Cloud size={40} color="#cbd5e1" />
            <p className="ds-empty-title">No se encontraron archivos en la nube</p>
          </div>
        ) : (
          <div>
            {cloudFiles.map((file, idx) => {
              const info = classifyFile(file.filename);
              return (
                <div key={idx} className="ds-file-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                      <p className="ds-file-name">{file.filename}</p>
                      <Badge color={info.color}>{info.source}</Badge>
                      {file.registered ? <Badge color="green">Registrado</Badge> : <Badge color="amber">Sin registrar</Badge>}
                    </div>
                    <div className="ds-file-meta">
                      <span className="ds-file-meta-item">
                        <HardDrive size={11} />
                        {file.size_mb} MB
                      </span>
                      <span className="ds-file-meta-item">
                        <Clock size={11} />
                        {formatDate(file.last_modified)}
                      </span>
                      {file.file_id && (
                        <span className="ds-file-meta-item">
                          <Hash size={11} />
                          ID: {file.file_id}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
