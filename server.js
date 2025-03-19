const joi = require('joi');
const messages = require("./lang/en/en");
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const http = require('http');
const url = require('url');
const { parse } = require('cookie');


const saltRounds = 10;

// Database connection variables
const dbHost = process.env.DB_HOST;
const dbPort = process.env.DB_PORT;
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;
const database = process.env.DB_DATABASE;

//JWT Secret keys
const privateKey = process.env.PRIVATE_KEY;
const publicKey = process.env.PUBLIC_KEY;

const modelAPIUrl = "https://recipeapi.duckdns.org";
const modelAPIQueryEndpoint = "/generate/?prompt=";

class Repository {
    // Establishes variables used to conncet to database
    constructor(host, user, password, database, port) {
        this.host = host;
        this.port = port;
        this.user = user;
        this.password = password;
        this.database = database;
        this.pool = null;

        this.createUserTable = `
            CREATE TABLE users (
                id INT NOT NULL AUTO_INCREMENT,
                email VARCHAR(100) UNIQUE,
                password VARCHAR(200),
                role ENUM('gen','admin') NOT NULL,
                tokens INT,
                PRIMARY KEY(id)
            );
        `
    }

    async init() {
        // Creates a connection 
        this.pool = mysql.createPool({
            host: this.host,
            user: this.user,
            port: this.port,
            password: this.password,
            database: this.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
    }

    // Runs a query 
    async runQuery(query) {
        const con = await this.pool.getConnection();
        try {
            const [rows] = await con.query(query);
            return rows;
        } finally {
            con.release();
        }
    }

    async selectUser(email) {
        try {
            const query = "SELECT * FROM users WHERE email = '%1';".replace("%1", email);
            const result = await this.runQuery(query);
            console.log(result);
            return result;
        } catch (err) {
            console.log(err);
            return err;
        }
    }

    async insertUser(email, password) {
        try {
            const query = `INSERT INTO users (email, password, role, tokens) VALUES ('%1', '%2', 'gen', 20);`
                .replace('%1', email)
                .replace('%2', password);
            const result = await this.runQuery(query);
            console.log(result);

            return { success: true, result: result };
        } catch (err) {
            console.log(err);
            return { success: false, error: err };
        }

    }

    async reduceTokens(email) {
        try {
            const query = `UPDATE users SET tokens = tokens - 1 WHERE email = '%1';`
                .replace('%1', email);
            const result = await this.runQuery(query);
            console.log(result);

            return { success: true, result: result };
        } catch (err) {
            console.log(err);
            return { success: false, error: err };
        }
    }
}

class RecipeAPI {
    constructor(url, path) {
        this.url = url;
        this.path = path;
    }

    async getRecipe(ingredients) {
        const response = await fetch(`${this.url}${this.path}${ingredients}`, {
            method: "GET",
            headers: { ["Content-Type"]: "application/json" }
        });
        const data = await response.json();
        const recipe = this.formatRecipe(data.recipe)
        return recipe
    }

    formatRecipe(recipe) {
        let formattedRecipe = {};
        const sections = recipe.split('\n');
        sections.forEach((section) => {
            const sectionParts = section.split(':').map(item => item.trim());
            const sectionName = sectionParts[0];
            const sectionContent = sectionParts[1];

            const splitContent = sectionContent.split("--").map(line => line.trim()).filter(line => line !== "");
            if(splitContent.length > 1){
                formattedRecipe[sectionName] = splitContent;
            } else {
                formattedRecipe[sectionName] = sectionContent;
            }
        });

        return formattedRecipe;
    }
}


class Server {
    constructor(port, host, user, password, database, dbPort, privateKey, publicKey, recipeApi) {
        this.port = port;
        this.repo = new Repository(host, user, password, database, dbPort);
        this.privateKey = privateKey;
        this.publicKey = publicKey;
        this.api = recipeApi;

        this.sessionDuration = 2 * 60 * 60;
    }

    async parseBody(req) {
        return new Promise((resolve, reject) => {
            let body = "";
            req.on("data", chunk => {
                body += chunk;
            });
            req.on("end", () => {
                resolve(body ? JSON.parse(body) : {})
            });
        });
    }

    authenticateJWT(req, res) {
        const cookies = parse(req.headers.cookie || "");
        if (!cookies || !cookies.accessToken) {
            res.writeHead(401);
            res.write(JSON.stringify({ error: "Access Denied: No Token Provided" }));
            res.end();
            return null;
        }

        try {
            return jwt.verify(cookies.accessToken, this.publicKey, {algorithms: ["RS256"]});
        } catch (err) {
            res.writeHead(401);
            res.write(JSON.stringify({ error: "Access Denied: Invalid Token" }));
            res.end();
            return null;
        }
    }

    async userSignUp(req, res) {
        const info = await this.parseBody(req);
        const email = info.email;
        const password = info.password;

        const checkUser = await this.repo.selectUser(email);
        if (checkUser.length > 0) {
            res.writeHead(400);
            res.write(JSON.stringify({ message: "Email already in use" }));
            res.end();
            return;
        }

        const hashedPassword = await bcrypt.hash(password, saltRounds);
        await this.repo.insertUser(email, hashedPassword);

        const token = jwt.sign({ email }, this.privateKey, { algorithm: "RS256", expiresIn: this.sessionDuration });
        const expiresAt = new Date(Date.now() + this.sessionDuration * 1000);

        res.setHeader('Set-Cookie', `accessToken=${token}; HttpOnly; Secure; Path=/; Max-Age=${this.sessionDuration}`);
        res.writeHead(200);
        res.write(JSON.stringify({
            message: "User registered",
            role: "gen",
            tokens: 20,
            expiresAt: expiresAt.toISOString()
        }));
        res.end();
    }

    async userLogin(req, res) {
        const info = await this.parseBody(req);
        const email = info.email;
        const password = info.password;

        const foundUsers = await this.repo.selectUser(email);
        if (foundUsers.length !== 1 || !(await bcrypt.compare(password, foundUsers[0].password))) {
            res.writeHead(401);
            
            res.write(JSON.stringify({ message: "Invalid email or password" }));
            res.end();
            return;
        }
        const user = foundUsers[0];
        const token = jwt.sign({ email }, this.privateKey, { algorithm: "RS256", expiresIn: this.sessionDuration });
        const expiresAt = new Date(Date.now() + this.sessionDuration * 1000);

        res.setHeader('Set-Cookie', `accessToken=${token}; HttpOnly; Secure; Path=/; Max-Age=${this.sessionDuration}`); // 7200 = 2 hours
        res.writeHead(200);
        res.write(JSON.stringify({
            message: "Successful Login!",
            role: user.role,
            tokens: user.tokens,
            expiresAt: expiresAt.toISOString()
        }));
        res.end();
    }

    userLogout(res){
        res.setHeader('Set-Cookie', 'accessToken=; HttpOnly; Secure; Path=/; Max-Age=0');
        res.writeHead(200);

        res.write(JSON.stringify({message: messages.messages.Logout}));
        res.end();
    }

    //Handles the request
    async handleRequest(req, res) {

        const reqUrl = url.parse(req.url, true);
        const path = reqUrl.pathname;
        if (req.method === "POST") { //POST request handling
            //Get the request body
            if (path === "/signup") {
                await this.userSignUp(req, res);
            } else if (path === "/login") {
                await this.userLogin(req, res);
            } else if(path === "/logout") {
                this.userLogout(res);
                
            } else {
                res.writeHead(404);

                //Response for unimplemented server
                const serverRes = JSON.stringify({
                    message: messages.messages.PageNotFound
                });

                //Write response
                res.write(serverRes);
                res.end();
            }
        } else if (req.method === "GET") { //GET request handling
            //Handle the get Request
            if (path === "/generate" || path === "/generate/") {
                const user = this.authenticateJWT(req, res);
                if (!user) {
                    return;
                }
                res.writeHead(202);

                const recipe = await this.api.getRecipe(reqUrl.query.ingredients);
                await this.repo.reduceTokens(user.email);

                res.write(JSON.stringify(recipe));
                res.end();
            } else {
                res.writeHead(404);

                //Response for unimplemented server
                const serverRes = JSON.stringify({
                    message: messages.messages.PageNotFound
                });

                //Write response
                res.write(serverRes);
                res.end();
            }
        } else { //Anything but a GET or POST is unimplemented
            res.writeHead(501); //501 - unimplemented (server error)

            //Response for unimplemented server
            const serverRes = JSON.stringify({
                message: messages.messages.BadRequest
            });

            //Write response
            res.write(serverRes);
            res.end();
        }

    }

    //Starts the server
    async startServer() {
        try {
            await this.repo.init();
            console.log("Database initialized!");

            http.createServer((req, res) => {

                //Allowing AJAX calls
                res.setHeader('Access-Control-Allow-Origin', 'https://mealmancer.netlify.app');
                res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, PUT, DELETE');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
                res.setHeader('Access-Control-Allow-Credentials', 'true');

                //Handles OPTIONS pre-flight requests from CORS
                if (req.method === "OPTIONS") {
                    res.writeHead(204);
                    res.end();
                    return;
                }

                res.setHeader('Content-Type', 'application/json'); //returning json responses from server
                this.handleRequest(req, res);

            })
                .setTimeout(0)
                .listen(this.port, () => {
                    console.log(`Server is running at port ${this.port}`);
                }); // listens on the passed in port
        } catch (error) {
            console.error("Error initializing database or server:", error);
        }
    }
}

const recipeApi = new RecipeAPI(modelAPIUrl, modelAPIQueryEndpoint);
const server = new Server(8080, dbHost, dbUser, dbPassword, database, dbPort, privateKey, publicKey, recipeApi);
server.startServer();