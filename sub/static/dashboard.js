// Configuration
const REFRESH_INTERVAL = 3000; // 3 seconds
const MADRID_TZ = 'Europe/Madrid';
let charts = {};
let selectedDevice = '';
let selectedTimeRange = 24;
let refreshTimer = null;
let lastSeenTimer = null;
let deviceStatusCache = {}; // Cache device status for client-side updates
let dht22Visible = false; // DHT22 data hidden by default

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard initializing...');
    
    // Load DHT22 visibility preference from localStorage
    // Default is hidden - only show if explicitly set to 'true'
    const savedVisibility = localStorage.getItem('dht22Visible');
    if (savedVisibility === 'true') {
        dht22Visible = true;
        document.body.classList.add('dht22-visible');
    } else {
        // Ensure hidden by default (remove class if present)
        dht22Visible = false;
        document.body.classList.remove('dht22-visible');
        // Clear any old 'true' value in localStorage
        if (savedVisibility !== null && savedVisibility !== 'false') {
            localStorage.setItem('dht22Visible', 'false');
        }
    }
    updateDht22ToggleButton();
    
    // Setup event listeners
    document.getElementById('device-filter').addEventListener('change', handleDeviceFilterChange);
    document.getElementById('time-range').addEventListener('change', handleTimeRangeChange);
    document.getElementById('refresh-btn').addEventListener('click', refreshAllData);
    document.getElementById('toggle-dht22-btn').addEventListener('click', toggleDht22Visibility);
    document.getElementById('query-preset').addEventListener('change', handleQueryPresetChange);
    document.getElementById('query-run-btn').addEventListener('click', runQuery);
    
    // Initial load
    refreshAllData();
    
    // Auto-refresh (only data, not rendering)
    startAutoRefresh();
    
    // Start client-side last seen timer
    startLastSeenTimer();
});

// Auto-refresh timer
function startAutoRefresh() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
    }
    refreshTimer = setInterval(() => {
        // Only refresh data, not full re-render
        updateDataInBackground();
    }, REFRESH_INTERVAL);
}

// Client-side last seen timer
function startLastSeenTimer() {
    if (lastSeenTimer) {
        clearInterval(lastSeenTimer);
    }
    lastSeenTimer = setInterval(updateLastSeenDisplay, 1000); // Update every second
}

// Update last seen display client-side
function updateLastSeenDisplay() {
    const now = Math.floor(Date.now() / 1000);
    Object.keys(deviceStatusCache).forEach(deviceId => {
        const device = deviceStatusCache[deviceId];
        const secondsAgo = now - device.last_seen;
        const element = document.querySelector(`[data-device-id="${deviceId}"] .last-seen-text`);
        if (element) {
            element.textContent = formatTimeSince(secondsAgo);
        }
    });
}

// Background data update without re-rendering everything
async function updateDataInBackground() {
    console.log('Updating data in background...');
    
    // Update health and stats silently
    await Promise.all([
        loadHealthStatus(),
        updateDeviceStatusData(),
        updateLatestDataTable(),
        updateChartsData(),
        loadStatistics()
    ]);
}

// Handle device filter change
function handleDeviceFilterChange(e) {
    selectedDevice = e.target.value;
    loadHistoricalData();
}

// Handle time range change
function handleTimeRangeChange(e) {
    selectedTimeRange = parseInt(e.target.value);
    loadHistoricalData();
}

// Toggle DHT22 data visibility
function toggleDht22Visibility() {
    dht22Visible = !dht22Visible;
    
    if (dht22Visible) {
        document.body.classList.add('dht22-visible');
    } else {
        document.body.classList.remove('dht22-visible');
    }
    
    // Save preference to localStorage
    localStorage.setItem('dht22Visible', dht22Visible.toString());
    
    updateDht22ToggleButton();
    console.log('DHT22 visibility toggled:', dht22Visible);
}

// Update toggle button text and icon
function updateDht22ToggleButton() {
    const btn = document.getElementById('toggle-dht22-btn');
    const icon = document.getElementById('dht22-toggle-icon');
    
    if (dht22Visible) {
        btn.innerHTML = 'Hide DHT22';
    } else {
        btn.innerHTML = 'Show DHT22';
    }
}

