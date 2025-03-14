import express from "express";
import jsonServer from "json-server";
import auth from "json-server-auth";

const server = express();
const port = process.env.PORT || 8080;

server.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

const router = jsonServer.router('./data/db.json');
server.use( router);
server.db = router.db;

const middlewares = jsonServer.defaults();
const rules = auth.rewriter({
    products: 444,
    featured_products: 444,
    orders: 660,
    users: 600
});

server.use(rules);
server.use(auth);
server.use(middlewares);

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});