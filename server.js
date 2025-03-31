/*
    ChatGPT was used for debugging and as a search tool when 
    fixing database errors
*/

// Node module imports
const joi = require('joi');
const messages = require("./lang/en/en");
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const http = require('http');
const url = require('url');
const fs = require('fs');
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
const reduceTokensQuery = "UPDATE userAPIConsumption SET tokens = tokens - 1 WHERE userID = %1;";
const selectTokensQuery = "SELECT tokens FROM userAPIConsumption WHERE userID = %1;";
const changeTokenCountQuery = "UPDATE userAPIConsumption SET tokens = '%1' WHERE userID = '%2';";
const incrementUserAPIConsumption = "UPDATE userAPIConsumption SET httpRequests = httpRequests + 1 WHERE userID = '%1';";
const insertUserQuery = "INSERT INTO users (email, password, role) VALUES ('%1', '%2', 'gen');";
const consumptionInsertQuery = "INSERT INTO userAPIConsumption (userID, tokens, httpRequests) VALUES (%1, 20, 0);";
const selectUserQuery = `
    SELECT u.id AS user_id, u.email, u.password, uc.tokens, uc.httpRequests, u.role 
    FROM users u
    LEFT JOIN userAPIConsumption uc 
    ON u.id = uc.userID
    WHERE u.email = '%1';
`;
const selectAllUsersQuery = `
    SELECT u.id AS user_id, u.email, uc.tokens, uc.httpRequests 
    FROM users u
    LEFT JOIN userAPIConsumption uc 
    ON u.id = uc.userID;
`;

const selectAPIStats = "SELECT method, endpoint, requests FROM apiCalls;";
const insertNewFavouriteRecipe = "INSERT INTO favourites (userID, title, ingredients, directions) VALUES (%1, '%2', '%3', '%4');";
const selectFavouriteRecipes = "SELECT id AS recipeId, title, ingredients, directions FROM favourites WHERE userID = '%1';";
const deleteFavouriteRecipe = "DELETE FROM favourites WHERE id = '%1';";
const deleteUser = "DELETE FROM users WHERE id = '%1';";

const selectApiCall = "SELECT * FROM apiCalls WHERE method = '%1' AND endpoint = '%2';";
const insertApiCall = "INSERT INTO apiCalls (method, endpoint, requests) VALUES ('%1', '%2', 1);";
const updateApiCall = "UPDATE apiCalls SET requests = requests + 1 WHERE method = '%1' AND endpoint = '%2';";

// JSON constants
const jsonGet = "GET";
const jsonPost = "POST";
const testConst = "TEST";
const jsonContentType = "Content-Type";
const jsonApplication = "application/json";
const dataConst = "data";
const endConst = "end";

