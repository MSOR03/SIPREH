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
  onSpatialCellClick,       // Callback when a 2D spatial cell is clicked (cell data)
  theme = 'light', // Tema para tiles del mapa
  showGrid = true,       // Visibilidad de celdas del grid
  showStations = true,   // Visibilidad de estaciones
  showBoundary = true,   // Visibilidad del límite del área de estudio
  showCuencas = false,   // Visibilidad de cuencas
  showEmbalses = false,  // Visibilidad de embalses
  cuencasSpatialData = null, // Datos espaciales por cuenca [{dn, nombre, value, color, ...}]
  selectedEntity = null,  // Entidad seleccionada (cuenca o embalse) { layer, type, dn, area }
  onEntitySelect,         // Callback al seleccionar una entidad
}) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const markersRef = useRef([]);
  const gridLayerRef = useRef(null);
  const boundaryLayerRef = useRef(null); // Referencia al boundary GeoJSON
  const cuencasLayerRef = useRef(null);   // Capa de cuencas (R.)
  const embalsesLayerRef = useRef(null);  // Capa de embalses (E.)
  const onEntitySelectRef = useRef(onEntitySelect);
  const selectedEntityRef = useRef(selectedEntity);
  const gridCellsRef = useRef([]);
  const spatialLayerRef = useRef(null); // Capa para datos 2D
  const spatialCellsRef = useRef([]);
  const tileLayerRef = useRef(null);         // Referencia al tile layer para swap dark/light
  const canvasRendererRef = useRef(null);    // Renderer canvas compartido — 1 <canvas> en vez de miles de SVG
  const spatialTooltipRef = useRef(null);    // Tooltip compartido para celdas 2D
  const onSpatialCellClickRef = useRef(onSpatialCellClick);
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
  const [cuencasLoaded, setCuencasLoaded] = useState(false); // Flag para saber si las capas ya se cargaron

  useEffect(() => {
    onStationSelectRef.current = onStationSelect;
  }, [onStationSelect]);

  useEffect(() => {
    onSpatialCellClickRef.current = onSpatialCellClick;
  }, [onSpatialCellClick]);

  useEffect(() => {
    onEntitySelectRef.current = onEntitySelect;
  }, [onEntitySelect]);

  useEffect(() => {
    selectedEntityRef.current = selectedEntity;
  }, [selectedEntity]);

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

        // Coordenadas del cursor junto a la escala (abajo a la izquierda)
        const MousePosition = L.Control.extend({
          options: { position: 'bottomright' },
          onAdd() {
            const div = L.DomUtil.create('div', 'leaflet-control-mousepos');
            div.style.marginTop = '4px';

            // Estilo compatible con escala Leaflet
            div.style.background = 'rgba(255, 255, 255, 0.8)';
            div.style.color = '#333';
            div.style.font = '11px/1.1 "Helvetica Neue", Arial, Helvetica, sans-serif';

            // Caja completa (cerrada)
            div.style.border = '2px solid #777';
            div.style.padding = '2px 5px';
            div.style.minWidth = 'unset';
            div.style.width = 'auto';
            div.style.display = 'inline-block';

            div.textContent = 'Latitud: -- | Longitud: --';
            this._div = div;
            return div;
          },
          update(latlng) {
            if (!this._div) return;

            if (!latlng) {
              this._div.textContent = 'Latitud: -- | Longitud: --';
              return;
            }

            const lat = latlng.lat.toFixed(5);
            const lon = latlng.lng.toFixed(5);
            this._div.textContent = `Latitud: ${lat} | Longitud: ${lon}`;
          },
        });

        const mousePosControl = new MousePosition();
        mousePosControl.addTo(map);

        map.on('mousemove', (e) => {
          mousePosControl.update(e.latlng);
        });

        map.on('mouseout', () => {
          mousePosControl.update(null);
        });

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

        // Custom panes for cuencas/embalses — must be ABOVE overlayPane (400)
        // so their SVG polygons receive clicks before the grid canvas captures them.
        // z-index: tilePane=200, overlayPane=400 (grid canvas), cuencasPane=450, embalsesPane=460
        map.createPane('cuencasPane');
        map.getPane('cuencasPane').style.zIndex = 450;
        map.getPane('cuencasPane').style.display = 'none';

        map.createPane('embalsesPane');
        map.getPane('embalsesPane').style.zIndex = 460;
        map.getPane('embalsesPane').style.display = 'none';

        // Load cuencas & embalses from separate GeoJSON files
        Promise.all([
          fetch('/data/Cuencas.geojson?t=' + Date.now()).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
          fetch('/data/Embalses.geojson?t=' + Date.now()).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
        ])
          .then(([cuencasGeoData, embalsesGeoData]) => {
            const cuencasFeatures = cuencasGeoData.features;
            const embalsesFeatures = embalsesGeoData.features;

            // Cuencas layer — teal borders, low fill opacity
            const cuencasGeoJSON = cuencasGeoData;
            // Style helpers for cuencas/embalses
            const cuencaDefaultStyle = {
              color: '#0d9488',
              weight: 2,
              opacity: 0.8,
              fillColor: '#14b8a6',
              fillOpacity: 0.15,
            };
            const cuencaHoverStyle = {
              weight: 3,
              fillOpacity: 0.28,
            };
            const embalseDefaultStyle = {
              color: '#7c3aed',
              weight: 2,
              opacity: 0.8,
              fillColor: '#8b5cf6',
              fillOpacity: 0.18,
            };
            const embalseHoverStyle = {
              weight: 3,
              fillOpacity: 0.32,
            };
            const selectedStyleOverride = {
              weight: 4,
              opacity: 1,
              fillOpacity: 0.35,
              dashArray: '',
            };

            // Build entity click handler
            const makeEntityHandler = (feature, layer, type, defaultStyle, hoverStyle) => {
              const name = feature.properties.Nombre || feature.properties.layer || type;
              const dn = feature.properties.DN;
              const areaM2 = feature.properties['Area m2'];
              const areakm2 = areaM2 ? (areaM2 / 1e6).toFixed(1) : 'N/A';

              layer.bindTooltip(
                `<b>${type === 'cuenca' ? 'Cuenca' : 'Embalse'}: ${name}</b><br>Área: ${areakm2} km²<br>DN: ${dn}`,
                { sticky: true, direction: 'top', className: type === 'cuenca' ? 'cuenca-tooltip' : 'embalse-tooltip' }
              );

              // Store base styles on the layer so they can be updated later (e.g. cuencasSpatialData)
              layer._baseStyle = { ...defaultStyle };
              layer._hoverStyle = { ...hoverStyle };

              layer.on('mouseover', () => {
                const sel = selectedEntityRef.current;
                if (sel?.dn === dn && sel?.type === type) return;
                layer.setStyle(layer._hoverStyle || hoverStyle);
              });

              layer.on('mouseout', () => {
                const sel = selectedEntityRef.current;
                if (sel?.dn === dn && sel?.type === type) return;
                layer.setStyle(layer._baseStyle || defaultStyle);
              });

              layer.on('click', () => {
                onEntitySelectRef.current?.({
                  layer: name,
                  type,
                  dn,
                  area: areaM2,
                  areakm2,
                });
              });
            };

            // Sort features largest-area-first so smaller sub-cuencas (e.g. Chisaca inside
            // La Regadera) are rendered LAST (= on top) by Leaflet's painter algorithm,
            // making them visible and clickable even when overlapping a larger parent polygon.
            const cuencasSorted = {
              ...cuencasGeoJSON,
              features: [...cuencasGeoJSON.features].sort(
                (a, b) => (b.properties['Area m2'] || 0) - (a.properties['Area m2'] || 0)
              ),
            };
            const cuencasLayer = L.geoJSON(cuencasSorted, {
              pane: 'cuencasPane',
              style: () => ({ ...cuencaDefaultStyle }),
              onEachFeature: (feature, layer) => {
                makeEntityHandler(feature, layer, 'cuenca', cuencaDefaultStyle, cuencaHoverStyle);
              },
            });
            cuencasLayerRef.current = cuencasLayer;
            // Don't add to map yet — visibility controlled by showCuencas prop

            // Embalses layer — purple borders, low fill opacity
            const embalsesGeoJSON = embalsesGeoData;
            const embalsesLayer = L.geoJSON(embalsesGeoJSON, {
              pane: 'embalsesPane',
              style: () => ({ ...embalseDefaultStyle }),
              onEachFeature: (feature, layer) => {
                makeEntityHandler(feature, layer, 'embalse', embalseDefaultStyle, embalseHoverStyle);
              },
            });
            embalsesLayerRef.current = embalsesLayer;
            // Don't add to map yet — visibility controlled by showEmbalses prop
            setCuencasLoaded(true); // Trigger toggle effects
          })
          .catch(err => {
            console.error('❌ Error loading cuencas/embalses:', err);
          });

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
              <div class="station-popup-name">${station.name}</div>
              <div class="station-popup-code">${station.area}</div>
              <div class="station-popup-divider">
                <button onclick="window.__selectStation('${station.id}')" class="station-popup-btn">
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

        // Station popup CSS — light & dark mode
        if (!document.getElementById('leaflet-popup-theme-style')) {
          const style = document.createElement('style');
          style.id = 'leaflet-popup-theme-style';
          style.textContent = `
            .station-popup-name { font-weight: bold; color: #1f2937; margin-bottom: 4px; }
            .station-popup-code { color: #6b7280; font-size: 12px; }
            .station-popup-divider { margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb; }
            .station-popup-btn { background: #2563eb; color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; width: 100%; }
            .station-popup-btn:hover { background: #1d4ed8; }

            .dark .leaflet-popup-content-wrapper { background: #1f2937; color: #f9fafb; border: 1px solid #374151; box-shadow: 0 3px 14px rgba(0,0,0,0.6); }
            .dark .leaflet-popup-tip { background: #1f2937; }
            .dark .leaflet-popup-close-button { color: #9ca3af; }
            .dark .leaflet-popup-close-button:hover { color: #f9fafb; }
            .dark .station-popup-name { color: #f9fafb; !important; }
            .dark .station-popup-code { color: #9ca3af; !important }
            .dark .station-popup-divider { border-top-color: #374151; }

            .cuenca-tooltip, .embalse-tooltip {
              font-size: 12px;
              padding: 4px 8px;
              border-radius: 6px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            .cuenca-tooltip { border-left: 3px solid #0d9488; }
            .embalse-tooltip { border-left: 3px solid #7c3aed; }
          `;
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
          cuencasLayerRef.current?.remove();
          embalsesLayerRef.current?.remove();
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

  // Toggle cuencas layer visibility
  useEffect(() => {
    if (!mapRef.current || !cuencasLayerRef.current) return;
    const pane = mapRef.current.getPane('cuencasPane');
    if (showCuencas) {
      if (!mapRef.current.hasLayer(cuencasLayerRef.current)) {
        cuencasLayerRef.current.addTo(mapRef.current);
      }
      if (pane) pane.style.display = '';
    } else {
      if (mapRef.current.hasLayer(cuencasLayerRef.current)) {
        cuencasLayerRef.current.remove();
      }
      if (pane) pane.style.display = 'none';
    }
  }, [showCuencas, mapReady, cuencasLoaded]);

  // Toggle embalses layer visibility
  useEffect(() => {
    if (!mapRef.current || !embalsesLayerRef.current) return;
    const pane = mapRef.current.getPane('embalsesPane');
    if (showEmbalses) {
      if (!mapRef.current.hasLayer(embalsesLayerRef.current)) {
        embalsesLayerRef.current.addTo(mapRef.current);
      }
      if (pane) pane.style.display = '';
    } else {
      if (mapRef.current.hasLayer(embalsesLayerRef.current)) {
        embalsesLayerRef.current.remove();
      }
      if (pane) pane.style.display = 'none';
    }
  }, [showEmbalses, mapReady, cuencasLoaded]);

  // Apply cuencas spatial data coloring
  useEffect(() => {
    if (!cuencasLayerRef.current) return;

    if (cuencasSpatialData && cuencasSpatialData.length > 0) {
      // Build DN → data lookup
      const dnMap = {};
      for (const c of cuencasSpatialData) {
        dnMap[c.dn] = c;
      }
      cuencasLayerRef.current.eachLayer(layer => {
        const dn = layer.feature?.properties?.DN;
        const data = dnMap[dn];
        if (data && data.color) {
          const baseStyle = {
            fillColor: data.color,
            fillOpacity: 0.6,
            color: '#1f2937',
            weight: 2,
            opacity: 0.9,
          };
          const hoverStyle = {
            fillColor: data.color,
            fillOpacity: 0.78,
            color: '#111827',
            weight: 3,
            opacity: 1,
          };
          layer.setStyle(baseStyle);
          // Update stored styles so hover/mouseout use the data-driven colors
          layer._baseStyle = { ...baseStyle };
          layer._hoverStyle = { ...hoverStyle };
          // Update tooltip with value
          const name = layer.feature?.properties?.Nombre || data.nombre;
          const valStr = data.value != null ? data.value.toFixed(3) : 'N/A';
          const catStr = data.category ? ` | ${data.category}` : '';
          layer.unbindTooltip();
          layer.bindTooltip(`<b>Cuenca: ${name}</b><br/>Valor: ${valStr}${catStr}`, { sticky: true });
        } else {
          const noDataStyle = {
            fillColor: '#CCCCCC',
            fillOpacity: 0.3,
            color: '#6b7280',
            weight: 1,
            opacity: 0.6,
          };
          layer.setStyle(noDataStyle);
          layer._baseStyle = { ...noDataStyle };
          layer._hoverStyle = { ...noDataStyle, fillOpacity: 0.45, weight: 2 };
        }
      });
    } else {
      // Reset to default teal style
      const defaultTeal = {
        color: '#0d9488', weight: 2, opacity: 0.8, fillColor: '#14b8a6', fillOpacity: 0.15,
      };
      const hoverTeal = {
        weight: 3, fillOpacity: 0.28, color: '#0d9488', fillColor: '#14b8a6', opacity: 0.8,
      };
      cuencasLayerRef.current.eachLayer(layer => {
        layer.setStyle(defaultTeal);
        layer._baseStyle = { ...defaultTeal };
        layer._hoverStyle = { ...hoverTeal };
      });
    }
  }, [cuencasSpatialData, cuencasLoaded]);

  // Highlight selected entity (cuenca or embalse)
  useEffect(() => {
    // Reset embalses always
    if (embalsesLayerRef.current) {
      embalsesLayerRef.current.eachLayer(layer => {
        layer.setStyle(layer._baseStyle || {
          color: '#7c3aed', weight: 2, opacity: 0.8, fillColor: '#8b5cf6', fillOpacity: 0.18,
        });
      });
    }

    // Reset cuencas to their current base style (data-driven or default)
    if (cuencasLayerRef.current) {
      cuencasLayerRef.current.eachLayer(layer => {
        layer.setStyle(layer._baseStyle || {
          color: '#0d9488', weight: 2, opacity: 0.8, fillColor: '#14b8a6', fillOpacity: 0.15,
        });
      });
    }

    // Helper: re-establish area-based z-order — largest cuencas drawn first so
    // smaller sub-cuencas (e.g. Chisaca inside La Regadera) always end on top.
    const restoreCuencaZOrder = () => {
      if (!cuencasLayerRef.current) return;
      const arr = [];
      cuencasLayerRef.current.eachLayer(l => {
        arr.push({ l, area: l.feature?.properties?.['Area m2'] || 0 });
      });
      arr.sort((a, b) => b.area - a.area).forEach(({ l }) => l.bringToFront());
    };

    if (!selectedEntity) {
      // Deselected: restore z-order so Chisaca stays on top of La Regadera
      restoreCuencaZOrder();
      return;
    }

    // Highlight the selected entity
    const targetLayer = selectedEntity.type === 'cuenca'
      ? cuencasLayerRef.current
      : embalsesLayerRef.current;
    if (!targetLayer) return;

    targetLayer.eachLayer(layer => {
      const dn = layer.feature?.properties?.DN;
      if (dn === selectedEntity.dn) {
        layer.setStyle({
          weight: 4,
          opacity: 1,
          fillOpacity: cuencasSpatialData ? 0.75 : 0.35,
        });
        layer.bringToFront();
      }
    });

    // Re-apply area z-order so bringToFront on a large cuenca (e.g. La Regadera)
    // doesn't permanently hide a smaller overlapping one (e.g. Chisaca)
    if (selectedEntity.type === 'cuenca') restoreCuencaZOrder();
  }, [selectedEntity, cuencasLoaded]);

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
            // Restore original station-select click handler
            rect.off('click');
            rect.on('click', () => {
              onStationSelectRef.current?.(entry.station);
            });
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

            // Click on colored station to view 1D detail
            entry.marker.off('click'); // remove previous station-select handler
            entry.marker.on('click', () => {
              onSpatialCellClickRef.current?.(cell);
            });
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
          '<div style="font-size:12px;line-height:1.4">' +
          'Valor: <b>' + (!isNaN(cellValue) && cellValue !== null ? cellValue.toFixed(3) : 'N/A') + '</b><br/>' +
          (cell.category ? ('Categoría: ' + cell.category) : 'Categoría: N/A') +
          '<br/><span style="font-size:10px;color:#6b7280">Click para detalle 1D</span>' +
          '</div>'
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

        // Click to select this spatial cell for 1D detail
        rect.on('click', () => {
          onSpatialCellClickRef.current?.(cell);
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