// Refresh all data (initial load and manual refresh)
async function refreshAllData() {
    console.log('Refreshing all data...');
    await Promise.all([
        loadHealthStatus(),
        loadDeviceStatus(),
        loadLatestData(),
        loadHistoricalData(),
        loadStatistics()
    ]);
}

// Update device status data without full re-render
async function updateDeviceStatusData() {
    try {
        const response = await fetch('/api/devices/status');
        const data = await response.json();
        
        // Update cache
        deviceStatusCache = {};
        data.devices.forEach(device => {
            deviceStatusCache[device.device_id] = device;
        });
        
        // Only update if structure changed (devices added/removed)
        const currentCards = document.querySelectorAll('.device-card');
        if (currentCards.length !== data.devices.length) {
            // Full re-render needed
            await loadDeviceStatus();
        } else {
            // Just update existing card data
            data.devices.forEach(device => {
                updateDeviceCard(device);
            });
        }
    } catch (error) {
        console.error('Error updating device status:', error);
    }
}

// Update individual device card without re-rendering
function updateDeviceCard(device) {
    const card = document.querySelector(`[data-device-id="${device.device_id}"]`);
    if (!card) return;
    
    // Update status class
    card.className = `device-card ${device.status}`;
    
    // Update status badge
    const badge = card.querySelector('.status-badge');
    if (badge) {
        badge.className = `status-badge ${device.status}`;
        badge.textContent = device.status;
    }
    
    // Update message count
    const msgCount = card.querySelector('.message-count');
    if (msgCount) {
        msgCount.textContent = device.message_count;
    }
    
    // Update firmware
    const firmware = card.querySelector('.firmware-version');
    if (firmware) {
        firmware.textContent = device.firmware_version || 'N/A';
    }
    
    // Update RSSI
    const rssi = card.querySelector('.rssi-value');
    if (rssi) {
        rssi.textContent = device.rssi || 'N/A';
    }
}

// Load health status
async function loadHealthStatus() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        
        const indicator = document.getElementById('health-indicator');
        const text = document.getElementById('health-text');
        
        if (data.status === 'healthy') {
            indicator.className = 'healthy';
            text.textContent = 'System Healthy';
        } else {
            indicator.className = 'unhealthy';
            text.textContent = 'System Issue';
        }
    } catch (error) {
        console.error('Error loading health status:', error);
        document.getElementById('health-indicator').className = 'unhealthy';
        document.getElementById('health-text').textContent = 'Connection Error';
    }
}