// Path constants
const signupPath = "signup";
const loginPath = "login";
const logoutPath = "logout";
const generatePath = "generate";

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
            return { success: true, result: result };
        } catch (err) {
            console.log(err);
            return { success: false, error: err };
        }
    }

    async selectAllUsers() {
        try {
            const result = await this.runQuery(selectAllUsersQuery);
            console.log(result);
            return { success: true, result: result };
        } catch (err) {
            console.log(err);
            return { success: false, error: err };
        }
    }

    async selectAPIStats() {
        try {
            const result = await this.runQuery(selectAPIStats);
            console.log(result);
            return { success: true, result: result };
        } catch (err) {
            console.log(err);
            return { success: false, error: err };
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
            const initalQuery = insertUserQuery.replace('%1', email).replace('%2', password);
            const insertUserResult = await this.runQuery(initalQuery);

            const followUpQuery = consumptionInsertQuery.replace('%1', insertUserResult.insertId);
            const insertConsumptionResult = await this.runQuery(followUpQuery);

            return { success: true, result: [insertUserResult, insertConsumptionResult] };
        } catch (err) {

            return { success: false, error: err };
        }
    }

    async deleteUser(id) {
        try {
            const query = deleteUser.replace('%1', id);
            const result = await this.runQuery(query);
            console.log(result);
            return { success: true, result: result };
        } catch (err) {

            return { success: false, error: err };
        }
    }

    /**
     * Asynchronous function to reduce tokens
     * @param {*} id 
     * @returns result of the query
     */
    async reduceTokens(id) {
        try {
            const query = reduceTokensQuery.replace('%1', id);
            const result = await this.runQuery(query);
            console.log(result);

            return { success: true, result: result };
        } catch (err) {
            console.log(err);
            return { success: false, error: err };
        }
    }

    async getUserTokens(id) {
        try {
            const query = selectTokensQuery.replace('%1', id);
            const result = await this.runQuery(query);
            console.log(result);

            return { success: true, result: result[0] };
        } catch (err) {
            console.log(err);
            return { success: false, error: err };
        }
    }

    async changeTokens(id, newTokens) {
        try {
            const query = changeTokenCountQuery.replace('%1', newTokens)
                .replace('%2', id);
            const result = await this.runQuery(query);
            console.log(result);

            return { success: true, result: result };
        } catch (err) {
            console.log(err);
            return { success: false, error: err };
        }
    }

    async incrementUserAPIConsumption(id) {
        try {
            const query = incrementUserAPIConsumption.replace('%1', id);
            const result = await this.runQuery(query);
            console.log(result);

            return { success: true, result: result };
        } catch (err) {
            console.log(err);
            return { success: false, error: err };
        }
    }

    async insertFavouriteRecipe(id, recipe) {
        try {
            const query = insertNewFavouriteRecipe.replace('%1', id)
                .replace('%2', recipe.title)
                .replace('%3', JSON.stringify(recipe.ingredients))
                .replace('%4', JSON.stringify(recipe.directions));
            const result = await this.runQuery(query);
            console.log(result);

            return { success: true, result: result };
        } catch (err) {
            console.log(err);
            return { success: false, error: err };
        }
    }

    async selectUsersFavouriteRecipes(id) {
        try {
            const query = selectFavouriteRecipes.replace('%1', id);
            const result = await this.runQuery(query);
            console.log(result);

            return { success: true, result: result };
        } catch (err) {
            console.log(err);
            return { success: false, error: err };
        }
    }

    async deleteFavourite(id) {
        try {
            const query = deleteFavouriteRecipe.replace('%1', id);
            const result = await this.runQuery(query);
            console.log(result);

            return { success: true, result: result };
        } catch (err) {
            console.log(err);
            return { success: false, error: err };
        }
    }

    async incrementAPICalls(method, endpoint){
        try {
            const check = await this.selectApiCall(method, endpoint);
            if(!check.success) {
                return check;
            }

            if(check.result.length > 0){
                const query = updateApiCall.replace('%1', method)
                            .replace('%2', endpoint);
                const result = await this.runQuery(query);
                console.log(result);

                return { success: true, result: result };
            } else {
                const insertResult = await this.insertApiCalls(method, endpoint);
                return insertResult;
            }
        } catch (err) {
            console.log(err);
            return { success: false, error: err };
        }
    }

    async insertApiCalls(method, endpoint) {
        try {
            const query = insertApiCall.replace('%1', method)
                            .replace('%2', endpoint);
            const result = await this.runQuery(query);
            console.log(result);

            return { success: true, result: result };
        } catch (err) {
            console.log(err);
            return { success: false, error: err };
        }
    }

    async selectApiCall(method, endpoint) {
        try {
            const query = selectApiCall.replace('%1', method)
                            .replace('%2', endpoint);
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
            if (splitContent.length > 1) {
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
        try {
            // Verify the JWT token
            return jwt.verify(cookies.accessToken, this.publicKey, { algorithms: [algorithmConst] });
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

        const schema = joi.object({
            email: joi.string().email().required(),
            password: joi.string().required()
        });

        const {error, value} = schema.validate({email: email, password: password});
        if(error) {
            res.writeHead(400);
            res.write(JSON.stringify({ message: messages.messages.InvalidEmailOrPassword }));
            res.end();
            return;
        }

        // Check if the email is already in use
        const checkUser = await this.repo.selectUser(email);
        if (!checkUser.success) {
            this.serverError(res);
            return;
        }

        if (checkUser.result.length > 0) {
            res.writeHead(400);
            res.write(JSON.stringify({ message: messages.messages.EmailUsed }));
            res.end();
            return;
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const insertResult = await this.repo.insertUser(email, hashedPassword);

        if (!insertResult.success) {
            this.serverError(res);
            return;
        }

        // Create a JWT token
        const token = jwt.sign({ email: email, id: insertResult.result.insertId, role: userRoleConst }, this.privateKey, { algorithm: algorithmConst, expiresIn: this.sessionDuration });
        const expiresAt = new Date(Date.now() + this.sessionDuration * 1000);

        // Set the cookie
        res.setHeader(setCookie, cookieTemplate(token, this.sessionDuration));
        res.writeHead(200);
        res.write(JSON.stringify({
            message: messages.messages.RegisterSuccess,
            role: userRoleConst,
            tokens: 20,
            httpRequests: 0,
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

        const schema = joi.object({
            email: joi.string().email().required(),
            password: joi.string().required()
        });

        const {error, value} = schema.validate({email: email, password: password});
        if(error) {
            res.writeHead(401);
            res.write(JSON.stringify({ message: messages.messages.InvalidEmailOrPassword }));
            res.end();
            return;
        }

        // Check if the user exists
        const foundUsers = await this.repo.selectUser(email);
        if (!foundUsers.success) {
            this.serverError(res);
            return;
        }


        if (foundUsers.result.length !== 1 || !(await bcrypt.compare(password, foundUsers.result[0].password))) {
            res.writeHead(400);

            res.write(JSON.stringify({ message: messages.messages.InvalidEmailOrPassword }));
            res.end();
            return;
        }

        // Create a JWT token
        const user = foundUsers.result[0];
        const token = jwt.sign({ email: email, id: user.user_id, role: user.role }, this.privateKey, { algorithm: algorithmConst, expiresIn: this.sessionDuration });
        const expiresAt = new Date(Date.now() + this.sessionDuration * 1000);

        this.repo.incrementUserAPIConsumption(user.user_id);

        // Set the cookie
        res.setHeader(setCookie, cookieTemplate(token, this.sessionDuration)); // 7200 = 2 hours
        res.writeHead(200);

        res.write(JSON.stringify({
            message: messages.messages.LoginSuccess,
            role: user.role,
            tokens: user.tokens,
            httpRequests: user.httpRequests,
            expiresAt: expiresAt.toISOString()
        }));
        res.end();

        
    }

    async getAllUsers(req, res) {
        const user = this.authenticateJWT(req, res);
        if (!user) {
            return;
        }
        this.repo.incrementUserAPIConsumption(user.id);

        if (user.role === 'admin') {


            const users = await this.repo.selectAllUsers();
            if (!users.success) {
                this.serverError(res);
                return;
            }

            res.writeHead(200);
            res.write(JSON.stringify(users.result));
            res.end();
        } else {
            this.unauthorizedPage(res);
        }
    }

    async getAPIStats(req, res) {
        const user = this.authenticateJWT(req, res);
        if (!user) {
            return;
        }
        this.repo.incrementUserAPIConsumption(user.id);

        if (user.role === 'admin') {


            const stats = await this.repo.selectAPIStats();
            if (!stats.success) {
                this.serverError(res);
                return;
            }

            res.writeHead(200);
            res.write(JSON.stringify(stats.result));
            res.end();
        } else {
            this.unauthorizedPage(res);
        }

        

    }

    async getFavourites(req, res) {
        const user = this.authenticateJWT(req, res);
        if (!user) {
            return;
        }
        this.repo.incrementUserAPIConsumption(user.id);

        const recipes = await this.repo.selectUsersFavouriteRecipes(user.id);
        if (!recipes.success) {
            this.serverError(res);
            return;
        }
        let formattedRecipes = []
        for(let i = 0; i < recipes.result.length; i++){
            formattedRecipes.push(
                {
                    recipeId: recipes.result[i].recipeId,
                    title: recipes.result[i].title,
                    ingredients: JSON.parse(recipes.result[i].ingredients),
                    directions: JSON.parse(recipes.result[i].directions)
                }
            )
        }

        console.log("RECIPES: " + formattedRecipes);


        res.writeHead(200);
        res.write(JSON.stringify(formattedRecipes));
        res.end();

        
    }

    async addFavourite(req, res) {
        const user = this.authenticateJWT(req, res);
        if (!user) {
            return;
        }
        this.repo.incrementUserAPIConsumption(user.id);

        const info = await this.parseBody(req);
        const result = await this.repo.insertFavouriteRecipe(user.id, info.recipe);
        if (!result.success) {
            this.serverError(res);
            return;
        }

        res.writeHead(200);
        res.write(JSON.stringify({
            message: messages.messages.NewFavouriteAdded
        }));
        res.end();

        
    }

    async deleteFavourites(req, res) {
        const user = this.authenticateJWT(req, res);
        if (!user) {
            return;
        }
        this.repo.incrementUserAPIConsumption(user.id);

        const reqUrl = url.parse(req.url, true);
        const id = reqUrl.query.recipe;
        const result = await this.repo.deleteFavourite(id);
        if (!result.success) {
            this.serverError(res);
            return;
        }

        
        res.writeHead(200);
        res.write(JSON.stringify({
            message: messages.messages.RemovedFavourite
        }));
        res.end();
    }

    async deleteUser(req, res) {
        const user = this.authenticateJWT(req, res);
        if (!user) {
            return;
        }
        this.repo.incrementUserAPIConsumption(user.id);

        if (user.role === 'admin') {


            const reqUrl = url.parse(req.url, true);
            const id = reqUrl.query.user;
            const result = await this.repo.deleteUser(id);
            console.log(result);
            if (!result.success) {
                this.serverError(res);
                return;
            }

            res.writeHead(200);
            res.write(JSON.stringify({
                message: messages.messages.RemovedUser
            }));
            res.end();
        } else {
            this.unauthorizedPage(res);
        }

        
    }

    async changeTokenCount(req, res) {
        const user = this.authenticateJWT(req, res);
        if (!user) {
            return;
        }
        this.repo.incrementUserAPIConsumption(user.id);

        const reqUrl = url.parse(req.url, true);
        const id = reqUrl.query.user;
        if (user.role === 'admin') {


            const info = await this.parseBody(req);
            const result = await this.repo.changeTokens(id, info.newTokens);
            if (!result.success) {
                this.serverError(res);
                return;
            }

            res.writeHead(200);
            res.write(JSON.stringify({
                message: messages.messages.TokensUpdated
            }));
            res.end();
        } else {
            this.unauthorizedPage(res);
        }

        
    }

    async getRecipe(req, res) {
        const user = this.authenticateJWT(req, res);
        if (!user) {
            return;
        }
        this.repo.incrementUserAPIConsumption(user.id);
        const checkTokens = await this.repo.getUserTokens(user.id);

        if (!checkTokens.success) {
            this.serverError(res);
            return;
        }

        const tokens = checkTokens.result.tokens;
        if (tokens > 0) {
            const schema = joi.object({
                ingredients: joi.string().pattern(/^[a-zA-Z\s,]+$/).required()
            });

            const reqUrl = url.parse(req.url, true);
            const {error, value} = schema.validate({ingredients: reqUrl.query.ingredients});
            if(error) {
                res.writeHead(400);
                res.write(JSON.stringify({ message: messages.messages.InvalidRecipeInput }));
                res.end();
                return;
            }
            //Get the recipe from the API
            const recipe = await this.api.getRecipe(reqUrl.query.ingredients);

            //Write the response
            res.writeHead(200);
            res.write(JSON.stringify(recipe));
            res.end();

            const result = await this.repo.reduceTokens(user.id);
            if (!result.success) {
                this.serverError(res);
                return;
            }
        } else {
            res.writeHead(400);
            res.write(JSON.stringify({
                message: messages.messages.OutOfTokens
            }));
            res.end();
        }

        
    }

    /**
     * Logs out a user
     * @param {*} res 
     */
    userLogout(res) {
        // Set the cookie
        res.setHeader(setCookie, logoutCookie);
        res.writeHead(200);

        // Write the response
        res.write(JSON.stringify({ message: messages.messages.Logout }));
        res.end();
    }

    pageNotFoundResponse(res) {
        res.writeHead(404);

        //Response for unimplemented server
        const serverRes = JSON.stringify({
            message: messages.messages.PageNotFound
        });

        //Write response
        res.write(serverRes);
        res.end();
    }

    unauthorizedPage(res) {
        res.writeHead(401);

        //Response for unimplemented server
        const serverRes = JSON.stringify({
            message: messages.messages.NotAuthorized
        });

        //Write response
        res.write(serverRes);
        res.end();
    }

    serverError(res) {
        res.writeHead(500);

        //Response for unimplemented server
        const serverRes = JSON.stringify({
            message: messages.messages.ServerError
        });

        //Write response
        res.write(serverRes);
        res.end();
    }

    async handleGet(req, res, path) {
        switch (path) {
            case generatePath:
                this.getRecipe(req, res);
                break;
            case "users":
                await this.getAllUsers(req, res);
                break;
            case "apiStats":
                await this.getAPIStats(req, res);
                break;
            case "favourites":
                await this.getFavourites(req, res);
                break;
            default:
                this.pageNotFoundResponse(res);
        }
    }

    async handlePost(req, res, path) {
        switch (path) {
            case signupPath:
                await this.userSignUp(req, res);
                break;
            case loginPath:
                await this.userLogin(req, res);
                break;
            case logoutPath:
                this.userLogout(res);
                break;
            case "favourites":
                await this.addFavourite(req, res);
                break;
            default:
                this.pageNotFoundResponse(res);
        }
    }

    async handlePut(req, res, path) {
        switch (path) {
            case "users":
                this.changeTokenCount(req, res);
                break;
            default:
                this.pageNotFoundResponse(res);
        }
    }

    async handleDelete(req, res, path) {
        switch (path) {
            case "users":
                this.deleteUser(req, res);
                break;
            case "favourites":
                this.deleteFavourites(req, res);
                break;
            default:
                this.pageNotFoundResponse(res);
        }
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
        const path = reqUrl.pathname.split('/');
        console.log(path);
        if (path[1] === 'v1') {
            //Check the request method
            switch (req.method) {
                case jsonPost: //POST request handling
                    await this.handlePost(req, res, path[2]);
                    break;
                case jsonGet: //GET request handling
                    await this.handleGet(req, res, path[2]);
                    break;
                case "PUT":
                    await this.handlePut(req, res, path[2]);
                    break;
                case "DELETE":
                    await this.handleDelete(req, res, path[2]);
                    break;
                default: //Anything but a GET or POST is unimplemented
                    res.writeHead(501); //501 - unimplemented (server error)

                    //Response for unimplemented server
                    const serverRes = JSON.stringify({
                        message: messages.messages.BadRequest
                    });

                    //Write response
                    res.write(serverRes);
                    res.end();
            }
        } else {
            this.pageNotFoundResponse(res);
        }

        await this.repo.incrementAPICalls(req.method, reqUrl.pathname);
    }

    serveStaticFile(res, filePath, contentType) {
        fs.readFile(filePath, (err, data) => {
            if (err) {
              this.serverError(res);
              return;
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
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
                res.setHeader("Access-Control-Expose-Headers", "Content-Type, Authorization");
                res.setHeader(corsCredentials, trueConst);

                //Handles OPTIONS pre-flight requests from CORS
                if (req.method === optionsConst) {
                    console.log("PRE_FLIGHT")
                    res.writeHead(204);
                    res.end();
                    return;
                }

                const reqUrl = url.parse(req.url, true);
                if(reqUrl.pathname === '/doc'){
                    const filePath = 'swagger.html';
                    serveStaticFile(res, filePath, 'text/html');
                } else {
                    res.setHeader(jsonContentType, jsonApplication); //returning json responses from server
                    this.handleRequest(req, res);
                }
 

            })
                // Set the timeout to 0 to prevent the server from closing the connection
                .setTimeout(0)
                .listen(this.port, () => {
                    console.log(messages.messages.ServerRunning.replace("{port}", this.port));
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
const server = new Server(8000, dbHost, dbUser, dbPassword, database, dbPort, privateKey, publicKey, recipeApi);
server.startServer();