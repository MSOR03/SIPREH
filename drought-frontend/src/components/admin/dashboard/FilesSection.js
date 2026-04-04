'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  CloudRain,
  Clock,
  Database,
  Download,
  FileText,
  GitMerge,
  HardDrive,
  Hash,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
  Upload,
  Waves,
  X,
} from 'lucide-react';
import { filesApi } from '@/services/adminApi';
import { useModal } from '@/contexts/ModalContext';
import Badge from '@/components/admin/dashboard/Badge';
import { classifyFile, formatBytes, formatDate } from '@/components/admin/dashboard/helpers';

export default function FilesSection() {
  const { showDangerConfirm } = useModal();
  const [files, setFiles] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadSection, setUploadSection] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [datasetCatalog, setDatasetCatalog] = useState([]);
  const [selectedDatasetKey, setSelectedDatasetKey] = useState('');
  const [selectedFileId, setSelectedFileId] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [yearMonth, setYearMonth] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [issuedAt, setIssuedAt] = useState('');
  const [activateNow, setActivateNow] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [datasetStatusLoading, setDatasetStatusLoading] = useState(false);
  const [datasetStatus, setDatasetStatus] = useState(null);

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

  const loadDatasetCatalog = useCallback(async () => {
    try {
      const data = await filesApi.getDatasetCatalog();
      const datasets = data.datasets || [];
      setDatasetCatalog(datasets);
      if (!selectedDatasetKey && datasets.length > 0) {
        setSelectedDatasetKey(datasets[0].dataset_key);
      }
    } catch (err) {
      setError('Error cargando catálogo de datasets: ' + err.message);
    }
  }, [selectedDatasetKey]);

  const loadDatasetStatus = useCallback(async (datasetKey) => {
    if (!datasetKey) return;
    setDatasetStatusLoading(true);
    try {
      const data = await filesApi.getDatasetStatus(datasetKey);
      setDatasetStatus(data);
    } catch (err) {
      setError('Error cargando estado de dataset: ' + err.message);
      setDatasetStatus(null);
    } finally {
      setDatasetStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
    loadDatasetCatalog();
  }, [loadFiles, loadDatasetCatalog]);

  useEffect(() => {
    if (!selectedDatasetKey) return;
    const selected = datasetCatalog.find((d) => d.dataset_key === selectedDatasetKey);
    const allowedRoles = selected?.allowed_roles || [];
    if (allowedRoles.length > 0) {
      setSelectedRole((prev) => allowedRoles.includes(prev) ? prev : allowedRoles[0]);
    }
    setActivateNow(selected?.dataset_type === 'prediction');
    loadDatasetStatus(selectedDatasetKey);
  }, [datasetCatalog, selectedDatasetKey, loadDatasetStatus]);

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
    showDangerConfirm(
      `¿Eliminar "${filename}"? Esta acción no se puede deshacer.`,
      'Eliminar archivo',
      async () => {
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
      }
    );
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

  const handleDownload = async (fileId, filename) => {
    try {
      const data = await filesApi.getDownloadUrl(fileId);
      const a = document.createElement('a');
      a.href = data.download_url;
      a.download = data.filename || filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      setError('Error descargando: ' + err.message);
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleAttachToDataset = async () => {
    if (!selectedDatasetKey || !selectedFileId || !selectedRole) {
      setError('Selecciona dataset, archivo y rol para adjuntar.');
      return;
    }

    setWorkflowBusy(true);
    setError('');
    setSuccess('');
    try {
      await filesApi.attachToDataset({
        file_id: Number(selectedFileId),
        dataset_key: selectedDatasetKey,
        role: selectedRole,
        year_month: yearMonth || null,
        period_start: periodStart || null,
        period_end: periodEnd || null,
        activate_now: activateNow,
        extra_metadata: issuedAt ? { issued_at: issuedAt } : {},
      });

      setSuccess('Archivo adjuntado al dataset correctamente.');
      await Promise.all([loadFiles(), loadDatasetStatus(selectedDatasetKey)]);
    } catch (err) {
      setError('Error adjuntando archivo al dataset: ' + err.message);
    } finally {
      setWorkflowBusy(false);
    }
  };

  const handleMergeAndRollover = async () => {
    const selected = datasetCatalog.find((d) => d.dataset_key === selectedDatasetKey);
    if (!selected) {
      setError('Selecciona un dataset.');
      return;
    }
    if (selected.dataset_type === 'prediction') {
      setError('prediction_main no usa merge-and-rollover; usa Adjuntar + Activar.');
      return;
    }
    if (!selectedFileId) {
      setError('Selecciona el archivo mensual (delta) para ejecutar merge.');
      return;
    }

    setWorkflowBusy(true);
    setError('');
    setSuccess('');
    try {
      const result = await filesApi.mergeAndRollover({
        dataset_key: selectedDatasetKey,
        monthly_file_id: Number(selectedFileId),
        year_month: yearMonth || null,
        period_start: periodStart || null,
        period_end: periodEnd || null,
        archive_previous_snapshot: true,
      });

      setSuccess(
        `Merge completado. Nuevo snapshot ID ${result.new_snapshot_file_id} (${result.output_rows} filas).`
      );
      await Promise.all([loadFiles(), loadDatasetStatus(selectedDatasetKey)]);
    } catch (err) {
      setError('Error en merge-and-rollover: ' + err.message);
    } finally {
      setWorkflowBusy(false);
    }
  };

  const hydrometFiles = files.filter((f) => classifyFile(f.original_filename).category === 'hydromet');
  const hydrologicalFiles = files.filter((f) => classifyFile(f.original_filename).category === 'hydrological');
  const predictionFiles = files.filter((f) => classifyFile(f.original_filename).category === 'prediction');
  const otherFiles = files.filter((f) => classifyFile(f.original_filename).category === 'other');
  const selectedDataset = datasetCatalog.find((d) => d.dataset_key === selectedDatasetKey) || null;
  const availableRoles = selectedDataset?.allowed_roles || [];
  const candidateFiles = files.filter((f) => f.status !== 'archived');

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

      <DatasetWorkflowCard
        datasetCatalog={datasetCatalog}
        selectedDataset={selectedDataset}
        selectedDatasetKey={selectedDatasetKey}
        setSelectedDatasetKey={setSelectedDatasetKey}
        candidateFiles={candidateFiles}
        selectedFileId={selectedFileId}
        setSelectedFileId={setSelectedFileId}
        availableRoles={availableRoles}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
        yearMonth={yearMonth}
        setYearMonth={setYearMonth}
        periodStart={periodStart}
        setPeriodStart={setPeriodStart}
        periodEnd={periodEnd}
        setPeriodEnd={setPeriodEnd}
        issuedAt={issuedAt}
        setIssuedAt={setIssuedAt}
        activateNow={activateNow}
        setActivateNow={setActivateNow}
        workflowBusy={workflowBusy}
        datasetStatusLoading={datasetStatusLoading}
        datasetStatus={datasetStatus}
        onRefreshStatus={() => loadDatasetStatus(selectedDatasetKey)}
        onAttach={handleAttachToDataset}
        onMerge={handleMergeAndRollover}
      />

      <FileCategory
        title="Sequías Meteorológicas"
        subtitle="ERA5, IMERG, CHIRPS — archivos .parquet"
        icon={CloudRain}
        accentColor="#3b82f6"
        iconGradient="linear-gradient(135deg,#3b82f6,#1d4ed8)"
        files={hydrometFiles}
        loading={loading}
        onDelete={handleDelete}
        onActivate={handleActivate}
        onDownload={handleDownload}
        uploadOpen={uploadSection === 'hydromet'}
        onToggleUpload={() => setUploadSection(uploadSection === 'hydromet' ? null : 'hydromet')}
        onUpload={handleUpload}
        uploading={uploading}
        acceptHint="ERA5, IMERG o CHIRPS en el nombre"
        multiple
      />

      <FileCategory
        title="Sequías Hidrológicas"
        subtitle="Caudales, niveles — estaciones hidrológicas"
        icon={Waves}
        accentColor="#14b8a6"
        iconGradient="linear-gradient(135deg,#14b8a6,#0f766e)"
        files={hydrologicalFiles}
        loading={loading}
        onDelete={handleDelete}
        onActivate={handleActivate}
        onDownload={handleDownload}
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
        onDownload={handleDownload}
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
          onDownload={handleDownload}
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

function DatasetWorkflowCard({
  datasetCatalog,
  selectedDataset,
  selectedDatasetKey,
  setSelectedDatasetKey,
  candidateFiles,
  selectedFileId,
  setSelectedFileId,
  availableRoles,
  selectedRole,
  setSelectedRole,
  yearMonth,
  setYearMonth,
  periodStart,
  setPeriodStart,
  periodEnd,
  setPeriodEnd,
  issuedAt,
  setIssuedAt,
  activateNow,
  setActivateNow,
  workflowBusy,
  datasetStatusLoading,
  datasetStatus,
  onRefreshStatus,
  onAttach,
  onMerge,
}) {
  const isPredictionDataset = selectedDataset?.dataset_type === 'prediction';

  return (
    <div className="ds-card" style={{ borderTop: '3px solid #f97316' }}>
      <div className="ds-card-header">
        <div className="ds-card-header-left">
          <div className="ds-card-icon" style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}>
            <Database size={20} color="white" />
          </div>
          <div>
            <p className="ds-card-title">Actualizacion Mensual por Dataset</p>
            <p className="ds-card-subtitle">Adjuntar archivos por rol, ejecutar merge y revisar estado</p>
          </div>
        </div>
        <button className="ds-btn ds-btn--ghost" onClick={onRefreshStatus} disabled={!selectedDatasetKey || datasetStatusLoading}>
          <RefreshCw size={14} />
          Actualizar estado
        </button>
      </div>

      <div style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem' }}>
          <div>
            <label className="ds-field-label">Dataset</label>
            <select className="ds-input" value={selectedDatasetKey} onChange={(e) => setSelectedDatasetKey(e.target.value)}>
              <option value="">Seleccionar dataset</option>
              {datasetCatalog.map((dataset) => (
                <option key={dataset.dataset_key} value={dataset.dataset_key}>
                  {dataset.dataset_key}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="ds-field-label">Archivo cargado</label>
            <select className="ds-input" value={selectedFileId} onChange={(e) => setSelectedFileId(e.target.value)}>
              <option value="">Seleccionar archivo</option>
              {candidateFiles.map((file) => (
                <option key={file.id} value={file.id}>
                  {file.original_filename} (ID {file.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="ds-field-label">Rol</label>
            <select className="ds-input" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
              <option value="">Seleccionar rol</option>
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="ds-field-label">Year-Month (opcional)</label>
            <input
              className="ds-input"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              placeholder="2025-09"
            />
          </div>

          <div>
            <label className="ds-field-label">Periodo inicio (opcional)</label>
            <input
              className="ds-input"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              placeholder="2025-09-01"
            />
          </div>

          <div>
            <label className="ds-field-label">Periodo fin (opcional)</label>
            <input
              className="ds-input"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              placeholder="2025-09-30"
            />
          </div>

          {isPredictionDataset && (
            <div>
              <label className="ds-field-label">Fecha de emision (prediccion)</label>
              <input
                type="date"
                className="ds-input"
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
              />
              <p style={{ fontSize: '0.7rem', color: '#888', marginTop: '4px' }}>
                Fecha que identifica esta prediccion en el historico
              </p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <label className="ds-check-label">
            <input
              type="checkbox"
              checked={activateNow}
              onChange={(e) => setActivateNow(e.target.checked)}
              disabled={isPredictionDataset}
            />
            Activar archivo inmediatamente
          </label>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="ds-btn ds-btn--primary" onClick={onAttach} disabled={workflowBusy}>
              <CheckCircle2 size={14} />
              Adjuntar al dataset
            </button>
            <button className="ds-btn ds-btn--orange" onClick={onMerge} disabled={workflowBusy || isPredictionDataset}>
              <GitMerge size={14} />
              Merge + Rollover
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '1.25rem 1.75rem' }}>
        <p className="ds-field-label" style={{ marginBottom: '0.75rem' }}>Estado del Dataset</p>
        {datasetStatusLoading ? (
          <div className="ds-loader" style={{ padding: '1rem 0' }}>
            <div className="ds-spinner" />
          </div>
        ) : !datasetStatus ? (
          <p className="ds-empty-sub" style={{ margin: 0 }}>Selecciona un dataset para ver su estado.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '1rem' }}>
            <div style={{ border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '0.875rem' }}>
              <p className="ds-card-subtitle" style={{ marginBottom: '0.5rem' }}>Activo</p>
              {datasetStatus.active_file ? (
                <>
                  <p className="ds-file-name" style={{ maxWidth: '100%', marginBottom: '0.5rem' }}>{datasetStatus.active_file.filename}</p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Badge color="green">Activo</Badge>
                    {datasetStatus.active_file.role && <Badge color="blue">{datasetStatus.active_file.role}</Badge>}
                    {datasetStatus.active_file.snapshot_version && (
                      <Badge color="teal">v{datasetStatus.active_file.snapshot_version}</Badge>
                    )}
                  </div>
                </>
              ) : (
                <p className="ds-empty-sub" style={{ margin: 0 }}>Sin archivo activo</p>
              )}
            </div>

            <div style={{ border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '0.875rem' }}>
              <p className="ds-card-subtitle" style={{ marginBottom: '0.5rem' }}>Pendientes</p>
              {datasetStatus.pending_deltas?.length > 0 ? (
                datasetStatus.pending_deltas.slice(0, 4).map((file) => (
                  <div key={file.file_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <span className="ds-empty-sub" style={{ margin: 0, color: '#475569' }}>{file.filename}</span>
                    <Badge color="amber">{file.role || 'pending'}</Badge>
                  </div>
                ))
              ) : (
                <p className="ds-empty-sub" style={{ margin: 0 }}>Sin pendientes</p>
              )}
            </div>

            <div style={{ border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', padding: '0.875rem' }}>
              <p className="ds-card-subtitle" style={{ marginBottom: '0.5rem' }}>Archivados recientes</p>
              {datasetStatus.archived_recent?.length > 0 ? (
                datasetStatus.archived_recent.slice(0, 4).map((file) => (
                  <div key={file.file_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <span className="ds-empty-sub" style={{ margin: 0, color: '#475569' }}>{file.filename}</span>
                    <Badge color="gray">archived</Badge>
                  </div>
                ))
              ) : (
                <p className="ds-empty-sub" style={{ margin: 0 }}>Sin historico archivado</p>
              )}
            </div>
          </div>
        )}
      </div>
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
  onDownload,
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
                  <button
                    className="ds-icon-btn ds-icon-btn--blue"
                    onClick={() => onDownload(file.id, file.original_filename)}
                    title="Descargar"
                  >
                    <Download size={16} />
                  </button>
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