// Load device status (full render)
async function loadDeviceStatus() {
    try {
        const response = await fetch('/api/devices/status');
        const data = await response.json();
        
        const devicesGrid = document.getElementById('devices-grid');
        const deviceFilter = document.getElementById('device-filter');
        
        if (data.devices.length === 0) {
            devicesGrid.innerHTML = '<div class="empty-state"><p>No devices found</p><small>Waiting for ESP32 to send data...</small></div>';
            return;
        }
        
        // Update cache
        deviceStatusCache = {};
        data.devices.forEach(device => {
            deviceStatusCache[device.device_id] = device;
        });
        
        // Update device filter dropdown
        const currentSelection = deviceFilter.value;
        deviceFilter.innerHTML = '<option value="">All Devices</option>';
        data.devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.device_id;
            option.textContent = device.device_id;
            if (device.device_id === currentSelection) {
                option.selected = true;
            }
            deviceFilter.appendChild(option);
        });
        
        // Render device cards with data attributes for updates
        devicesGrid.innerHTML = data.devices.map(device => {
            const lastSeenText = formatTimeSince(device.last_seen_ago);
            
            return `
                <div class="device-card ${device.status}" data-device-id="${device.device_id}">
                    <div class="device-header">
                        <span class="device-id">${device.device_id}</span>
                        <span class="status-badge ${device.status}">${device.status}</span>
                    </div>
                    <div class="device-info">
                        <div><strong>Last Seen:</strong> <span class="last-seen-text">${lastSeenText}</span></div>
                        <div><strong>Connections:</strong> <span class="message-count">${device.message_count}</span> (last 5 min)</div>
                        <div><strong>RSSI:</strong> <span class="rssi-value">${device.rssi || 'N/A'}</span> dBm</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading device status:', error);
        document.getElementById('devices-grid').innerHTML = '<p class="loading">Error loading devices</p>';
    }
}

// Load latest data (full render)
async function loadLatestData() {
    try {
        const response = await fetch('/api/data/latest?limit=20');
        const data = await response.json();
        
        const container = document.getElementById('latest-data-table');
        
        if (data.data.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No data available</p></div>';
            return;
        }
        
        const html = `
            <div class="data-table">
                <table>
                    <thead>
                        <tr>
                            <th>Device</th>
                            <th>Time</th>
                            <th class="dht22-data">DHT22 Temp (°C)</th>
                            <th class="dht22-data">DHT22 RH (%)</th>
                            <th>BMP280 Temp (°C)</th>
                            <th>BMP280 Press (Pa)</th>
                            <th>Altitude (m)</th>
                            <th>Free Heap (%)</th>
                            <th>RSSI (dBm)</th>
                        </tr>
                    </thead>
                    <tbody id="latest-data-tbody">
                        ${data.data.map(row => {
                            const heapPercent = row.free_heap ? ((row.free_heap / 327680) * 100).toFixed(1) : null;
                            return `
                            <tr data-timestamp="${row.timestamp_server}">
                                <td>${row.device_id}</td>
                                <td>${formatTimestamp(row.timestamp_server)}</td>
                                <td class="dht22-data">${formatValue(row.dht22_temperature_c, 1)}</td>
                                <td class="dht22-data">${formatValue(row.dht22_humidity_percent, 1)}</td>
                                <td>${formatValue(row.bmp280_temperature_c, 1)}</td>
                                <td>${formatValue(row.bmp280_pressure_pa, 0)}</td>
                                <td>${formatValue(row.altitude_m, 1)}</td>
                                <td>${heapPercent ? heapPercent + '% (' + (row.free_heap / 1024).toFixed(0) + 'KB)' : 'N/A'}</td>
                                <td>${formatValue(row.rssi, 0)}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading latest data:', error);
        document.getElementById('latest-data-table').innerHTML = '<p class="loading">Error loading data</p>';
    }
}

// Update latest data table (only prepend new rows)
async function updateLatestDataTable() {
    try {
        const tbody = document.getElementById('latest-data-tbody');
        if (!tbody) {
            // Table doesn't exist yet, do full load
            await loadLatestData();
            return;
        }
        
        // Get the most recent timestamp in the table
        const firstRow = tbody.querySelector('tr');
        const latestTimestamp = firstRow ? parseInt(firstRow.dataset.timestamp) : 0;
        
        const response = await fetch('/api/data/latest?limit=5');
        const data = await response.json();
        
        // Filter only new data
        const newData = data.data.filter(row => row.timestamp_server > latestTimestamp);
        
        if (newData.length > 0) {
            // Prepend new rows
            const newRows = newData.map(row => {
                const heapPercent = row.free_heap ? ((row.free_heap / 327680) * 100).toFixed(1) : null;
                return `
                <tr data-timestamp="${row.timestamp_server}">
                    <td>${row.device_id}</td>
                    <td>${formatTimestamp(row.timestamp_server)}</td>
                    <td class="dht22-data">${formatValue(row.dht22_temperature_c, 1)}</td>
                    <td class="dht22-data">${formatValue(row.dht22_humidity_percent, 1)}</td>
                    <td>${formatValue(row.bmp280_temperature_c, 1)}</td>
                    <td>${formatValue(row.bmp280_pressure_pa, 0)}</td>
                    <td>${formatValue(row.altitude_m, 1)}</td>
                    <td>${heapPercent ? heapPercent + '% (' + (row.free_heap / 1024).toFixed(0) + 'KB)' : 'N/A'}</td>
                    <td>${formatValue(row.rssi, 0)}</td>
                </tr>`;
            }).join('');
            
            tbody.insertAdjacentHTML('afterbegin', newRows);
            
            // Keep only last 20 rows
            const allRows = tbody.querySelectorAll('tr');
            if (allRows.length > 20) {
                for (let i = 20; i < allRows.length; i++) {
                    allRows[i].remove();
                }
            }
        }
    } catch (error) {
        console.error('Error updating latest data:', error);
    }
}

// Load historical data and render charts (full render)
async function loadHistoricalData() {
    try {
        const params = new URLSearchParams({
            hours: selectedTimeRange,
            limit: 1000
        });
        
        if (selectedDevice) {
            params.append('device_id', selectedDevice);
        }
        
        const response = await fetch(`/api/data/history?${params}`);
        const data = await response.json();
        
        if (data.data.length === 0) {
            console.log('No historical data available');
            return;
        }
        
        // Group data by device
        const deviceData = {};
        data.data.forEach(row => {
            if (!deviceData[row.device_id]) {
                deviceData[row.device_id] = [];
            }
            deviceData[row.device_id].push(row);
        });
        
        // Prepare datasets for charts
        const datasets = Object.entries(deviceData).map(([deviceId, rows], index) => {
            const colors = [
                'rgb(255, 99, 132)',
                'rgb(54, 162, 235)',
                'rgb(255, 206, 86)',
                'rgb(75, 192, 192)',
                'rgb(153, 102, 255)',
                'rgb(255, 159, 64)'
            ];
            const color = colors[index % colors.length];
            
            // Sort by timestamp
            rows.sort((a, b) => a.timestamp_server - b.timestamp_server);
            
            return {
                deviceId,
                color,
                rows
            };
        });
        
        // Create/update charts
        renderChart('temp-chart-dht22', 'DHT22 Temperature (°C)', datasets, 'dht22_temperature_c');
        renderChart('temp-chart-bmp280', 'BMP280 Temperature (°C)', datasets, 'bmp280_temperature_c');
        renderChart('humidity-chart', 'Humidity (%)', datasets, 'dht22_humidity_percent');
        renderChart('pressure-chart', 'Pressure (Pa)', datasets, 'bmp280_pressure_pa');
        renderChart('altitude-chart', 'Altitude (m)', datasets, 'altitude_m');
        renderHeapChart('heap-chart', datasets);
        renderChart('rssi-chart', 'RSSI (dBm)', datasets, 'rssi');
        
        // Render pressure trend chart (calculated from pressure data)
        renderPressureTrendChart('pressure-trend-chart', datasets);
        
    } catch (error) {
        console.error('Error loading historical data:', error);
    }
}

// Update charts data incrementally
async function updateChartsData() {
    try {
        // Get latest data points
        const params = new URLSearchParams({
            hours: 1, // Just get last hour
            limit: 100
        });
        
        if (selectedDevice) {
            params.append('device_id', selectedDevice);
        }
        
        const response = await fetch(`/api/data/history?${params}`);
        const data = await response.json();
        
        if (data.data.length === 0) return;
        
        // Group by device
        const deviceData = {};
        data.data.forEach(row => {
            if (!deviceData[row.device_id]) {
                deviceData[row.device_id] = [];
            }
            deviceData[row.device_id].push(row);
        });
        
        // Update each chart
        Object.keys(charts).forEach(chartId => {
            const chart = charts[chartId];
            if (!chart) return;
            
            // Skip special charts that have custom rendering logic
            if (chartId === 'heap-chart' || chartId === 'pressure-trend-chart') return;
            
            const field = getFieldForChart(chartId);
            if (!field) return; // Skip if no field mapping exists
            
            // Update each dataset
            chart.data.datasets.forEach(dataset => {
                const deviceId = dataset.label;
                if (deviceData[deviceId]) {
                    const newRows = deviceData[deviceId];
                    
                    // Get existing timestamps
                    const existingTimestamps = new Set(dataset.data.map(d => d.x));
                    
                    // Collect all points (existing + new)
                    const allPoints = [...dataset.data];
                    
                    // Add new data points (with absolute filtering only for now)
                    newRows.forEach(row => {
                        const timestamp = row.timestamp_server * 1000;
                        const value = row[field];
                        if (!existingTimestamps.has(timestamp) && isValidDataPoint(field, value)) {
                            allPoints.push({
                                x: timestamp,
                                y: value
                            });
                        }
                    });
                    
                    // Sort by timestamp
                    allPoints.sort((a, b) => a.x - b.x);
                    
                    // Keep only data within time range
                    const cutoffTime = Date.now() - (selectedTimeRange * 3600 * 1000);
                    const recentPoints = allPoints.filter(d => d.x > cutoffTime);
                    
                    // Apply relative filtering to all points
                    dataset.data = filterOutliersByMovingAverage(recentPoints, field);
                }
            });
            
            // Update chart without animation
            chart.update('none');
        });
        
    } catch (error) {
        console.error('Error updating charts data:', error);
    }
}

// Helper function to get field name from chart ID
function getFieldForChart(chartId) {
    const fieldMap = {
        'temp-chart-dht22': 'dht22_temperature_c',
        'temp-chart-bmp280': 'bmp280_temperature_c',
        'humidity-chart': 'dht22_humidity_percent',
        'pressure-chart': 'bmp280_pressure_pa',
        'altitude-chart': 'altitude_m',
        'rssi-chart': 'rssi'
    };
    return fieldMap[chartId];
}

// Filter outliers based on field type (absolute limits)
function isValidDataPoint(field, value) {
    if (value === null || value === undefined) return false;
    
    // Define reasonable ranges for each sensor type
    const ranges = {
        'dht22_temperature_c': { min: -10, max: 50 },
        'bmp280_temperature_c': { min: -10, max: 50 },
        'dht22_humidity_percent': { min: 0, max: 100 },
        'bmp280_pressure_pa': { min: 80000, max: 110000 },
        'altitude_m': { min: -500, max: 5000 },
        'free_heap': { min: 0, max: 400000 },
        'rssi': { min: -100, max: 0 }
    };
    
    const range = ranges[field];
    if (!range) return true; // Unknown field, allow it
    
    return value >= range.min && value <= range.max;
}

// Filter outliers using moving average (relative deviation)
function filterOutliersByMovingAverage(dataPoints, field, windowSize = 5) {
    if (dataPoints.length === 0) return dataPoints;
    
    // Define maximum allowed deviation from moving average
    const deviationThresholds = {
        'dht22_temperature_c': 5,      // ±5°C from moving average
        'bmp280_temperature_c': 5,     // ±5°C from moving average
        'dht22_humidity_percent': 15,   // ±15% from moving average
        'bmp280_pressure_pa': 2000,    // ±2000 Pa from moving average
        'altitude_m': 200,              // ±200m from moving average
        'free_heap': 50000,             // ±50KB from moving average
        'rssi': 20                      // ±20 dBm from moving average
    };
    
    const maxDeviation = deviationThresholds[field];
    if (!maxDeviation) return dataPoints; // No threshold defined, allow all
    
    const filtered = [];
    
    for (let i = 0; i < dataPoints.length; i++) {
        const point = dataPoints[i];
        
        // First check absolute limits
        if (!isValidDataPoint(field, point.y)) {
            continue; // Skip this point
        }
        
        // For first few points, accept them (not enough history for moving average)
        if (i < windowSize) {
            filtered.push(point);
            continue;
        }
        
        // Calculate moving average from previous valid points
        const recentPoints = filtered.slice(-windowSize);
        const sum = recentPoints.reduce((acc, p) => acc + p.y, 0);
        const movingAvg = sum / recentPoints.length;
        
        // Check if current point deviates too much from moving average
        const deviation = Math.abs(point.y - movingAvg);
        
        if (deviation <= maxDeviation) {
            filtered.push(point);
        }
        // else: skip this point (it's an outlier)
    }
    
    return filtered;
}

// Render or update a chart
function renderChart(chartId, title, datasets, field) {
    const ctx = document.getElementById(chartId);
    if (!ctx) {
        console.error(`Canvas not found: ${chartId}`);
        return;
    }
    
    console.log(`Rendering ${chartId} for field ${field}, datasets: ${datasets.length}`);
    
    const chartDatasets = datasets.map(ds => {
        // First map all points
        const allPoints = ds.rows.map(row => ({
            x: row.timestamp_server * 1000,
            y: row[field]
        }));
        
        console.log(`  ${ds.deviceId}: ${allPoints.length} points, field values:`, allPoints.slice(0, 3).map(p => p.y));
        
        // Apply both absolute and relative filtering
        const filteredPoints = filterOutliersByMovingAverage(allPoints, field);
        
        console.log(`  ${ds.deviceId}: ${filteredPoints.length} after filtering`);
        
        return {
            label: ds.deviceId,
            data: filteredPoints,
            borderColor: ds.color,
            backgroundColor: ds.color.replace('rgb', 'rgba').replace(')', ', 0.1)'),
            tension: 0.4,
            fill: true,
            pointRadius: 2,
            pointHoverRadius: 4,
            spanGaps: true  // This interpolates across filtered points
        };
    });
    
    const config = {
        type: 'line',
        data: {
            datasets: chartDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#e0e0e0',
                        font: {
                            family: 'Courier New, monospace',
                            size: 11
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 14, 39, 0.9)',
                    titleColor: '#00ff41',
                    bodyColor: '#e0e0e0',
                    borderColor: '#00ff41',
                    borderWidth: 1,
                    callbacks: {
                        title: (items) => {
                            if (items.length > 0) {
                                const date = new Date(items[0].parsed.x);
                                return date.toLocaleString('es-ES', {
                                    timeZone: MADRID_TZ,
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: false
                                });
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: selectedTimeRange <= 6 ? 'minute' : selectedTimeRange <= 48 ? 'hour' : 'day',
                        displayFormats: {
                            minute: 'HH:mm',
                            hour: 'dd/MM HH:mm',
                            day: 'dd/MM'
                        },
                        tooltipFormat: 'dd/MM/yyyy HH:mm:ss'
                    },
                    adapters: {
                        date: {
                            zone: MADRID_TZ
                        }
                    },
                    title: {
                        display: false
                    },
                    ticks: {
                        color: '#8892b0',
                        font: {
                            family: 'Courier New, monospace',
                            size: 10
                        }
                    },
                    grid: {
                        color: '#1e2a4a'
                    }
                },
                y: {
                    title: {
                        display: false
                    },
                    ticks: {
                        color: '#8892b0',
                        font: {
                            family: 'Courier New, monospace',
                            size: 10
                        }
                    },
                    grid: {
                        color: '#1e2a4a'
                    }
                }
            }
        }
    };
    
    // Destroy existing chart if it exists
    if (charts[chartId]) {
        charts[chartId].destroy();
    }
    
    // Create new chart
    charts[chartId] = new Chart(ctx, config);
}

// Render pressure trend chart (calculates rate of change)
function renderPressureTrendChart(chartId, datasets) {
    const ctx = document.getElementById(chartId);
    if (!ctx) return;
    
    // Calculate pressure trends for each device
    const chartDatasets = datasets.map(({deviceId, color, rows}) => {
        const trendData = [];
        
        // Calculate trend using variable time windows (prefer 1 hour, accept 15min-2hour)
        for (let i = 0; i < rows.length; i++) {
            const currentRow = rows[i];
            const currentTime = currentRow.timestamp_server;
            const currentPressure = currentRow.bmp280_pressure_pa;
            
            if (!isValidDataPoint('bmp280_pressure_pa', currentPressure)) continue;
            
            // Find best historical data point (prefer ~1 hour, accept 15min - 2 hours)
            let pastRow = null;
            let bestTimeDiff = Infinity;
            
            for (let j = i - 1; j >= 0; j--) {
                const timeDiff = currentTime - rows[j].timestamp_server;
                
                // Only consider data between 15 minutes and 2 hours ago
                if (timeDiff >= 900 && timeDiff <= 7200) {
                    // Prefer data closest to 1 hour (3600 seconds)
                    const diffFrom1Hour = Math.abs(timeDiff - 3600);
                    if (diffFrom1Hour < bestTimeDiff) {
                        bestTimeDiff = diffFrom1Hour;
                        pastRow = rows[j];
                    }
                }
            }
            
            if (pastRow && isValidDataPoint('bmp280_pressure_pa', pastRow.bmp280_pressure_pa)) {
                const timeDiffHours = (currentTime - pastRow.timestamp_server) / 3600;
                const pressureDiff = currentPressure - pastRow.bmp280_pressure_pa;
                const trend = pressureDiff / timeDiffHours; // Pa/hour
                
                trendData.push({
                    x: currentTime * 1000,
                    y: trend
                });
            }
        }
        
        return {
            label: deviceId,
            data: trendData,
            borderColor: color,
            backgroundColor: color + '33',
            borderWidth: 2,
            pointRadius: 1,
            tension: 0.1
        };
    });
    
    const config = {
        type: 'line',
        data: { datasets: chartDatasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#e0e0e0',
                        font: { family: 'Courier New, monospace', size: 11 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 14, 39, 0.9)',
                    titleColor: '#00ff41',
                    bodyColor: '#e0e0e0',
                    borderColor: '#00ff41',
                    borderWidth: 1,
                    callbacks: {
                        title: (items) => {
                            if (items.length > 0) {
                                const date = new Date(items[0].parsed.x);
                                return date.toLocaleString('es-ES', {
                                    timeZone: MADRID_TZ,
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: false
                                });
                            }
                            return '';
                        },
                        label: (context) => {
                            const trend = context.parsed.y;
                            const direction = trend > 0 ? '↑ Rising' : trend < 0 ? '↓ Falling' : '→ Stable';
                            return `${context.dataset.label}: ${trend.toFixed(1)} Pa/h ${direction}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        displayFormats: { hour: 'HH:mm', minute: 'HH:mm' },
                        tooltipFormat: 'PPpp'
                    },
                    ticks: {
                        color: '#8892b0',
                        font: { family: 'Courier New, monospace', size: 10 }
                    },
                    grid: { color: '#1e2a4a' }
                },
                y: {
                    title: { display: false },
                    ticks: {
                        color: '#8892b0',
                        font: { family: 'Courier New, monospace', size: 10 },
                        callback: function(value) {
                            return value.toFixed(1) + ' Pa/h';
                        }
                    },
                    grid: { color: '#1e2a4a' }
                }
            }
        }
    };
    
    if (charts[chartId]) {
        charts[chartId].destroy();
    }
    charts[chartId] = new Chart(ctx, config);
}

