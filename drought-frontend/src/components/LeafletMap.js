'use client';

import { useEffect, useRef, useState } from 'react';
import { getCellStyle } from '../utils/gridLevels';
import { HYDRO_STATIONS } from '../utils/hydroStations';

const BOGOTA_CENTER = [4.7110, -74.0721];


const stations = HYDRO_STATIONS.map(s => ({
  id: s.codigo,
  codigo: s.codigo,
  position: [s.lat, s.lon],
  name: s.name,
  area: `Código: ${s.codigo}`,
  type: 'secundaria',
}));

export default function LeafletMap({ 
  onStationSelect, 
  selectedStation, 
  onGridCellClick, 
  selectedCell,
  gridCells = [],
  currentLevel = 'LOW',
  hoveredCell = null,
  onCellDoubleClick,
  onCellMouseOver,
  onCellMouseOut,
  spatialDataCells = null, // Datos espaciales 2D para visualización
  spatialResolution = 0.05, // Resolución de las celdas espaciales
  theme = 'light', // Tema para tiles del mapa
  showGrid = true,       // Visibilidad de celdas del grid
  showStations = true,   // Visibilidad de estaciones
  showBoundary = true,   // Visibilidad del límite del área de estudio
}) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const markersRef = useRef([]);
  const gridLayerRef = useRef(null);
  const boundaryLayerRef = useRef(null); // Referencia al boundary GeoJSON
  const gridCellsRef = useRef([]);
  const spatialLayerRef = useRef(null); // Capa para datos 2D
  const spatialCellsRef = useRef([]);
  const tileLayerRef = useRef(null);         // Referencia al tile layer para swap dark/light
  const canvasRendererRef = useRef(null);    // Renderer canvas compartido — 1 <canvas> en vez de miles de SVG
  const spatialTooltipRef = useRef(null);    // Tooltip compartido para celdas 2D
  const onStationSelectRef = useRef(onStationSelect);
  const onGridCellClickRef = useRef(onGridCellClick);
  const onCellDoubleClickRef = useRef(onCellDoubleClick);
  const onCellMouseOverRef = useRef(onCellMouseOver);
  const onCellMouseOutRef = useRef(onCellMouseOut);
  
  // ✅ Refs para evitar closures stale en event listeners
  const selectedCellRef = useRef(selectedCell);
  const hoveredCellRef = useRef(hoveredCell);
  const currentLevelRef = useRef(currentLevel);
  
  const initAttemptedRef = useRef(false);
  const fitBoundsDoneRef = useRef(false); // ✅ Para evitar múltiples fitBounds que destruyen event listeners
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onStationSelectRef.current = onStationSelect;
  }, [onStationSelect]);

  useEffect(() => {
    onGridCellClickRef.current = onGridCellClick;
  }, [onGridCellClick]);

  useEffect(() => {
    onCellDoubleClickRef.current = onCellDoubleClick;
  }, [onCellDoubleClick]);

  useEffect(() => {
    onCellMouseOverRef.current = onCellMouseOver;
  }, [onCellMouseOver]);

  useEffect(() => {
    onCellMouseOutRef.current = onCellMouseOut;
  }, [onCellMouseOut]);

  // ✅ Mantener refs sincronizados con props
  useEffect(() => {
    selectedCellRef.current = selectedCell;
  }, [selectedCell]);

  useEffect(() => {
    hoveredCellRef.current = hoveredCell;
  }, [hoveredCell]);

  useEffect(() => {
    currentLevelRef.current = currentLevel;
  }, [currentLevel]);

  useEffect(() => {
    // Use ResizeObserver to wait until the container actually has dimensions
    const container = containerRef.current;
    if (!container) return;

    let observer;
    let timeoutId;

    const tryInit = async () => {
      if (initAttemptedRef.current || mapRef.current) return;

      const width = container.offsetWidth;
      const height = container.offsetHeight;

      if (width === 0 || height === 0) return; // Not ready yet

      initAttemptedRef.current = true;

      try {
        const L = (await import('leaflet')).default;

        // Clean any stale Leaflet state on the container
        if (container._leaflet_id) {
          delete container._leaflet_id;
          container.innerHTML = '';
        }

        const map = L.map(container, {
          center: BOGOTA_CENTER,
          zoom: 11,
          scrollWheelZoom: true,
          zoomControl: false,
          dragging: true,
          touchZoom: true,
          doubleClickZoom: true,
          boxZoom: true,
          keyboard: true,
          tap: true,
          preferCanvas: true, // Hint map to prefer canvas globally
        });

        // Canvas renderer compartido: 1 elemento <canvas> en lugar de miles de <path> SVG
        canvasRendererRef.current = L.canvas({ padding: 0.5, tolerance: 5 });

        // Tooltip compartido para celdas espaciales 2D (no crear uno por celda)
        spatialTooltipRef.current = L.tooltip({
          permanent: false,
          direction: 'top',
          offset: [0, -4],
          className: 'drought-cell-tooltip',
        });

        L.control.zoom({ position: 'topright' }).addTo(map);
        L.control.scale({ position: 'bottomleft', metric: true, imperial: false, maxWidth: 200 }).addTo(map);

        // CartoDB tiles — light_all / dark_all según tema activo
        const initialTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        const tileUrl = initialTheme === 'dark'
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
        tileLayerRef.current = L.tileLayer(tileUrl, {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 19,
          minZoom: 8,
          crossOrigin: true,
          detectRetina: true,
          keepBuffer: 4,
          updateWhenIdle: true,
          updateWhenZooming: false,
        }).addTo(map);

        // North arrow
        const NorthArrow = L.Control.extend({
          options: { position: 'topright' },
          onAdd() {
            const div = L.DomUtil.create('div', 'leaflet-control-north');
            div.innerHTML = `
              <div style="background:white;border:2px solid #333;border-radius:50%;width:50px;height:50px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:default;">
                <svg width="40" height="40" viewBox="0 0 40 40">
                  <defs>
                    <linearGradient id="ng" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style="stop-color:#dc2626"/>
                      <stop offset="100%" style="stop-color:#991b1b"/>
                    </linearGradient>
                  </defs>
                  <polygon points="20,5 15,30 20,25 25,30" fill="url(#ng)" stroke="#000" stroke-width="1"/>
                  <text x="20" y="38" text-anchor="middle" font-size="10" font-weight="bold" fill="#333">N</text>
                </svg>
              </div>`;
            return div;
          },
        });
        new NorthArrow().addTo(map);

        const makeIcon = (isSelected, isPrincipal, L) => {
          const color = isSelected ? '#dc2626' : isPrincipal ? '#2563eb' : '#059669';
          const size = isSelected ? 16 : isPrincipal ? 14 : 12;
          return L.divIcon({
            html: `<div style="position:relative;">
              <div style="width:${size}px;height:${size}px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;${isSelected ? 'animation:pulse 2s infinite;' : ''}"></div>
              ${isSelected ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:${size + 12}px;height:${size + 12}px;border:2px solid ${color};border-radius:50%;opacity:0.5;"></div>` : ''}
            </div>`,
            className: 'custom-station-marker',
            iconSize: [size + 6, size + 6],
            iconAnchor: [(size + 6) / 2, (size + 6) / 2],
          });
        };

        // ✅ Grid layer — inicialmente vacía, las celdas se crearán en useEffect
        // Esto evita duplicación: INIT puede tener gridCells=[] y useEffect lo poblará
        const gridGroup = L.layerGroup();
        gridCellsRef.current = [];
        gridGroup.addTo(map);
        gridLayerRef.current = gridGroup;
        
        // Crear capa para datos espaciales 2D (inicialmente vacía)
        const spatialGroup = L.layerGroup();
        spatialGroup.addTo(map);
        spatialLayerRef.current = spatialGroup;

        // ✅ Load study area boundary from GeoJSON - configurado para estar debajo sin interferir
        fetch('/data/study-area.geojson?t=' + Date.now())
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
          })
          .then(geojsonData => {
            const geoLayer = L.geoJSON(geojsonData, {
              style: {
                color: '#6B7280',
                weight: 3,
                opacity: 1,
                fill: false,
                dashArray: null,
              },
              interactive: false, // 🔥 CRITICAL: No capturar eventos de mouse - dejar pasar clicks a las celdas
              pane: 'tilePane', // Colocar en el pane más bajo (debajo de overlays)
            }).addTo(map);

            // Enviar explícitamente al fondo para que nunca interfiera con celdas
            geoLayer.bringToBack();
            boundaryLayerRef.current = geoLayer;
            
            // ✅ Zoom inicial para ver toda el área de estudio
            // Solo se ejecuta UNA VEZ gracias al flag, sin animación para no destruir listeners
            if (geoLayer.getBounds().isValid() && !fitBoundsDoneRef.current) {
              map.fitBounds(geoLayer.getBounds(), { 
                padding: [20, 20], 
                maxZoom: 13, 
                animate: false,  // Sin animación - evita destruir event listeners
                duration: 0 
              });
              fitBoundsDoneRef.current = true;
            }
          })
          .catch(err => {
            console.error('❌ Error loading study area:', err);
          });
        
        // Station markers
        stations.forEach(station => {
          const marker = L.marker(station.position, {
            icon: makeIcon(false, station.type === 'principal', L),
          }).addTo(map);

          marker.bindPopup(`
            <div style="font-size:13px;min-width:180px;">
              <div style="font-weight:bold;color:#1f2937;margin-bottom:4px;">${station.name}</div>
              <div style="color:#6b7280;font-size:12px;">${station.area}</div>
              <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb;">
                <button onclick="window.__selectStation('${station.id}')" style="background:#2563eb;color:white;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;width:100%;">
                  Seleccionar estación
                </button>
              </div>
            </div>`);

          marker.on('click', () => {
            onStationSelectRef.current?.({
              ...station,
              codigo: station.codigo,
              lat: station.position[0],
              lon: station.position[1],
            });
          });

          markersRef.current.push({ marker, station, L });
        });

        window.__selectStation = (id) => {
          const station = stations.find(s => String(s.id) === String(id));
          if (station) {
            onStationSelectRef.current?.({
              ...station,
              codigo: station.codigo,
              lat: station.position[0],
              lon: station.position[1],
            });
            map.closePopup();
          }
        };

        mapRef.current = map;
        setMapReady(true);

        // Pulse animation CSS
        if (!document.getElementById('leaflet-pulse-style')) {
          const style = document.createElement('style');
          style.id = 'leaflet-pulse-style';
          style.textContent = `@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`;
          document.head.appendChild(style);
        }

        // Invalidate size after mount to fix any tile rendering issues
        setTimeout(() => map.invalidateSize(), 100);

      } catch (err) {
        console.error('Error initializing map:', err);
        initAttemptedRef.current = false; // Allow retry
      }
    };

    // Watch for container to get dimensions
    observer = new ResizeObserver(() => {
      if (!initAttemptedRef.current) tryInit();
    });
    observer.observe(container);

    // Also try immediately in case it's already visible
    tryInit();

    return () => {
      observer?.disconnect();
      clearTimeout(timeoutId);
      if (window.__selectStation) delete window.__selectStation;
      if (mapRef.current) {
        try {
          markersRef.current.forEach(({ marker }) => marker.remove());
          markersRef.current = [];
          gridLayerRef.current?.remove();
          spatialLayerRef.current?.remove(); // Limpiar capa espacial
          spatialTooltipRef.current = null;
          canvasRendererRef.current = null;
          mapRef.current.remove();
          mapRef.current = null;
          initAttemptedRef.current = false;
        } catch (e) {
          console.warn('Map cleanup error:', e);
        }
      }
    };
  }, []);

  // Swap tile layer URL when theme changes (dark_all <-> light_all)
  useEffect(() => {
    if (!tileLayerRef.current) return;
    const url = theme === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    tileLayerRef.current.setUrl(url);
  }, [theme]);

  // Toggle station marker visibility
  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach(({ marker }) => {
      if (showStations) {
        if (!mapRef.current.hasLayer(marker)) marker.addTo(mapRef.current);
      } else {
        if (mapRef.current.hasLayer(marker)) marker.remove();
      }
    });
  }, [showStations, mapReady]);

  // Toggle boundary layer visibility
  useEffect(() => {
    if (!mapRef.current || !boundaryLayerRef.current) return;
    if (showBoundary) {
      if (!mapRef.current.hasLayer(boundaryLayerRef.current)) {
        boundaryLayerRef.current.addTo(mapRef.current);
        boundaryLayerRef.current.bringToBack();
      }
    } else {
      if (mapRef.current.hasLayer(boundaryLayerRef.current)) {
        boundaryLayerRef.current.remove();
      }
    }
  }, [showBoundary, mapReady]);

  // Update marker icons when selection changes
  useEffect(() => {
    if (!mapRef.current || markersRef.current.length === 0) return;

    import('leaflet').then(({ default: L }) => {
      markersRef.current.forEach(({ marker, station }) => {
        const isSelected = String(selectedStation?.id) === String(station.id) || selectedStation?.codigo === station.codigo;
        const isPrincipal = station.type === 'principal';
        const color = isSelected ? '#dc2626' : isPrincipal ? '#2563eb' : '#059669';
        const size = isSelected ? 16 : isPrincipal ? 14 : 12;

        marker.setIcon(L.divIcon({
          html: `<div style="position:relative;">
            <div style="width:${size}px;height:${size}px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;${isSelected ? 'animation:pulse 2s infinite;' : ''}"></div>
            ${isSelected ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:${size + 12}px;height:${size + 12}px;border:2px solid ${color};border-radius:50%;opacity:0.5;"></div>` : ''}
          </div>`,
          className: 'custom-station-marker',
          iconSize: [size + 6, size + 6],
          iconAnchor: [(size + 6) / 2, (size + 6) / 2],
        }));
      });
    });
  }, [selectedStation]);

  // Update grid cell styles when selection changes
  useEffect(() => {
    if (!mapRef.current || gridCellsRef.current.length === 0) return;

    gridCellsRef.current.forEach(({ rect, cell }) => {
      const isSelected = isCellSelected(cell, selectedCell);
      const isHovered = isCellSelected(cell, hoveredCell);
      
      const style = getCellStyle(currentLevel, isSelected, isHovered);
      rect.setStyle(style);
    });
  }, [selectedCell, hoveredCell, currentLevel]);

  // Regenerate grid when cells change — canvas renderer for better perf
  useEffect(() => {
    if (!mapRef.current || !gridLayerRef.current) return;
    
    // Ocultar celdas de navegación si hay datos espaciales 2D mostrados o si showGrid es false
    if ((spatialDataCells && spatialDataCells.length > 0) || !showGrid) {
      gridLayerRef.current.remove();
      return;
    }
    
    // Si no hay celdas, limpiar y salir
    if (!gridCells || gridCells.length === 0) {
      gridLayerRef.current.clearLayers();
      gridCellsRef.current = [];
      return;
    }

    import('leaflet').then(({ default: L }) => {
      // Asegurar que la capa de grid esté visible
      if (!mapRef.current.hasLayer(gridLayerRef.current)) {
        gridLayerRef.current.addTo(mapRef.current);
      }
      
      // Limpiar celdas previas
      gridLayerRef.current.clearLayers();
      gridCellsRef.current = [];

      const renderer = canvasRendererRef.current || L.canvas({ padding: 0.5 });

        gridCells.forEach(cell => {
        const cellStyle = getCellStyle(currentLevel, false, false);
        const rect = L.rectangle(cell.bounds, { ...cellStyle, renderer }).addTo(gridLayerRef.current);
        let clickTimer = null;

        // Single click — delayed so dblclick can cancel it
        rect.on('click', () => {
          clearTimeout(clickTimer);
          clickTimer = setTimeout(() => {
            onGridCellClickRef.current?.(cell);
          }, 220);
        });

        // Double click — cancel pending click, stop Leaflet doubleClickZoom
        rect.on('dblclick', (e) => {
          clearTimeout(clickTimer);
          L.DomEvent.stopPropagation(e);
          onCellDoubleClickRef.current?.(cell);
        });

        // Mouse over
        rect.on('mouseover', () => {
          onCellMouseOverRef.current?.(cell);
          const isSelected = isCellSelected(cell, selectedCellRef.current);
          if (!isSelected) {
            rect.setStyle(getCellStyle(currentLevelRef.current, false, true));
          }
        });

        // Mouse out
        rect.on('mouseout', () => {
          onCellMouseOutRef.current?.();
          const isSelected = isCellSelected(cell, selectedCellRef.current);
          if (!isSelected) {
            rect.setStyle(getCellStyle(currentLevelRef.current, false, false));
          }
        });

        gridCellsRef.current.push({ rect, cell });
      });
    });
  }, [gridCells, currentLevel, spatialDataCells, showGrid, mapReady]);

  // Renderizar celdas espaciales 2D cuando cambien
  useEffect(() => {
    if (!mapRef.current || !spatialLayerRef.current) return;
    
    import('leaflet').then(({ default: L }) => {
      // Restaurar marcadores de estación que fueron coloreados por datos 2D
      spatialCellsRef.current.forEach(({ rect, isStationOverride }) => {
        if (isStationOverride) {
          // Restaurar icono original del marcador
          const entry = markersRef.current.find((m) => m.marker === rect);
          if (entry) {
            const isSelected = String(selectedStation?.id) === String(entry.station.id)
              || selectedStation?.codigo === entry.station.codigo;
            const isPrincipal = entry.station.type === 'principal';
            const color = isSelected ? '#dc2626' : isPrincipal ? '#2563eb' : '#059669';
            const size = isSelected ? 16 : isPrincipal ? 14 : 12;
            rect.setIcon(L.divIcon({
              html: `<div style="position:relative;">
                <div style="width:${size}px;height:${size}px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;${isSelected ? 'animation:pulse 2s infinite;' : ''}"></div>
                ${isSelected ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:${size + 12}px;height:${size + 12}px;border:2px solid ${color};border-radius:50%;opacity:0.5;"></div>` : ''}
              </div>`,
              className: 'custom-station-marker',
              iconSize: [size + 6, size + 6],
              iconAnchor: [(size + 6) / 2, (size + 6) / 2],
            }));
            rect.unbindTooltip();
          }
        } else {
          rect.remove();
        }
      });
      spatialCellsRef.current = [];
      
      // Si no hay datos espaciales, salir
      if (!spatialDataCells || !Array.isArray(spatialDataCells) || spatialDataCells.length === 0) {
        return;
      }

      // Deduplicar por cell_id (o por coordenadas) para evitar sobrepintar la misma celda.
      const uniqueCellMap = new Map();
      spatialDataCells.forEach((cell) => {
        const key = cell.cell_id || `${Number(cell.lon).toFixed(6)}_${Number(cell.lat).toFixed(6)}`;
        if (!uniqueCellMap.has(key)) {
          uniqueCellMap.set(key, cell);
        }
      });
      const uniqueSpatialCells = Array.from(uniqueCellMap.values());

      console.log(`Renderizando ${uniqueSpatialCells.length} celdas 2D (deduplicadas desde ${spatialDataCells.length}) — canvas`);

      const renderer = canvasRendererRef.current || L.canvas({ padding: 0.5, tolerance: 5 });
      // Tooltip compartido: 1 objeto en vez de uno por celda
      const sharedTooltip = spatialTooltipRef.current
        || (spatialTooltipRef.current = L.tooltip({ permanent: false, direction: 'top', offset: [0, -4] }));

      // Pre-calcular bounds sin spread de arrays grandes (evita stack overflow con 3500+ items)
      let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;

      uniqueSpatialCells.forEach(cell => {
        const isHydroStation = Boolean(cell.codigo);

        if (isHydroStation) {
          // Estaciones hidrológicas: colorear el marcador de la estación directamente
          // en vez de dibujar un buffer circular que queda oculto detrás del punto.
          const cellValue = typeof cell.value === 'number' ? cell.value : parseFloat(cell.value);
          const color = cell.color || '#3b82f6';

          // Buscar el marcador existente por código de estación
          const entry = markersRef.current.find(
            (m) => String(m.station.codigo) === String(cell.codigo)
          );

          if (entry) {
            const size = 18;
            entry.marker.setIcon(L.divIcon({
              html: `<div style="position:relative;">
                <div style="width:${size}px;height:${size}px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:pointer;"></div>
              </div>`,
              className: 'custom-station-marker',
              iconSize: [size + 6, size + 6],
              iconAnchor: [(size + 6) / 2, (size + 6) / 2],
            }));

            // Tooltip con info 2D al hover
            entry.marker.unbindTooltip();
            entry.marker.bindTooltip(
              `<div style="font-size:12px;line-height:1.4">
                <strong style="color:#1f2937">${cell.station_name || cell.codigo}</strong><br/>
                Código: <b>${cell.codigo}</b><br/>
                Valor: <b>${!isNaN(cellValue) && cellValue !== null ? cellValue.toFixed(3) : 'N/A'}</b><br/>
                ${cell.category ? `Categoría: ${cell.category}<br/>` : ''}
                ${cell.severity != null ? `Severidad: ${cell.severity}` : ''}
              </div>`,
              { direction: 'top', offset: [0, -8] }
            );

            // Guardar referencia para restaurar cuando se limpien datos espaciales
            spatialCellsRef.current.push({ rect: entry.marker, cell, isStationOverride: true });
          }

          if (cell.lat < minLat) minLat = cell.lat;
          if (cell.lat > maxLat) maxLat = cell.lat;
          if (cell.lon < minLon) minLon = cell.lon;
          if (cell.lon > maxLon) maxLon = cell.lon;

        } else {
          // Celdas meteorológicas: renderizar como rectángulos
        const halfRes = spatialResolution / 2;
        const cellBounds = [
          [cell.lat - halfRes, cell.lon - halfRes],
          [cell.lat + halfRes, cell.lon + halfRes],
        ];

        if (cell.lat - halfRes < minLat) minLat = cell.lat - halfRes;
        if (cell.lat + halfRes > maxLat) maxLat = cell.lat + halfRes;
        if (cell.lon - halfRes < minLon) minLon = cell.lon - halfRes;
        if (cell.lon + halfRes > maxLon) maxLon = cell.lon + halfRes;

        const cellValue = typeof cell.value === 'number' ? cell.value : parseFloat(cell.value);

        const rect = L.rectangle(cellBounds, {
          fillColor: cell.color || '#3b82f6',
          fillOpacity: 0.7,
          color: '#fff',
          weight: 1,
          opacity: 0.8,
          renderer,       // Canvas — un único <canvas> en vez de miles de <path>
          interactive: true,
        }).addTo(spatialLayerRef.current);

        // Actualizar tooltip compartido en hover (no bindTooltip por celda)
        rect.on('mouseover', (e) => {
          sharedTooltip.setContent(
            `<div style="font-size:12px;line-height:1.4">
              <strong style="color:#1f2937">${cell.cell_id || `[${cell.lat.toFixed(3)}, ${cell.lon.toFixed(3)}]`}</strong><br/>
              Valor: <b>${!isNaN(cellValue) && cellValue !== null ? cellValue.toFixed(3) : 'N/A'}</b><br/>
              ${cell.category ? `Categoría: ${cell.category}<br/>` : ''}
              ${cell.severity != null ? `Severidad: ${cell.severity}` : ''}
            </div>`
          );
          sharedTooltip.setLatLng(e.latlng);
          if (!mapRef.current.hasLayer(sharedTooltip)) sharedTooltip.addTo(mapRef.current);
        });
        rect.on('mousemove', (e) => sharedTooltip.setLatLng(e.latlng));
        rect.on('mouseout', () => {
          if (mapRef.current && mapRef.current.hasLayer(sharedTooltip)) {
            sharedTooltip.removeFrom(mapRef.current);
          }
        });

        spatialCellsRef.current.push({ rect, cell });
        }
      });

      // fitBounds sin animación ni spread de arrays grandes
      if (isFinite(minLat)) {
        mapRef.current.fitBounds(
          [[minLat, minLon], [maxLat, maxLon]],
          { padding: [30, 30], animate: false }
        );
      }
    });
  }, [spatialDataCells, spatialResolution]);

  return <div ref={containerRef} className="w-full h-full" />;
}

// Helper function to check if a cell is selected
function isCellSelected(cell, selectedCell) {
  if (!selectedCell) return false;
  return (
    cell.center[0] === selectedCell.center[0] &&
    cell.center[1] === selectedCell.center[1]
  );
}
