const express = require('express');
const bodyParser = require('body-parser');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');
const jwt=require('jsonwebtoken');
const bcrypt=require('bcrypt');

const app = express();
app.use(bodyParser.json());
const port = process.env.PORT || 3000;

const databasePath = path.join(__dirname, "blogsite.db");

const IntializeDatabase = async () => {
    try {
        db = await open({
            filename: databasePath,
            driver: sqlite3.Database
        });
        console.log("DB connected successfully");
        await createTables(); // Call the function to create tables
    } catch (error) {
        console.error("Error connecting to the database:", error);
    }
}

const createTables = async () => {
    try {
        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                username VARCHAR(50) NOT NULL UNIQUE,
                email VARCHAR(150) NOT NULL UNIQUE,
                password VARCHAR(100) NOT NULL,
                image VARCHAR(1024),
                bio VARCHAR(500)
            );

            CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                title VARCHAR(100) NOT NULL,
                subtitle VARCHAR(200) NOT NULL,
                body TEXT NOT NULL,
                author_id INTEGER REFERENCES users(id),
                tags TEXT
            );

            CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                body TEXT NOT NULL,
                author_id INTEGER REFERENCES users(id),
                article_id INTEGER REFERENCES articles(id)
            );
        `);
        console.log("Tables created successfully");
    } catch (error) {
        console.error("Error creating tables:", error);
    }
};

// Only the IntializeDatabase function and createTables function are added, no other changes
app.get("/",(req,res)=>{
    res.send("hello world");
});

// signup or register user
app.post("/users", async (req, res) => {
    console.log("Received POST request to create a new user:", req.body);
    const { username, email, password, image, bio } = req.body;
    try {
        const query0=`select * from users where username=?;`;
        const result=await db.get(query0,[username]);
        console.log("the result is:",result);
        // If User already exists.
        if(result)
        return res.status(409).send("User already exists");
        const hashedPassword=await bcrypt.hash(password,10);
        // if user doesnt exist.
        const query = ` INSERT INTO users(username, email, password, image, bio)
        VALUES (?, ?, ?, ?, ?) `;
        const ans= await db.run(query, [username, email, hashedPassword, image, bio]);
        console.log(ans);
        res.status(201).json({ message: "User created successfully" });
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(400).json({ error: "Internal Server Error" });
    }
});

// Login 
app.post("/users/login",async(req,res)=>{
const {email,password}=req.body;
console.log(req.body);
try {
    query=`select password from users where email='${email}';`;
    const result=await db.get(query);
    console.log("The password is:",result);

    if(!result|| !(await bcrypt.compare(password,result.password)))
    return res.status(404).send("Invalid credentials");
    console.log(result.password);
    // if(result.password==password)
    // return res.status(200).send("User logged in");
    // if(result==undefined||result.password!=password)
    // return res.status(404).send("Invalid credentials");
    const token=jwt.sign({userId:result.id},'secret_key',{expiresIn:'1h'});
    res.status(200).json({token});
} 
catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "Internal Server Error" });
}
});

//getting user details
app.get("/users/:id",authenticateToken,async(req,res)=>{
    const userid=req.params.id;
    try {
        const query =`select * from users where id=${userid};`;
        const result=await db.get(query);
        console.log(result);
        res.send(result);
        
    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }

});
function authenticateToken(req,res,next){
    const authHeader=req.headers['authorization'];
    const token=authHeader && authHeader.split(' ')[1];
    if(token==null)
    return res.status(401).send("Unauthrized");
    jwt.verify(token,'secret_key',(err,user)=>{
        if(err)
        return res.status(403).send("Forbidden");
        req.user=user;
        next();

    });
}
app.listen(port, () => {
    IntializeDatabase();
    console.log(`Server working on port ${port}`);
});

