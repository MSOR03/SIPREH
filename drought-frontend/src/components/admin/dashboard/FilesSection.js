'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  CloudRain,
  Clock,
  FileText,
  HardDrive,
  Hash,
  Plus,
  Trash2,
  TrendingUp,
  Upload,
  Waves,
  X,
} from 'lucide-react';
import { filesApi } from '@/services/adminApi';
import Badge from '@/components/admin/dashboard/Badge';
import { classifyFile, formatBytes, formatDate } from '@/components/admin/dashboard/helpers';

export default function FilesSection() {
  const [files, setFiles] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadSection, setUploadSection] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadFiles = useCallback(async () => {
    try {
      const data = await filesApi.list(0, 200);
      setFiles(data.files || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError('Error cargando archivos: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleUpload = async (fileList) => {
    setUploading(true);
    setError('');
    setSuccess('');

    let ok = 0;
    const errs = [];

    for (const file of fileList) {
      try {
        await filesApi.upload(file);
        ok++;
      } catch (err) {
        errs.push(`${file.name}: ${err.message}`);
      }
    }

    setUploading(false);
    if (ok > 0) {
      setSuccess(`${ok} archivo(s) subido(s) correctamente`);
      loadFiles();
    }
    if (errs.length > 0) {
      setError(errs.join('\n'));
    }
    setTimeout(() => {
      setSuccess('');
      setError('');
    }, 5000);
  };

  const handleDelete = async (fileId, filename) => {
    if (!confirm(`¿Eliminar "${filename}"?`)) return;
    try {
      await filesApi.delete(fileId);
      setSuccess(`"${filename}" eliminado`);
      loadFiles();
    } catch (err) {
      setError('Error eliminando: ' + err.message);
    }
    setTimeout(() => {
      setSuccess('');
      setError('');
    }, 4000);
  };

  const handleActivate = async (fileId, filename) => {
    try {
      await filesApi.activate(fileId);
      setSuccess(`"${filename}" activado`);
      loadFiles();
    } catch (err) {
      setError('Error activando: ' + err.message);
    }
    setTimeout(() => {
      setSuccess('');
      setError('');
    }, 4000);
  };

  const hydrometFiles = files.filter((f) => classifyFile(f.original_filename).category === 'hydromet');
  const hydrologicalFiles = files.filter((f) => classifyFile(f.original_filename).category === 'hydrological');
  const predictionFiles = files.filter((f) => classifyFile(f.original_filename).category === 'prediction');
  const otherFiles = files.filter((f) => classifyFile(f.original_filename).category === 'other');

  const stats = [
    {
      label: 'Total archivos',
      value: total,
      icon: BarChart3,
      iconStyle: { background: 'rgba(219,234,254,0.8)' },
      iconColor: '#1d4ed8',
      accent: '#3b82f6',
    },
    {
      label: 'Hidrometeorológicos',
      value: hydrometFiles.length,
      icon: CloudRain,
      iconStyle: { background: 'rgba(224,242,254,0.8)' },
      iconColor: '#0369a1',
      accent: '#0ea5e9',
    },
    {
      label: 'Hidrológicos',
      value: hydrologicalFiles.length,
      icon: Waves,
      iconStyle: { background: 'rgba(204,251,241,0.8)' },
      iconColor: '#0f766e',
      accent: '#14b8a6',
    },
    {
      label: 'Predicción',
      value: predictionFiles.length,
      icon: TrendingUp,
      iconStyle: { background: 'rgba(243,232,255,0.8)' },
      iconColor: '#7c3aed',
      accent: '#a855f7',
    },
  ];

  return (
    <div className="ds-section-gap">
      {error && (
        <div className="ds-alert ds-alert--error">
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span style={{ whiteSpace: 'pre-line' }}>{error}</span>
        </div>
      )}
      {success && (
        <div className="ds-alert ds-alert--success">
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
          {success}
        </div>
      )}

      <div className="ds-stats">
        {stats.map(({ label, value, icon: Icon, iconStyle, iconColor, accent }) => (
          <div className="ds-stat-card" key={label} style={{ borderLeftColor: accent }}>
            <div className="ds-stat-icon" style={iconStyle}>
              <Icon size={20} color={iconColor} />
            </div>
            <div>
              <p className="ds-stat-value">{value}</p>
              <p className="ds-stat-label">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <FileCategory
        title="Datos Hidrometeorológicos"
        subtitle="ERA5, IMERG, CHIRPS — archivos .parquet"
        icon={CloudRain}
        accentColor="#3b82f6"
        iconGradient="linear-gradient(135deg,#3b82f6,#1d4ed8)"
        files={hydrometFiles}
        loading={loading}
        onDelete={handleDelete}
        onActivate={handleActivate}
        uploadOpen={uploadSection === 'hydromet'}
        onToggleUpload={() => setUploadSection(uploadSection === 'hydromet' ? null : 'hydromet')}
        onUpload={handleUpload}
        uploading={uploading}
        acceptHint="ERA5, IMERG o CHIRPS en el nombre"
        multiple
      />

      <FileCategory
        title="Datos Hidrológicos"
        subtitle="Caudales, niveles — estaciones hidrológicas"
        icon={Waves}
        accentColor="#14b8a6"
        iconGradient="linear-gradient(135deg,#14b8a6,#0f766e)"
        files={hydrologicalFiles}
        loading={loading}
        onDelete={handleDelete}
        onActivate={handleActivate}
        uploadOpen={uploadSection === 'hydrological'}
        onToggleUpload={() => setUploadSection(uploadSection === 'hydrological' ? null : 'hydrological')}
        onUpload={handleUpload}
        uploading={uploading}
        acceptHint="Datos de caudal o nivel hidrológico"
        multiple={false}
      />

      <FileCategory
        title="Datos de Predicción"
        subtitle="Horizontes: 1, 3, 6 y 12 meses"
        icon={TrendingUp}
        accentColor="#a855f7"
        iconGradient="linear-gradient(135deg,#a855f7,#7c3aed)"
        files={predictionFiles}
        loading={loading}
        onDelete={handleDelete}
        onActivate={handleActivate}
        uploadOpen={uploadSection === 'prediction'}
        onToggleUpload={() => setUploadSection(uploadSection === 'prediction' ? null : 'prediction')}
        onUpload={handleUpload}
        uploading={uploading}
        acceptHint="1 archivo por horizonte: 1m, 3m, 6m, 12m"
        multiple
      />

      {otherFiles.length > 0 && (
        <FileCategory
          title="Otros Archivos"
          subtitle="Sin clasificación automática"
          icon={FileText}
          accentColor="#64748b"
          iconGradient="linear-gradient(135deg,#64748b,#475569)"
          files={otherFiles}
          loading={loading}
          onDelete={handleDelete}
          onActivate={handleActivate}
          uploadOpen={false}
          onToggleUpload={() => {}}
          onUpload={handleUpload}
          uploading={uploading}
          acceptHint=""
          hideUpload
        />
      )}
    </div>
  );
}

function FileCategory({
  title,
  subtitle,
  icon: Icon,
  accentColor,
  iconGradient,
  files,
  loading,
  onDelete,
  onActivate,
  uploadOpen,
  onToggleUpload,
  onUpload,
  uploading,
  acceptHint,
  multiple = true,
  hideUpload = false,
}) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.name.endsWith('.parquet'));
    if (dropped.length > 0) onUpload(multiple ? dropped : [dropped[0]]);
  };

  const handleFileInput = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length > 0) onUpload(multiple ? selected : [selected[0]]);
    e.target.value = '';
  };

  return (
    <div className="ds-card" style={{ borderTop: `3px solid ${accentColor}` }}>
      <div className="ds-card-header">
        <div className="ds-card-header-left">
          <div className="ds-card-icon" style={{ background: iconGradient }}>
            <Icon size={20} color="white" />
          </div>
          <div>
            <p className="ds-card-title">{title}</p>
            <p className="ds-card-subtitle">{subtitle}</p>
          </div>
          <Badge
            color={
              accentColor === '#64748b'
                ? 'gray'
                : accentColor === '#3b82f6'
                  ? 'blue'
                  : accentColor === '#14b8a6'
                    ? 'teal'
                    : 'purple'
            }
          >
            {files.length} archivo{files.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        {!hideUpload && (
          <button className={`ds-btn ${uploadOpen ? 'ds-btn--danger-outline' : 'ds-btn--ghost'}`} onClick={onToggleUpload}>
            {uploadOpen ? <X size={14} /> : <Upload size={14} />}
            {uploadOpen ? 'Cerrar' : 'Subir archivo'}
          </button>
        )}
      </div>

      {uploadOpen && (
        <div className="ds-upload-zone">
          <div
            className={`ds-drop-area${dragOver ? ' ds-drop-area--over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {uploading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <div className="ds-spinner" />
                <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>Subiendo archivo(s)…</p>
              </div>
            ) : (
              <>
                <Upload size={32} color="#94a3b8" />
                <p className="ds-drop-title">Arrastra archivos .parquet aquí o</p>
                <label className="ds-btn ds-btn--primary" style={{ cursor: 'pointer' }}>
                  <Plus size={14} />
                  Seleccionar archivo{multiple ? 's' : ''}
                  <input
                    type="file"
                    accept=".parquet"
                    multiple={multiple}
                    onChange={handleFileInput}
                    style={{ display: 'none' }}
                  />
                </label>
                {acceptHint && <p className="ds-drop-hint">{acceptHint}</p>}
              </>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="ds-loader">
          <div className="ds-spinner" />
        </div>
      ) : files.length === 0 ? (
        <div className="ds-empty">
          <FileText size={40} color="#cbd5e1" />
          <p className="ds-empty-title">No hay archivos en esta categoría</p>
          <p className="ds-empty-sub">Sube un archivo .parquet para comenzar</p>
        </div>
      ) : (
        <div>
          {files.map((file) => {
            const info = classifyFile(file.original_filename);
            const isActive = file.status === 'active';

            return (
              <div key={file.id} className="ds-file-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                    <p className="ds-file-name">{file.original_filename}</p>
                    <Badge color={info.color}>{info.source}</Badge>
                    {isActive ? <Badge color="green">Activo</Badge> : <Badge color="amber">{file.status}</Badge>}
                  </div>
                  <div className="ds-file-meta">
                    <span className="ds-file-meta-item">
                      <HardDrive size={11} />
                      {formatBytes(file.file_size)}
                    </span>
                    <span className="ds-file-meta-item">
                      <Clock size={11} />
                      {formatDate(file.created_at)}
                    </span>
                    <span className="ds-file-meta-item">
                      <Hash size={11} />
                      ID: {file.id}
                    </span>
                  </div>
                </div>
                <div className="ds-file-actions">
                  {!isActive && (
                    <button
                      className="ds-icon-btn ds-icon-btn--green"
                      onClick={() => onActivate(file.id, file.original_filename)}
                      title="Activar"
                    >
                      <CheckCircle2 size={16} />
                    </button>
                  )}
                  <button
                    className="ds-icon-btn ds-icon-btn--red"
                    onClick={() => onDelete(file.id, file.original_filename)}
                    title="Eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
