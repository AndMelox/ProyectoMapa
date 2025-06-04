let markers = {};
let map = L.map('map').setView([5.5439915, -73.3597110], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

let nodes = [
    { id: 1, lat: 5.5439915, lng: -73.3597110, name: "Clínica Los Andes", fixed: true },
    { id: 2, lat: 5.5404943, lng: -73.3612242, name: "Hospital San Rafael", fixed: true },
    { id: 3, lat: 5.536562, lng: -73.363540, name: "ESE SANTIAGO DE TUNJA", fixed: true },
    { id: 4, lat: 5.5348351, lng: -73.3601600, name: "Centro de especialidades médicas", fixed: true },
    { id: 5, lat: 5.5531544, lng: -73.3514213, name: "Clínica Chía nueva eps", fixed: true },
    { id: 6, lat: 5.5547927, lng: -73.3506117, name: "Clínica Asorsalud SM", fixed: true },
    { id: 7, lat: 5.552599, lng: -73.346360, name: "Clínica Cancerológica de Boyacá", fixed: true },
    { id: 8, lat: 5.5568944, lng: -73.3504343, name: "Salud Coop ISP Norte", fixed: true },
    { id: 9, lat: 5.569618, lng: -73.336905, name: "Clínica Mediláser", fixed: true },
    { id: 10, lat: 5.519279, lng: -73.358486, name: "ESE SANTIAGO DE TUNJA", fixed: true }
];

// Agrega marcadores iniciales
nodes.forEach(node => {
    markers[node.id] = L.marker([node.lat, node.lng]).addTo(map).bindPopup(node.name);
});

// Sidebar dinámico para hospitales fijos
window.onload = function() {
    nodes.forEach(node => {
        if (node.fixed) {
            const btn = document.getElementById(`btn-${node.id}`);
            if (btn) {
                btn.onclick = function() { toggleNode(node.id); };
            }
        }
    });
};

function removeNode(nodeId) {
    const node = nodes.find(n => n.id === nodeId);
    if (node && node.fixed) {
        // Solo oculta el hospital fijo (no lo elimina del array)
        if (markers[nodeId]) {
            map.removeLayer(markers[nodeId]);
            delete markers[nodeId];
        }
        document.getElementById(`btn-${nodeId}`).style.backgroundColor = 'red';
        document.getElementById(`btn-${nodeId}`).style.color = 'white';
    } else {
        // Elimina hospital agregado por usuario
        nodes = nodes.filter(n => n.id !== nodeId);
        if (markers[nodeId]) {
            map.removeLayer(markers[nodeId]);
            delete markers[nodeId];
        }
        const btn = document.getElementById(`btn-${nodeId}`);
        if (btn) btn.remove();
    }
    // Recalcula la ruta si hay accidente
    if (accidentMarker) {
        removeAccident();
        onMapRightClick({ latlng: accidentMarker.getLatLng() });
    }
}

function addNode(nodeId) {
    const node = nodes.find(n => n.id === nodeId);
    if (node && node.fixed && !markers[nodeId]) {
        // Solo reactiva hospitales fijos
        let marker = L.marker([node.lat, node.lng]).addTo(map).bindPopup(node.name);
        markers[nodeId] = marker;
        document.getElementById(`btn-${nodeId}`).style.backgroundColor = '#007bff';
        document.getElementById(`btn-${nodeId}`).style.color = 'white';
        // Recalcula la ruta si hay accidente
        if (accidentMarker) {
            removeAccident();
            onMapRightClick({ latlng: accidentMarker.getLatLng() });
        }
    }
}

function toggleNode(nodeId) {
    const node = nodes.find(n => n.id === nodeId);
    if (node && node.fixed) {
        // Solo alterna hospitales fijos
        if (markers[nodeId]) {
            removeNode(nodeId);
        } else {
            addNode(nodeId);
        }
    }
    // Los hospitales agregados solo pueden eliminarse, así que el botón será de eliminar
}

function getNodeById(nodeId) {
    return nodes.find(n => n.id === nodeId);
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2));
}

function dijkstra(startNode, nodes, edges) {
    let distances = {};
    let prev = {};
    let pq = new PriorityQueue();

    nodes.forEach(node => {
        distances[node.id] = Infinity;
        prev[node.id] = null;
    });
    distances[startNode.id] = 0;
    pq.enqueue(startNode.id, 0);

    while (!pq.isEmpty()) {
        let minNode = pq.dequeue().element;
        let currentEdges = edges.filter(edge => edge.from === minNode);

        currentEdges.forEach(edge => {
            let alt = distances[minNode] + edge.weight;
            if (alt < distances[edge.to]) {
                distances[edge.to] = alt;
                prev[edge.to] = minNode;
                pq.enqueue(edge.to, alt);
            }
        });
    }

    return { distances, prev };
}

function findClosestNode(startNode, nodes, edges) {
    let { distances, prev } = dijkstra(startNode, nodes, edges);
    let closestNode = null;
    let minDistance = Infinity;

    for (let nodeId in distances) {
        if (nodeId != startNode.id && distances[nodeId] < minDistance) {
            minDistance = distances[nodeId];
            closestNode = nodeId;
        }
    }

    let path = [];
    let currentNode = closestNode;
    while (currentNode) {
        path.unshift(currentNode);
        currentNode = prev[currentNode];
    }

    return { path, closestNode, distance: minDistance };
}

class PriorityQueue {
    constructor() {
        this.collection = [];
    }