// Render heap memory chart as percentage
function renderHeapChart(chartId, datasets) {
    const ctx = document.getElementById(chartId);
    if (!ctx) return;
    
    // Convert heap bytes to percentage (ESP32 total heap ~320KB = 327680 bytes)
    const ESP32_TOTAL_HEAP = 327680;
    
    const chartDatasets = datasets.map(({deviceId, color, rows}) => {
        const heapData = rows
            .filter(row => isValidDataPoint('free_heap', row.free_heap))
            .map(row => ({
                x: row.timestamp_server * 1000,
                y: (row.free_heap / ESP32_TOTAL_HEAP) * 100  // Convert to percentage
            }));
        
        return {
            label: deviceId,
            data: heapData,
            borderColor: color,
            backgroundColor: color + '33',
            borderWidth: 2,
            pointRadius: 1,
            tension: 0.1,
            fill: true
        };
    });
    
    const config = {
        type: 'line',
        data: { datasets: chartDatasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#e0e0e0',
                        font: { family: 'Courier New, monospace', size: 11 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 14, 39, 0.9)',
                    titleColor: '#00ff41',
                    bodyColor: '#e0e0e0',
                    borderColor: '#00ff41',
                    borderWidth: 1,
                    callbacks: {
                        title: (items) => {
                            if (items.length > 0) {
                                const date = new Date(items[0].parsed.x);
                                return date.toLocaleString('es-ES', {
                                    timeZone: MADRID_TZ,
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: false
                                });
                            }
                            return '';
                        },
                        label: (context) => {
                            const percent = context.parsed.y;
                            const bytes = (percent / 100) * ESP32_TOTAL_HEAP;
                            return `${context.dataset.label}: ${percent.toFixed(1)}% (${(bytes/1024).toFixed(0)}KB free)`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        displayFormats: { hour: 'HH:mm', minute: 'HH:mm' },
                        tooltipFormat: 'PPpp'
                    },
                    ticks: {
                        color: '#8892b0',
                        font: { family: 'Courier New, monospace', size: 10 }
                    },
                    grid: { color: '#1e2a4a' }
                },
                y: {
                    title: { display: false },
                    min: 0,
                    max: 100,
                    ticks: {
                        color: '#8892b0',
                        font: { family: 'Courier New, monospace', size: 10 },
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    grid: { color: '#1e2a4a' }
                }
            }
        }
    };
    
    if (charts[chartId]) {
        charts[chartId].destroy();
    }
    charts[chartId] = new Chart(ctx, config);
}

