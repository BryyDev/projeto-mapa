// 1. INICIALIZA O MAPA
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://api.maptiler.com/maps/streets-v2-dark/style.json?key=1210fmf60PURWzVOx1Ow',
  center: [-46.636, -23.593], 
  zoom: 15.5, 
  pitch: 60, 
  bearing: -20
});

map.dragRotate.enable(); 
map.touchZoomRotate.enableRotation();

let currentMode = 'none'; 
let markersList = []; 
let areaPoints = []; 
let vertexMarkers = []; 

// UI ELEMENTS
const navMap = document.getElementById('nav-map');
const navNews = document.getElementById('nav-news');
const newsPanel = document.getElementById('news-panel');
const actionBar = document.getElementById('action-bar');
const actionText = document.getElementById('action-text');
const btnConfirm = document.getElementById('btn-confirm-action');
const btnCancel = document.getElementById('btn-cancel-action');
const crosshair = document.getElementById('crosshair');
const floatingCard = document.getElementById('news-card-floating');

// NAVEGAÇÃO
navNews.addEventListener('click', () => {
  newsPanel.classList.add('open');
  navNews.classList.add('active');
  navMap.classList.remove('active');
  floatingCard.classList.remove('show'); 
  resetMode();
});

navMap.addEventListener('click', () => {
  newsPanel.classList.remove('open');
  navMap.classList.add('active');
  navNews.classList.remove('active');
  floatingCard.classList.add('show'); 
  resetMode();
});

// 2. CONFIGURAÇÃO DO MAPA E DOS PRÉDIOS 3D
map.on('load', () => {
  // Força a cor dos prédios 3D 
  const layers = map.getStyle().layers;
  layers.forEach(layer => {
    if (layer.id.includes('building') && layer.type === 'fill-extrusion') {
      map.setPaintProperty(layer.id, 'fill-extrusion-color', '#1a1e23');
      map.setPaintProperty(layer.id, 'fill-extrusion-opacity', 0.9);
      map.setPaintProperty(layer.id, 'fill-extrusion-height', ['get', 'render_height']); 
    }
  });

  // Cria a fonte de dados para a área de risco
  map.addSource('area-source', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });
  
  map.addLayer({
    id: 'area-fill', type: 'fill', source: 'area-source',
    paint: { 'fill-color': '#ff4d4d', 'fill-opacity': 0.3 }
  });

  map.addLayer({
    id: 'area-outline', type: 'line', source: 'area-source',
    paint: { 'line-color': '#ff4d4d', 'line-width': 2 }
  });

  // Clique no mapa
  map.on('click', (e) => {
    if (currentMode === 'draw-area') {
      addAreaPoint(e.lngLat);
    } else if (currentMode === 'none') {
      const features = map.queryRenderedFeatures(e.point, { layers: ['area-fill'] });
      if (features.length > 0) {
        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`<span class="popup-title">Área de Risco</span>
                    <button class="popup-delete-btn" onclick="removerArea()"><i class="ph ph-trash"></i> Remover Área</button>`)
          .addTo(map);
      }
    }
  });
});

// 3. LÓGICA DA ÁREA EDITÁVEL
function addAreaPoint(lngLat) {
  areaPoints.push([lngLat.lng, lngLat.lat]);
  updatePolygonSource();

  const el = document.createElement('div');
  el.className = 'vertex-marker';
  
  const marker = new maplibregl.Marker({ element: el, draggable: true })
    .setLngLat(lngLat)
    .addTo(map);

  marker.on('drag', () => {
    const newLngLat = marker.getLngLat();
    const index = vertexMarkers.findIndex(m => m.marker === marker);
    if (index > -1) {
      areaPoints[index] = [newLngLat.lng, newLngLat.lat];
      updatePolygonSource();
    }
  });

  vertexMarkers.push({ marker: marker });
  btnConfirm.style.display = 'flex';
}

