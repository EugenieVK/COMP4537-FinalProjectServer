// Node module imports
const joi = require('joi');
const messages = require("./lang/en/en");
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const http = require('http');
const url = require('url');
const { parse } = require('cookie');

// Salt rounds for hashing
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

// Recipe API variables
const modelAPIUrl = "https://recipeapi.duckdns.org";
const modelAPIQueryEndpoint = "/generate/?prompt=";

/**
 * String constants
 */
// Database constants
const databaseTableConst = `
            CREATE TABLE users (
                id INT NOT NULL AUTO_INCREMENT,
                email VARCHAR(100) UNIQUE,
                password VARCHAR(200),
                role ENUM('gen','admin') NOT NULL,
                tokens INT,
                PRIMARY KEY(id)
            );
        `;
const reduceTokensQuery = "UPDATE users SET tokens = tokens - 1 WHERE email = '%1';";
const insertUserQuery = "INSERT INTO users (email, password, role, tokens) VALUES ('%1', '%2', 'gen', 20);";
const selectUserQuery = "SELECT * FROM users WHERE email = '%1';";

// JSON constants
const jsonGet = "GET";
const jsonPost = "POST";
const testConst = "TEST";
const jsonContentType = "Content-Type";
const jsonApplication = "application/json";
const dataConst = "data";
const endConst = "end";
const portConst = "{port}";

// Path constants
const signupPath = "/signup";
const loginPath = "/login";
const logoutPath = "/logout";
const generatePath = "/generate";
const generatePathAlt = "/generate/";

// Cookie constants
const setCookie = "Set-Cookie";
const logoutCookie = "accessToken=; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=0";
const cookieTemplate = (token, maxAge) => `accessToken=${token}; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=${maxAge}`;

// Algorithm constant
const algorithmConst = "RS256";

// User constants
const userRoleConst = "gen";

// CORS constants
const optionsConst = "OPTIONS";
const corsOrigin = "Access-Control-Allow-Origin";
const corsMethods = "Access-Control-Allow-Methods";
const corsHeaders = "Access-Control-Allow-Headers";
const corsCredentials = "Access-Control-Allow-Credentials";
const trueConst = "true";
const corsOriginValue = "https://mealmancer.netlify.app";
const corsMethodsValue = "POST, GET, OPTIONS, PUT, DELETE";
const corsHeadersValue = "Content-Type, Authorization";

/**
 * Repository class to handle database operations
 */
class Repository {
    /**
     * Constructor for the Repository class
     * @param {*} host 
     * @param {*} user 
     * @param {*} password 
     * @param {*} database 
     * @param {*} port 
     */
    constructor(host, user, password, database, port) {
        this.host = host;
        this.port = port;
        this.user = user;
        this.password = password;
        this.database = database;
        this.pool = null;

        this.createUserTable = databaseTableConst;
    }

    /**
     * Asynchronous function to initialize the connection pool
     */
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

    /**
     * Asynchronous function to run a query
     * @param {*} query
     * @returns result of the query
     */
    async runQuery(query) {
        const con = await this.pool.getConnection();
        try {
            const [rows] = await con.query(query);
            return rows;
        } finally {
            con.release();
        }
    }

    /**
     * Asynchronous function to select a user
     * @param {*} email 
     * @returns result of the query
     */
    async selectUser(email) {
        try {
            const query = selectUserQuery.replace("%1", email);
            const result = await this.runQuery(query);
            console.log(result);
            return result;
        } catch (err) {
            console.log(err);
            return err;
        }
    }

    /**
     * Asynchronous function to insert a user
     * @param {*} email 
     * @param {*} password 
     * @returns result of the query
     */
    async insertUser(email, password) {
        try {
            const query = insertUserQuery.replace('%1', email).replace('%2', password);
            const result = await this.runQuery(query);
            console.log(result);

            return { success: true, result: result };
        } catch (err) {
            console.log(err);
            return { success: false, error: err };
        }

    }

