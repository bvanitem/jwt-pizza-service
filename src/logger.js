const config = require('./config');

class Logger {
  static sanitize(data) {
    if (!data) return data;
    const sanitized = JSON.parse(JSON.stringify(data)); // Deep copy
    if (sanitized.password) sanitized.password = '[REDACTED]';
    if (sanitized.token) sanitized.token = '[REDACTED]';
    return sanitized;
  }

  static sendLogToGrafana(event) {
    const timestamp = Date.now() * 1000000; // Nanoseconds for Loki
    const logEntry = {
      streams: [
        {
          stream: {
            source: config.logging.source,
            level: event.level || 'info',
          },
          values: [[timestamp.toString(), JSON.stringify(this.sanitize(event))]],
        },
      ],
    };

    const body = JSON.stringify(logEntry);
    fetch(config.logging.url, {
      method: 'POST',
      body: body,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.logging.userId}:${config.logging.apiKey}`,
      },
    })
      .then((res) => {
        if (!res.ok) console.error(`Failed to send log to Grafana: ${res.status}`);
      })
      .catch((err) => console.error('Error sending log:', err));
  }

  // Use an arrow function to preserve `this` context
  static httpLogger = (req, res, next) => {
    const start = Date.now();
    const originalSend = res.send;

    // Capture response body
    res.send = function (body) {
      res.locals.body = body;
      return originalSend.apply(res, arguments);
    };

    res.on('finish', () => {
      const duration = Date.now() - start;
      const logEvent = {
        level: res.statusCode >= 400 ? 'error' : 'info',
        message: 'HTTP Request',
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        hasAuthHeader: !!req.headers.authorization,
        requestBody: Logger.sanitize(req.body),
        responseBody: Logger.sanitize(res.locals.body),
        durationMs: duration,
      };
      Logger.sendLogToGrafana(logEvent);
    });

    next();
  };

  static log(level, message, data = {}) {
    const logEvent = { level, message, ...data };
    this.sendLogToGrafana(logEvent);
  }
}

module.exports = Logger;