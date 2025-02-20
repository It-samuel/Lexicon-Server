import express from "express";
import jsonServer from "json-server";
import auth from "json-server-auth";
import cors from "cors";
import path from "path";
import promClient from "prom-client";



const server = express();
const port = process.env.PORT || 8080;

// Initialize Prometheus metrics
const register = new promClient.Registry();

// Create a custom metric for request count
promClient.collectDefaultMetrics({
    register,
    timeout: 10000, // Collect metrics every 10 seconds
});

// Custom metrics for the API
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new promClient.Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections'
});

const authAttempts = new promClient.Counter({
  name: 'auth_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['status'] // success, failure
});

// Register the metrics
register.registerMetric(httpRequestTotal);
register.registerMetric(activeConnections);
register.registerMetric(authAttempts);
register.registerMetric(httpRequestDuration);

// Middleware to track request duration and total requests
const metricsMiddleware = (req, res, next) => {
  // Skip metrics collection for the /metrics endpoint itself
  if (req.path === '/metrics') {
    return next();
  }

  const start = Date.now();
  activeConnections.inc();
  
  // Track when response finishes
  const originalSend = res.send;
  res.send = function(data) {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    
    // Record metrics
    httpRequestDuration
      .labels(req.method, route, res.statusCode)
      .observe(duration);
    
    httpRequestTotal
      .labels(req.method, route, res.statusCode)
      .inc();
    
    activeConnections.dec();
    
    // Track auth attempts
    if (req.path.includes('/auth') || req.path.includes('/login') || req.path.includes('/register')) {
      if (res.statusCode === 200 || res.statusCode === 201) {
        authAttempts.labels('success').inc();
      } else if (res.statusCode === 401 || res.statusCode === 403) {
        authAttempts.labels('failure').inc();
      }
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

// Use the metrics middleware
server.use(metricsMiddleware);

// Serve Prometheus metrics at /metrics endpoint
server.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end(error.toString());
  }
});

// Health check endpoint
server.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'json-server-backend'
  });
});


// Enable CORS for all routes
const allowedOrigins = [
    'https://lexicon-agc5hjdncqbvhzh7.canadacentral-01.azurewebsites.net', // Frontend hosted on Azure
    'http://localhost:3001', // Local development
];

server.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = `The CORS policy for this site does not allow access from the specified origin: ${origin}`;
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
    credentials: true, // Allow credentials (e.g., cookies, authorization headers)
}));

// Handle preflight requests
server.options('*', cors());

// Auth and middleware
const middlewares = jsonServer.defaults();
const rules = auth.rewriter({
    products: 444,
    featured_products: 444,
    orders: 660,
    users: 600
});

server.use(rules);
server.use(middlewares);
server.use(auth); // Apply auth middleware before the router

// API routes
const router = jsonServer.router('./data/db.json');
server.use(router);
server.db = router.db;

// Serve static files from the React app (if applicable)
server.use(express.static('build'));

// Handle React routing, return all requests to React app (if applicable)
server.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});