    /**
     * Asynchronous function to reduce tokens
     * @param {*} email 
     * @returns result of the query
     */
    async reduceTokens(email) {
        try {
            const query = reduceTokensQuery.replace('%1', email);
            const result = await this.runQuery(query);
            console.log(result);

            return { success: true, result: result };
        } catch (err) {
            console.log(err);
            return { success: false, error: err };
        }
    }
}

/**
 * RecipeAPI class to handle recipe API operations
 */
class RecipeAPI {
    /**
     * Constructor for the RecipeAPI class
     * @param {*} url 
     * @param {*} path 
     */
    constructor(url, path) {
        this.url = url;
        this.path = path;
    }

    /**
     * Asynchronous function to get a recipe from the API
     * @param {*} ingredients 
     * @returns recipe
     */
    async getRecipe(ingredients) {
        const response = await fetch(`${this.url}${this.path}${ingredients}`, {
            method: jsonGet,
            headers: { [jsonContentType]: jsonApplication }
        });
        const data = await response.json();
        const recipe = this.formatRecipe(data.recipe)
        return recipe
    }

    /**
     * Formats the recipe from the API for use by the client side of the application
     * @param {*} recipe 
     * @returns formatted recipe
     */
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

/**
 * Server class to handle server operations
 */
class Server {
    /**
     * Constructor for the Server class
     * @param {*} port 
     * @param {*} host 
     * @param {*} user 
     * @param {*} password 
     * @param {*} database 
     * @param {*} dbPort 
     * @param {*} privateKey 
     * @param {*} publicKey 
     * @param {*} recipeApi 
     */
    constructor(port, host, user, password, database, dbPort, privateKey, publicKey, recipeApi) {
        this.port = port;
        this.repo = new Repository(host, user, password, database, dbPort);
        this.privateKey = privateKey;
        this.publicKey = publicKey;
        this.api = recipeApi;

        this.sessionDuration = 2 * 60 * 60;
    }

    /**
     * Asynchronous function to parse the body of a request
     * @param {*} req 
     * @returns body of the request
     */
    async parseBody(req) {
        return new Promise((resolve, reject) => {
            let body = "";
            req.on(dataConst, chunk => {
                body += chunk;
            });
            req.on(endConst, () => {
                resolve(body ? JSON.parse(body) : {})
            });
        });
    }

    /**
     * Authenticate the JWT token
     * @param {*} req 
     * @param {*} res 
     * @returns user
     */
    authenticateJWT(req, res) {
        // Get the cookie from the request
        const cookies = parse(req.headers.cookie || "");
        console.log(cookies);
        console.log(cookies.accessToken);
        console.log(testConst);
        try {
            // Verify the JWT token
            return jwt.verify(cookies.accessToken, this.publicKey, {algorithms: [algorithmConst]});
        } catch (err) {
            res.writeHead(401);
            res.write(JSON.stringify({ error: messages.messages.InvalidToken }));
            res.end();
            return null;
        }
    }

