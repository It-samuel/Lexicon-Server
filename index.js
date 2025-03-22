import express from "express";
import jsonServer from "json-server";
import auth from "json-server-auth";
import cors from "cors";
import path from "path";

const server = express();
const port = process.env.PORT || 8080;

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