const config = require('./config.js');
console.log('Loaded config in metrics.js:', JSON.stringify(config));
const os = require('os');

let metrics = [];
let requests = 0;
let getRequests = 0;
let postRequests = 0;
let putRequests = 0;
let deleteRequests = 0;
let authorized = 0;
let unauthorized = 0;
let fulfilled = 0;
let failed = 0;
let revenue = 0;
const activeUsers = new Set();

function sendMetricsPeriodically(period) {
    setInterval(() => {
      try {

        systemMetrics();
        httpMetrics();
        activeUserMetric();

        const metric = {
            resourceMetrics: [
                {
                  scopeMetrics: [
                    {
                      metrics: metrics,
                    },
                  ],
                },
              ],
            };   
        sendMetricToGrafana(metric);
        metrics = [];
      } catch (error) {
        console.log('Error sending metrics', error);
      }
    }, period);
  }


function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

function httpMetrics() {
    addMetric('requests', requests, 'sum', '1');
    addMetric('GET', getRequests, 'sum', '1');
    addMetric('POST', postRequests, 'sum', '1');
    addMetric('PUT', putRequests, 'sum', '1');
    addMetric('DELETE', deleteRequests, 'sum', '1');
}

function activeUserMetric() {
    addMetric('active_users', activeUsers.size, 'gauge', '1');
    activeUsers.clear();
}

function systemMetrics() {
    const cpuUsage = getCpuUsagePercentage();
    const memoryUsage = getMemoryUsagePercentage();
    const cpuMetric = {
        name: "cpu",
        unit: "%",
        gauge: {
            dataPoints: [
            {
                asDouble: cpuUsage,
                timeUnixNano: Date.now() * 1000000,
                attributes: [
                {
                    key: "source",
                    value: { "stringValue": "jwt-pizza-service" }
                }
                ]
            }
            ]
        }
        };
        metrics.push(cpuMetric);

    const memoryMetric = {
        name: "memory",
        unit: "%",
        gauge: {
            dataPoints: [
            {
                asDouble: memoryUsage,
                timeUnixNano: Date.now() * 1000000,
                attributes: [
                {
                    key: "source",
                    value: { "stringValue": "jwt-pizza-service" }
                }
                ]
            }
            ]
        }}
    metrics.push(memoryMetric);
}

async function requestTracker(req, res, next) {
    requests++;
    if (req.method === 'GET') {
        getRequests++;
    } else if (req.method === 'POST') {
        postRequests++;
    } else if (req.method === 'PUT') {
        putRequests++;
    } else if (req.method === 'DELETE') {
        deleteRequests++;
    }
    next();
  }

  function addMetric(metricName, metricValue, type, unit) {
    const metric = {
        name: metricName,
        unit: unit,
        [type]: {
        dataPoints: [
            {
            asInt: metricValue,
            timeUnixNano: Date.now() * 1000000,
            attributes: [
                {
                    key: "source",
                    value: { "stringValue": "jwt-pizza-service" }
                }
            ]
            },
        ],
        }
    };
    if (type === 'sum') {
        metric[type].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
        metric[type].isMonotonic = true;
    }

    metrics.push(metric);
}

function addDoubleMetric(metricName, metricValue, type, unit) {
    const metric = {
        name: metricName,
        unit: unit,
        [type]: {
        dataPoints: [
            {
            asDouble: metricValue,
            timeUnixNano: Date.now() * 1000000,
            attributes: [
                {
                    key: "source",
                    value: { "stringValue": "jwt-pizza-service" }
                }
            ]
            },
        ],
        }
    };
    if (type === 'sum') {
        metric[type].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
        metric[type].isMonotonic = true;
    }

    metrics.push(metric);
}


function sendMetricToGrafana(metric) {
    const body = JSON.stringify(metric);
    fetch(`${config.metrics.url}`, {
        method: 'POST',
        body: body,
        headers: { Authorization: `Bearer ${config.metrics.apiKey}`, 'Content-Type': 'application/json' },
    })
        .then((response) => {
        if (!response.ok) {
            response.text().then((text) => {
            console.error(`Failed to push metrics data to Grafana: ${text}\n${body}`);
            });
        } else {
            console.log(`Pushed metrics`);
        }
        })
        .catch((error) => {
        console.error('Error pushing metrics:', error);
        });
}

function trackAuth(status, userId) {
    if (status === 'authorized') {
        authorized++;
        activeUsers.add(userId);
        addMetric(status, authorized, 'sum', '1');
    } else {
        unauthorized++;
        addMetric(status, unauthorized, 'sum', '1');
    }
}

async function trackRequestLatency(req, res, next) {
    const start = Date.now();
    const send = res.send;
    res.send = function (body) {
        const end = Date.now();
        const latency = end - start;
        addMetric('request_latency', latency, 'gauge', 'ms');
        res.send = send;
        res.send(body);
    }
    next();
}

function trackOrders(status) {
    if (status === 'fulfilled') {
        fulfilled++;
        addMetric(status, fulfilled, 'sum', '1');
    } else {
        failed++;
        addMetric(status, failed, 'sum', '1');
    }
}

function trackRevenue(items) {
    revenue += items.reduce((total, item) => total + item.price, 0);
    addDoubleMetric('revenue', revenue, 'sum', '1');
}
  
sendMetricsPeriodically(10000);

module.exports = { requestTracker, trackAuth, addMetric, trackRequestLatency, trackOrders, trackRevenue }