    /**
     * Signs up a user
     * @param {*} req 
     * @param {*} res 
     * @returns user
     */
    async userSignUp(req, res) {
        // Get the email and password from the request body
        const info = await this.parseBody(req);
        const email = info.email;
        const password = info.password;

        // Check if the email is already in use
        const checkUser = await this.repo.selectUser(email);
        if (checkUser.length > 0) {
            res.writeHead(400);
            res.write(JSON.stringify({ message: messages.messages.EmailUsed }));
            res.end();
            return;
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        await this.repo.insertUser(email, hashedPassword);

        // Create a JWT token
        const token = jwt.sign({ email }, this.privateKey, { algorithm: algorithmConst, expiresIn: this.sessionDuration });
        const expiresAt = new Date(Date.now() + this.sessionDuration * 1000);

        // Set the cookie
        res.setHeader(setCookie, cookieTemplate(token, this.sessionDuration));
        res.writeHead(200);
        res.write(JSON.stringify({
            message: messages.messages.RegisterSuccess,
            role: userRoleConst,
            tokens: 20,
            expiresAt: expiresAt.toISOString()
        }));
        res.end();
    }

    /**
     * Asynchronous function to log in a user
     * @param {*} req 
     * @param {*} res 
     * @returns user
     */
    async userLogin(req, res) {
        // Get the email and password from the request body
        const info = await this.parseBody(req);
        const email = info.email;
        const password = info.password;

        // Check if the user exists
        const foundUsers = await this.repo.selectUser(email);
        if (foundUsers.length !== 1 || !(await bcrypt.compare(password, foundUsers[0].password))) {
            res.writeHead(401);
            
            res.write(JSON.stringify({ message: messages.messages.InvalidLogin }));
            res.end();
            return;
        }

        // Create a JWT token
        const user = foundUsers[0];
        const token = jwt.sign({ email }, this.privateKey, { algorithm: algorithmConst, expiresIn: this.sessionDuration });
        const expiresAt = new Date(Date.now() + this.sessionDuration * 1000);

        // Set the cookie
        res.setHeader(setCookie, cookieTemplate(token, this.sessionDuration)); // 7200 = 2 hours
        res.writeHead(200);
        res.write(JSON.stringify({
            message: messages.messages.LoginSuccess,
            role: user.role,
            tokens: user.tokens,
            expiresAt: expiresAt.toISOString()
        }));
        res.end();
    }

    /**
     * Logs out a user
     * @param {*} res 
     */
    userLogout(res){
        // Set the cookie
        res.setHeader(setCookie, logoutCookie);
        res.writeHead(200);

        // Write the response
        res.write(JSON.stringify({message: messages.messages.Logout}));
        res.end();
    }

    /**
     * Asynchronous function to handle a request
     * @param {*} req 
     * @param {*} res 
     * @returns response
     */
    async handleRequest(req, res) {
        //Parse the request URL
        const reqUrl = url.parse(req.url, true);
        const path = reqUrl.pathname;
        //Check the request method
        if (req.method === jsonPost) { //POST request handling
            //Get the request body
            if (path === signupPath) {
                await this.userSignUp(req, res);
            } else if (path === loginPath) {
                await this.userLogin(req, res);
            } else if(path === logoutPath) {
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
        } else if (req.method === jsonGet) { //GET request handling
            //Handle the get Request
            if (path === generatePath || path === generatePathAlt) {
                const user = this.authenticateJWT(req, res);
                if (!user) {
                    return;
                }
                res.writeHead(200);

                //Get the recipe from the API
                const recipe = await this.api.getRecipe(reqUrl.query.ingredients);
                await this.repo.reduceTokens(user.email);

                //Write the response
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

    /**
     * Asynchronous function to start the server
     */
    async startServer() {
        try {
            //Initialize the database
            await this.repo.init();
            console.log(messages.messages.DatabaseInit);

            //Create the server
            http.createServer((req, res) => {

                //Allowing AJAX calls
                res.setHeader(corsOrigin, corsOriginValue);
                res.setHeader(corsMethods, corsMethodsValue);
                res.setHeader(corsHeaders, corsHeadersValue);
                res.setHeader(corsCredentials, trueConst);

                //Handles OPTIONS pre-flight requests from CORS
                if (req.method === optionsConst) {
                    res.writeHead(204);
                    res.end();
                    return;
                }

                res.setHeader(jsonContentType, jsonApplication); //returning json responses from server
                this.handleRequest(req, res);

            })
                // Set the timeout to 0 to prevent the server from closing the connection
                .setTimeout(0)
                .listen(this.port, () => {
                    console.log(messages.ServerRunning.replace(portConst, this.port));
                }); // listens on the passed in port
        } catch (error) {
            console.error(messages.messages.DatabaseError, error);
        }
    }
}

/**
 * Create a new instance of the RecipeAPI class and the Server class
 * Start the server
 */
const recipeApi = new RecipeAPI(modelAPIUrl, modelAPIQueryEndpoint);
const server = new Server(8080, dbHost, dbUser, dbPassword, database, dbPort, privateKey, publicKey, recipeApi);
server.startServer();