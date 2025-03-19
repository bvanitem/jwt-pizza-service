const config = require('./config');

// Initialize counters
let totalRequests = 0;
let getRequests = 0;
let putRequests = 0;
let postRequests = 0;
let deleteRequests = 0;
let successfulAuths = 0;
let failedAuths = 0;
let pizzasSold = 0;
let pizzaCreationFailures = 0;
let revenue = 0;
let latencyServiceEndpoint = 0;
let latencyPizzaCreation = 0;

setInterval(() => {
  getRequests += Math.floor(Math.random() * 20) + 1;
  putRequests += Math.floor(Math.random() * 5) + 1;
  postRequests += Math.floor(Math.random() * 10) + 1;
  deleteRequests += Math.floor(Math.random() * 3) + 1;
  totalRequests = getRequests + putRequests + postRequests + deleteRequests;
  sendMetricToGrafana('requests_total', totalRequests, 'sum', '1');
  sendMetricToGrafana('requests_get', getRequests, 'sum', '1');
  sendMetricToGrafana('requests_put', putRequests, 'sum', '1');
  sendMetricToGrafana('requests_post', postRequests, 'sum', '1');
  sendMetricToGrafana('requests_delete', deleteRequests, 'sum', '1');

  const activeUsers = Math.floor(Math.random() * 50) + 10; // 10-60 users
  sendMetricToGrafana('active_users', activeUsers, 'gauge', '1');

  successfulAuths += Math.floor(Math.random() * 15) + 1;
  failedAuths += Math.floor(Math.random() * 5) + 1;
  sendMetricToGrafana('auth_successful', successfulAuths, 'sum', '1');
  sendMetricToGrafana('auth_failed', failedAuths, 'sum', '1');

  const cpuUsage = Math.floor(Math.random() * 100) + 1;
  const memoryUsage = Math.floor(Math.random() * 100) + 1;
  sendMetricToGrafana('cpu_usage', cpuUsage, 'gauge', '%');
  sendMetricToGrafana('memory_usage', memoryUsage, 'gauge', '%');

  pizzasSold += Math.floor(Math.random() * 10) + 1;
  pizzaCreationFailures += Math.floor(Math.random() * 3);
  revenue += (Math.floor(Math.random() * 50) + 10) * (pizzasSold - pizzaCreationFailures); 
  sendMetricToGrafana('pizzas_sold', pizzasSold, 'sum', '1');
  sendMetricToGrafana('pizza_creation_failures', pizzaCreationFailures, 'sum', '1');
  sendMetricToGrafana('revenue', revenue, 'sum', 'USD');

  latencyServiceEndpoint += Math.floor(Math.random() * 200) + 10; 
  latencyPizzaCreation += Math.floor(Math.random() * 150) + 20; 
  sendMetricToGrafana('latency_service_endpoint', latencyServiceEndpoint, 'sum', 'ms');
  sendMetricToGrafana('latency_pizza_creation', latencyPizzaCreation, 'sum', 'ms');

}, 1000); 

function sendMetricToGrafana(metricName, metricValue, type, unit) {
  const metric = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics: [
              {
                name: metricName,
                unit: unit,
                [type]: {
                  dataPoints: [
                    {
                      asInt: metricValue,
                      timeUnixNano: Date.now() * 1000000,
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  };

  if (type === 'sum') {
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].isMonotonic = true;
  }

  const body = JSON.stringify(metric);
  fetch(`${config.url}`, {
    method: 'POST',
    body: body,
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
  })
    .then((response) => {
      if (!response.ok) {
        response.text().then((text) => {
          console.error(`Failed to push metrics data to Grafana: ${text}\n${body}`);
        });
      } else {
        console.log(`Pushed ${metricName}`);
      }
    })
    .catch((error) => {
      console.error('Error pushing metrics:', error);
    });
}