'use client';

import { useEffect, useRef, useState } from 'react';
import { getCellStyle } from '../utils/gridLevels';

const BOGOTA_CENTER = [4.7110, -74.0721];


const stations = [
  { id: 1, position: [4.7110, -74.0721], name: 'Estación Centro', area: 'Bogotá D.C.', type: 'principal' },
  { id: 2, position: [4.6097, -74.0817], name: 'Estación Sur', area: 'Zona Sur de Bogotá', type: 'secundaria' },
  { id: 3, position: [4.7567, -74.0309], name: 'Estación Norte', area: 'Zona Norte de Bogotá', type: 'secundaria' },
  { id: 4, position: [4.6500, -74.1100], name: 'Estación Occidental', area: 'Zona Occidental', type: 'secundaria' },
  { id: 5, position: [4.7200, -74.0400], name: 'Estación Oriental', area: 'Zona Oriental', type: 'secundaria' },
];

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
}) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const markersRef = useRef([]);
  const gridLayerRef = useRef(null);
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
  const initAttemptedRef = useRef(false);
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

        // Grid with selection support — canvas renderer
        const gridGroup = L.layerGroup();
        gridCellsRef.current = [];

        const cellStyle = getCellStyle(currentLevel, false, false);
        
        gridCells.forEach(cell => {
          const rect = L.rectangle(cell.bounds, { ...cellStyle, renderer: canvasRendererRef.current }).addTo(gridGroup);
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
            const isSelected = isCellSelected(cell, selectedCell);
            if (!isSelected) {
              const hoverStyle = getCellStyle(currentLevel, false, true);
              rect.setStyle(hoverStyle);
            }
          });
          
          // Mouse out
          rect.on('mouseout', () => {
            onCellMouseOutRef.current?.();
            const isSelected = isCellSelected(cell, selectedCell);
            if (!isSelected) {
              const normalStyle = getCellStyle(currentLevel, false, false);
              rect.setStyle(normalStyle);
            }
          });

          // Store reference with cell data
          gridCellsRef.current.push({ rect, cell });
        });
        
        gridGroup.addTo(map);
        gridLayerRef.current = gridGroup;
        
        // Crear capa para datos espaciales 2D (inicialmente vacía)
        const spatialGroup = L.layerGroup();
        spatialGroup.addTo(map);
        spatialLayerRef.current = spatialGroup;

                // Load study area boundary from GeoJSON
        fetch('/data/study-area.geojson?t=' + Date.now())
          .then(response => {
            console.log('📍 Fetch response status:', response.status);
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
          })
          .then(text => {
            console.log('📍 GeoJSON raw data length:', text.length);
            if (!text || text.trim().length === 0) {
              throw new Error('GeoJSON file is empty!');
            }
            try {
              const data = JSON.parse(text);
              console.log('✅ GeoJSON parsed successfully:', data);
              return data;
            } catch (e) {
              console.error('❌ JSON parse error:', e);
              throw e;
            }
          })
          .then(geojsonData => {
  console.log('📍 Creating GeoJSON layer...');
  console.log('📍 Features count:', geojsonData.features?.length || 'No features');

  const geoLayer = L.geoJSON(geojsonData, {
  style: {
  color: '#6B7280',  // Gris medio (Tailwind gray-500)
  weight: 3,          // Aumenté grosor para mejor visibilidad
  opacity: 1,
  fill: false,
  dashArray: null,
},
  onEachFeature: function (feature, layer) {
    layer.bringToBack();
  }
}).addTo(map);

  if (geoLayer.getBounds().isValid()) {
    map.fitBounds(geoLayer.getBounds(), { padding: [20, 20], maxZoom: 13 });
  }

  console.log('✅ GeoJSON layer added successfully');
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
            <div style="font-size:13px;min-width:150px;">
              <div style="font-weight:bold;color:#1f2937;margin-bottom:4px;">${station.name}</div>
              <div style="color:#6b7280;font-size:12px;">${station.area}</div>
              <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb;">
                <button onclick="window.__selectStation(${station.id})" style="background:#2563eb;color:white;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;width:100%;">
                  Seleccionar estación
                </button>
              </div>
            </div>`);

          marker.on('click', () => {
            onStationSelectRef.current?.(station);
          });

          markersRef.current.push({ marker, station, L });
        });

        window.__selectStation = (id) => {
          const station = stations.find(s => s.id === id);
          if (station) {
            onStationSelectRef.current?.(station);
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

  // Update marker icons when selection changes
  useEffect(() => {
    if (!mapRef.current || markersRef.current.length === 0) return;

    import('leaflet').then(({ default: L }) => {
      markersRef.current.forEach(({ marker, station }) => {
        const isSelected = selectedStation?.id === station.id;
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
    
    // Ocultar celdas de navegación si hay datos espaciales 2D mostrados
    if (spatialDataCells && spatialDataCells.length > 0) {
      gridLayerRef.current.remove();
      return;
    }

    import('leaflet').then(({ default: L }) => {
      // Asegurar que la capa de grid esté visible
      if (!mapRef.current.hasLayer(gridLayerRef.current)) {
        gridLayerRef.current.addTo(mapRef.current);
      }
      
      // O(1) batch clear vs O(n) forEach remove
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
          const isSelected = isCellSelected(cell, selectedCell);
          if (!isSelected) {
            rect.setStyle(getCellStyle(currentLevel, false, true));
          }
        });

        // Mouse out
        rect.on('mouseout', () => {
          onCellMouseOutRef.current?.();
          const isSelected = isCellSelected(cell, selectedCell);
          if (!isSelected) {
            rect.setStyle(getCellStyle(currentLevel, false, false));
          }
        });

        gridCellsRef.current.push({ rect, cell });
      });
    });
  }, [gridCells, currentLevel, spatialDataCells, mapReady]);

  // Renderizar celdas espaciales 2D cuando cambien
  useEffect(() => {
    if (!mapRef.current || !spatialLayerRef.current) return;
    
    import('leaflet').then(({ default: L }) => {
      // Limpiar celdas espaciales existentes
      spatialCellsRef.current.forEach(({ rect }) => rect.remove());
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