// Load statistics (full render)
async function loadStatistics() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        const statsGrid = document.getElementById('stats-grid');
        
        // Check if cards already exist
        const existingCards = statsGrid.querySelectorAll('.stat-card');
        
        if (existingCards.length === 0) {
            // First load - create the cards
            const html = `
                <div class="stat-card" data-stat="total-measurements">
                    <div class="stat-value">${data.overall.total_measurements.toLocaleString()}</div>
                    <div class="stat-label">Total Measurements</div>
                </div>
                <div class="stat-card" data-stat="total-devices">
                    <div class="stat-value">${data.overall.total_devices}</div>
                    <div class="stat-label">Total Devices</div>
                </div>
                <div class="stat-card" data-stat="first-measurement">
                    <div class="stat-value">${formatTimestamp(data.overall.first_measurement)}</div>
                    <div class="stat-label">First Measurement</div>
                </div>
                <div class="stat-card" data-stat="last-measurement">
                    <div class="stat-value">${formatTimestamp(data.overall.last_measurement)}</div>
                    <div class="stat-label">Last Measurement</div>
                </div>
            `;
            statsGrid.innerHTML = html;
        } else {
            // Update existing values
            updateStatValue('total-measurements', data.overall.total_measurements.toLocaleString());
            updateStatValue('total-devices', data.overall.total_devices);
            updateStatValue('first-measurement', formatTimestamp(data.overall.first_measurement));
            updateStatValue('last-measurement', formatTimestamp(data.overall.last_measurement));
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
        document.getElementById('stats-grid').innerHTML = '<p class="loading">Error loading statistics</p>';
    }
}