function updatePolygonSource() {
  if (areaPoints.length >= 2) {
    const coords = [...areaPoints];
    if (areaPoints.length >= 3 && currentMode !== 'draw-area') {
        coords.push(areaPoints[0]); 
    }
    const geojson = {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coords] }
    };
    map.getSource('area-source').setData(geojson);
  }
}

function clearArea() {
  areaPoints = [];
  vertexMarkers.forEach(v => v.marker.remove());
  vertexMarkers = [];
  map.getSource('area-source').setData({ type: 'FeatureCollection', features: [] });
}

// 4. CONTROLE DE MODOS
document.getElementById('btn-mode-pin').addEventListener('click', () => {
  if (!document.getElementById('alert-title').value) {
    alert("Digite um título primeiro!");
    return;
  }
  currentMode = 'add-pin';
  newsPanel.classList.remove('open');
  actionBar.classList.add('show');
  actionText.innerText = "Mova o mapa até o local e clique em Fixar.";
  crosshair.classList.add('show');
  btnConfirm.style.display = 'flex';
  btnConfirm.innerText = "Fixar Ponto";
});

document.getElementById('btn-mode-area').addEventListener('click', () => {
  currentMode = 'draw-area';
  newsPanel.classList.remove('open');
  actionBar.classList.add('show');
  actionText.innerText = "Toque no mapa para criar os pontos. Arraste os pontos brancos para editar.";
  crosshair.classList.remove('show');
  btnConfirm.style.display = 'none';
  clearArea();
});

btnCancel.addEventListener('click', resetMode);

btnConfirm.addEventListener('click', () => {
  if (currentMode === 'add-pin') {
    const center = map.getCenter();
    criarPontoNoMapa(center);
  } else if (currentMode === 'draw-area') {
    if (areaPoints.length >= 3) {
      currentMode = 'edit-area';
      updatePolygonSource(); 
      actionText.innerText = "Área criada! Arraste os pontos para editar ou clique em Finalizar.";
      btnConfirm.innerText = "Finalizar Edição";
      btnConfirm.style.display = 'flex';
      btnCancel.style.display = 'none'; 
    } else {
      alert("Você precisa de pelo menos 3 pontos.");
    }
    return; 
  } else if (currentMode === 'edit-area') {
    alert("Área salva com sucesso!");
  }
  resetMode();
});

function resetMode() {
  currentMode = 'none';
  actionBar.classList.remove('show');
  crosshair.classList.remove('show');
  btnConfirm.style.display = 'none';
  btnCancel.style.display = 'flex'; 
  clearArea();
}

// 5. CRIAR PINO
function criarPontoNoMapa(lngLat) {
  const titulo = document.getElementById('alert-title').value;
  const el = document.createElement('div');
  el.className = 'alert-pin';
  el.innerHTML = '<i class="ph-fill ph-warning"></i>';

  const popupId = 'popup-' + Date.now();
  const popupHTML = `
    <span class="popup-title">${titulo}</span>
    <button class="popup-delete-btn" onclick="removerPonto('${popupId}')">
      <i class="ph ph-trash"></i> Remover Aviso
    </button>
  `;
  
  const popup = new maplibregl.Popup({ offset: 25 }).setHTML(popupHTML);
  const marker = new maplibregl.Marker({ element: el })
    .setLngLat(lngLat)
    .setPopup(popup)
    .addTo(map);

  markersList.push({ id: popupId, marker: marker });
  document.getElementById('alert-title').value = '';
}

window.removerPonto = function(id) {
  const index = markersList.findIndex(m => m.id === id);
  if (index > -1) {
    markersList[index].marker.remove(); 
    markersList.splice(index, 1); 
  }
};

window.removerArea = function() {
  clearArea();
  const popups = document.getElementsByClassName('maplibregl-popup');
  for(let i = 0; i < popups.length; i++) { popups[i].remove(); }
};

// ZOOM
document.getElementById('btn-zoom-in').addEventListener('click', () => map.zoomIn());
document.getElementById('btn-zoom-out').addEventListener('click', () => map.zoomOut());