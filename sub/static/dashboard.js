// Configuration
const REFRESH_INTERVAL = 10000; // 10 seconds
const MADRID_TZ = 'Europe/Madrid';
let charts = {};
let selectedDevice = '';
let selectedTimeRange = 24;
let refreshTimer = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard initializing...');
    
    // Setup event listeners
    document.getElementById('device-filter').addEventListener('change', handleDeviceFilterChange);
    document.getElementById('time-range').addEventListener('change', handleTimeRangeChange);
    document.getElementById('refresh-btn').addEventListener('click', refreshAllData);
    document.getElementById('query-preset').addEventListener('change', handleQueryPresetChange);
    document.getElementById('query-run-btn').addEventListener('click', runQuery);
    
    // Initial load
    refreshAllData();
    
    // Auto-refresh
    startAutoRefresh();
});

// Auto-refresh timer
function startAutoRefresh() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
    }
    refreshTimer = setInterval(refreshAllData, REFRESH_INTERVAL);
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

// Refresh all data
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

// Load device status
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
        
        // Render device cards
        devicesGrid.innerHTML = data.devices.map(device => {
            const lastSeenText = formatTimeSince(device.last_seen_ago);
            
            return `
                <div class="device-card ${device.status}">
                    <div class="device-header">
                        <span class="device-id">${device.device_id}</span>
                        <span class="status-badge ${device.status}">${device.status}</span>
                    </div>
                    <div class="device-info">
                        <div><strong>Last Seen:</strong> ${lastSeenText}</div>
                        <div><strong>Messages:</strong> ${device.message_count} (last 5 min)</div>
                        <div><strong>Firmware:</strong> ${device.firmware_version || 'N/A'}</div>
                        <div><strong>RSSI:</strong> ${device.rssi || 'N/A'} dBm</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading device status:', error);
        document.getElementById('devices-grid').innerHTML = '<p class="loading">Error loading devices</p>';
    }
}

// Load latest data
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
                            <th>DHT22 Temp (°C)</th>
                            <th>DHT22 Humidity (%)</th>
                            <th>BMP280 Temp (°C)</th>
                            <th>BMP280 Pressure (Pa)</th>
                            <th>RSSI (dBm)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.data.map(row => `
                            <tr>
                                <td>${row.device_id}</td>
                                <td>${formatTimestamp(row.timestamp_server)}</td>
                                <td>${formatValue(row.dht22_temperature_c, 1)}</td>
                                <td>${formatValue(row.dht22_humidity_percent, 1)}</td>
                                <td>${formatValue(row.bmp280_temperature_c, 1)}</td>
                                <td>${formatValue(row.bmp280_pressure_pa, 0)}</td>
                                <td>${formatValue(row.rssi, 0)}</td>
                            </tr>
                        `).join('')}
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

// Load historical data and render charts
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
        renderChart('rssi-chart', 'RSSI (dBm)', datasets, 'rssi');
        
    } catch (error) {
        console.error('Error loading historical data:', error);
    }
}

// Render or update a chart
function renderChart(chartId, title, datasets, field) {
    const ctx = document.getElementById(chartId);
    if (!ctx) return;
    
    const chartDatasets = datasets.map(ds => ({
        label: ds.deviceId,
        data: ds.rows.map(row => ({
            x: row.timestamp_server * 1000,
            y: row[field]
        })).filter(point => point.y !== null),
        borderColor: ds.color,
        backgroundColor: ds.color.replace('rgb', 'rgba').replace(')', ', 0.1)'),
        tension: 0.4,
        fill: true,
        pointRadius: 2,
        pointHoverRadius: 4
    }));
    
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

// Load statistics
async function loadStatistics() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        const statsGrid = document.getElementById('stats-grid');
        
        const html = `
            <div class="stat-card">
                <div class="stat-value">${data.overall.total_measurements.toLocaleString()}</div>
                <div class="stat-label">Total Measurements</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.overall.total_devices}</div>
                <div class="stat-label">Total Devices</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${formatTimestamp(data.overall.first_measurement)}</div>
                <div class="stat-label">First Measurement</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${formatTimestamp(data.overall.last_measurement)}</div>
                <div class="stat-label">Last Measurement</div>
            </div>
        `;
        
        statsGrid.innerHTML = html;
    } catch (error) {
        console.error('Error loading statistics:', error);
        document.getElementById('stats-grid').innerHTML = '<p class="loading">Error loading statistics</p>';
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