// Update individual stat card value
function updateStatValue(statName, value) {
    const card = document.querySelector(`[data-stat="${statName}"] .stat-value`);
    if (card) {
        card.textContent = value;
    }
}

// Utility functions
function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('es-ES', { 
        timeZone: MADRID_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).replace(/(\d+)\/(\d+)\/(\d+),\s(\d+:\d+:\d+)/, '$3-$2-$1T$4');
}

function formatTimeSince(seconds) {
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

function formatValue(value, decimals = 2) {
    if (value === null || value === undefined) return 'N/A';
    return Number(value).toFixed(decimals);
}

// Query Section Functions
function handleQueryPresetChange(e) {
    document.getElementById('query-input').value = e.target.value;
}

async function runQuery() {
    const query = document.getElementById('query-input').value.trim();
    if (!query) {
        alert('Please enter a SQL query');
        return;
    }
    
    try {
        const response = await fetch('/api/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query })
        });
        
        const data = await response.json();
        const resultsDiv = document.getElementById('query-results');
        
        if (!response.ok) {
            resultsDiv.innerHTML = `<div class="query-error">Error: ${data.detail || 'Query failed'}</div>`;
            return;
        }
        
        if (!data.results || data.results.length === 0) {
            resultsDiv.innerHTML = '<p class="empty-state">No results returned</p>';
            return;
        }
        
        // Build table
        const columns = Object.keys(data.results[0]);
        let html = '<table><thead><tr>';
        columns.forEach(col => {
            html += `<th>${col}</th>`;
        });
        html += '</tr></thead><tbody>';
        
        data.results.forEach(row => {
            html += '<tr>';
            columns.forEach(col => {
                html += `<td>${row[col] !== null ? row[col] : 'NULL'}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        
        resultsDiv.innerHTML = html;
    } catch (error) {
        console.error('Error running query:', error);
        document.getElementById('query-results').innerHTML = 
            `<div class="query-error">Error: ${error.message}</div>`;
    }
}