    enqueue(element, priority) {
        let newNode = { element, priority };
        if (this.isEmpty()) {
            this.collection.push(newNode);
        } else {
            let added = false;
            for (let i = 0; i < this.collection.length; i++) {
                if (newNode.priority < this.collection[i].priority) {
                    this.collection.splice(i, 0, newNode);
                    added = true;
                    break;
                }
            }
            if (!added) {
                this.collection.push(newNode);
            }
        }
    }

    dequeue() {
        return this.collection.shift();
    }

    isEmpty() {
        return this.collection.length === 0;
    }
}

let accidentMarker = null;
let routingControlToAccident = null;
let routingControlFromAccident = null;

map.on('contextmenu', onMapRightClick);

function onMapRightClick(e) {
    if (accidentMarker) {
        alert("Ya existe un accidente en el mapa. Por favor, elimínelo antes de agregar otro.");
        return;
    }

    let accidentNode = { id: 'accident', lat: e.latlng.lat, lng: e.latlng.lng, name: "Accidente" };
    accidentMarker = L.marker([accidentNode.lat, accidentNode.lng]).addTo(map)
        .bindPopup(accidentNode.name + '<br><button onclick="removeAccident()">Eliminar</button>')
        .openPopup();

    accidentMarker.on('popupopen', function () {
        this.setPopupContent(accidentNode.name + '<br><button onclick="removeAccident()">Eliminar</button>');
    });

    let edges = [];

    nodes.forEach(node => {
        let weight = calculateDistance(accidentNode.lat, accidentNode.lng, node.lat, node.lng);
        edges.push({ from: accidentNode.id, to: node.id, weight: weight });
        edges.push({ from: node.id, to: accidentNode.id, weight: weight });
    });

    nodes.forEach((node, i) => {
        for (let j = i + 1; j < nodes.length; j++) {
            let weight = calculateDistance(node.lat, node.lng, nodes[j].lat, nodes[j].lng);
            edges.push({ from: node.id, to: nodes[j].id, weight: weight });
            edges.push({ from: nodes[j].id, to: node.id, weight: weight });
        }
    });

    let result = findClosestNode(accidentNode, nodes.concat(accidentNode), edges);
    let closestNode = nodes.find(node => node.id == result.closestNode);

    let waypointsToAccident = [
        L.latLng(closestNode.lat, closestNode.lng),
        L.latLng(accidentNode.lat, accidentNode.lng)
    ];

    routingControlToAccident = L.Routing.control({
        waypoints: waypointsToAccident,
        router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1'
        }),
        lineOptions: {
            styles: [{ color: 'blue', weight: 4 }]
        },
        createMarker: function (i, waypoint, n) {
            if (i === 0) {
                return L.marker(waypoint.latLng).bindPopup(closestNode.name);
            }
            return L.marker(waypoint.latLng).bindPopup(accidentNode.name);
        },
        
    }).addTo(map);

    let waypointsFromAccident = result.path.map(nodeId => {
        if (nodeId === 'accident') {
            return L.latLng(accidentNode.lat, accidentNode.lng);
        }
        let node = nodes.find(n => n.id == nodeId);
        return L.latLng(node.lat, node.lng);
    });

    routingControlFromAccident = L.Routing.control({
        waypoints: waypointsFromAccident,
        router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1'
        }),
        lineOptions: {
            styles: [{ color: 'red', weight: 4 }]
        },
        createMarker: function (i, waypoint, n) {
            if (i === 0) {
                return L.marker(waypoint.latLng).bindPopup(`
                    <div>
                        <p>${accidentNode.name}</p>
                        <button onclick="removeAccident()">Eliminar</button>
                    </div>
                `);
            }
            return L.marker(waypoint.latLng).bindPopup(nodes.find(node => node.lat == waypoint.latLng.lat && node.lng == waypoint.latLng.lng).name);
        },
        
    }).addTo(map);
}

function removeAccident() {
    if (accidentMarker) {
        map.removeLayer(accidentMarker);
        accidentMarker = null;
    }
    if (routingControlToAccident) {
        map.removeControl(routingControlToAccident);
        routingControlToAccident = null;
    }
    if (routingControlFromAccident) {
        map.removeControl(routingControlFromAccident);
        routingControlFromAccident = null;
    }
}

let addingHospital = false;

document.getElementById('addHospitalBtn').onclick = function() {
    addingHospital = true;
    this.innerText = "Haz clic en el mapa...";
    this.disabled = true;
    this.style.background = "#ffc107";
};

map.on('click', function(e) {
    if (addingHospital) {
        let name = prompt("Nombre del nuevo centro de salud:");
        if (!name) {
            alert("Nombre inválido.");
            resetAddHospitalBtn();
            return;
        }
        const newId = Math.max(...nodes.map(n => n.id)) + 1;
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        const newNode = { id: newId, lat, lng, name, fixed: false };
        nodes.push(newNode);

        let marker = L.marker([lat, lng]).addTo(map).bindPopup(name);
        markers[newId] = marker;

        // Botón solo para eliminar
        const btn = document.createElement('button');
        btn.className = 'sidebar-button';
        btn.id = `btn-${newId}`;
        btn.innerText = name + " (Eliminar)";
        btn.onclick = function() { removeNode(newId); };
        document.getElementById('sidebar').appendChild(btn);

        resetAddHospitalBtn();
    }
});

function resetAddHospitalBtn() {
    addingHospital = false;
    const btn = document.getElementById('addHospitalBtn');
    btn.innerText = "Agregar Centro de Salud";
    btn.disabled = false;
    btn.style.background = "#28a745";
}