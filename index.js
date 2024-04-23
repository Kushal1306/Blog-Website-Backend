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
                updated_at TIMESTAMP DEFAU LT CURRENT_TIMESTAMP,
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
            CREATE TABLE IF NOT EXISTS follows (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                follower_id INTEGER NOT NULL,
                following_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (follower_id) REFERENCES users(id),
                FOREIGN KEY (following_id) REFERENCES users(id)
            );
            
        `);
        console.log("Tables created successfully");
        DatabaseTest()
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
    query=`select password,id from users where email='${email}';`;
    const result=await db.get(query);
    console.log("The password is:",result);
    console.log(password,result.password);

    if(!result|| !(await bcrypt.compare(password,result.password)))
    return res.status(404).send("Invalid credentials");
    console.log(result.password);
    // if(result.password==password)
    // return res.status(200).send("User logged in");
    // if(result==undefined||result.password!=password)
    // return res.status(404).send("Invalid credentials");
    console.log("id is:",result.id);
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

// updating user details
app.patch("/users/me",authenticateToken,async(req,res)=>{
const userId=req.user.userId;

console.log("user id is:",userId);
const {username,email,password,image,bio}= req.body;
try{
     if(!username && !email && !password && !image && !bio)
     return res.status(400).send("At least one filed required");

     const updateFields=[];
     const params=[];
     if(username){
        updateFields.push("username=?");
        params.push(username);
     }
     if(email){
        updateFields.push("email=?");
        params.push(email);
     }
     if(password){
        const hashedPassword=await bcrypt.hash(password,10);
        updateFields.push("password=?");
        params.push(hashedPassword);
     }
     if(image){
        updateFields.push("image=?");
        params.push(image);
     }
     if (bio) {
        updateFields.push("bio = ?");
        params.push(bio);
    }
    const query=`update users set ${updateFields.join(',')} where id=?`
    params.push(userId);
    await db.run(query,params);
    res.status(200).send("profile updated");
}
catch(error){
    console.log("the error is ",error);
}
});

app.put("/users/:username/follow",authenticateToken,async(req,res)=>{
    const username=req.params.username;
    try {
        const query=`select * from users where username='${username}';`
        const result= await db.get(query);
        if(!result){
            res.status(404).send("user Not found");
        }
        console.log(result);
        const follower_id=req.user.userId;
        const following_id=result.id
        console.log(follower_id,follower_id);
        const query2=`insert into follows(follower_id,following_id) values(?,?);`
        const result2=await db.run(query2,[follower_id,following_id]);
        // const finalquery=`select * from follows;`
        // const finalresult=await db.get(finalquery);
        // console.log("follows table has:",finalresult)
        if(result2)
        res.status(200).send("Followed Succefully");
    } catch (error) {
        console.error("Error following user:", error);
        res.status(500).json({ error: "Internal Server Error" });
        
    }

});

app.delete("/users/:username/follow",authenticateToken,async(req,res)=>{
    const username=req.params.username;
    try {
        const query=`select * from users where username='${username}';`
        const result=await db.get(query);
        if(!result)
        res.status(404).send("User not found");
       const followquery=`select * from follows where follower_id=? and following_id=?;`
       const followresult=await db.get(followquery,[req.user.userId,result.id])
       if(!followresult)
       res.status(400).send("user is not being followed");
       const deletequery=`delete from follows where follower_id=? and following_id=?;`
       const deleteresult=await db.run(deletequery,[req.user.userId,result.id])
    //    const finalquery=`select * from follows;`
    //    const finalresult=await db.get(finalquery);
    //    console.log("follows table has:",finalresult);
       if(deleteresult)
       res.status(202).send("user unfollowed succesfully");

    } catch (error) {
        console.error("Error unfollowing the user");
        res.status(500).json({error:"Internal Server error"});
    }  

});

app.get("/users/:username/followers", authenticateToken, async (req, res) => {
    const username = req.params.username;
    console.log(username);
    try {
        const query = `SELECT id FROM users WHERE username=?;`;
        const result = await db.get(query, [username]);
        console.log(result);
        if (!result)
            return res.status(404).send("User not found");

        const followquery = `SELECT username FROM users WHERE id IN (SELECT follower_id FROM follows WHERE following_id=?);`;
        const followresult = await db.all(followquery, [result.id]);
        console.log(followresult);
        res.status(200).send("Request successful");
    } catch (error) {
        console.error("The error is:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.post("/users/articles",authenticateToken,async(req,res)=>{
    const userid=req.user.userId;
    const {title,subtitle,body,tags}=req.body;
   try {
    const query=`insert into articles(title,subtitle,body,author_id,tags) values(?,?,?,?,?);`
    const result=await db.run(query,[title,subtitle,body,userid,tags]);
    if(result)
    res.status(201).send("Article created succesfully");
   } catch (error) {
    console.error("the error is:",error);
    res.status(400).send("validation error");
   }

});

// getting artciles
app.get("/articles", authenticateToken, async (req, res) => {
    const { only_following, tags, author, sort, limit = 10, page = 1 } = req.query;

    try {
        let query = `SELECT * FROM articles WHERE 1 = 1`;
        const params = [];

        if (only_following === 'true') {
            const followQuery = `SELECT following_id FROM follows WHERE follower_id = ?;`;
            const followResult = await db.all(followQuery, [req.user.userId]);

            if (followResult.length === 0) {
                return res.status(404).send("No articles found from users whom you follow");
            }

            const followingIds = followResult.map(row => row.following_id);
            query += ` AND author_id IN (${followingIds.join(',')})`;
        }

        if (tags) {
            const tagList = tags.split(',');
            const tagConditions = tagList.map(tag => 'tags LIKE ?');
            query += ` AND (${tagConditions.join(' OR ')})`;
            params.push(...tagList.map(tag => `%${tag}%`));
        }

        if (author) {
            const authorQuery = `SELECT id FROM users WHERE username = ?;`;
            const authorIdResult = await db.get(authorQuery, author);
            if (!authorIdResult) {
                return res.status(404).send("Author not found");
            }
            query += ` AND author_id = ?`;
            params.push(authorIdResult.id);
        }

        if (sort === 'new') {
            query += ' ORDER BY created_at DESC';
        } else if (sort === 'popular') {
            query += ' ORDER BY likes DESC'; // Assuming you have a 'likes' column in your articles table
        }

        query += ' LIMIT ? OFFSET ?';
        params.push(limit, (page - 1) * limit);

        const result = await db.all(query, params);
        console.log(result);
        res.status(200).json(result);
    } catch (error) {
        console.error("Error fetching articles:", error);
        res.status(500).send('Internal Server Error');
    }
});
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    
    // Check if Authorization header is present
    if (!authHeader) {
        return res.status(401).send("Unauthorized: Missing Authorization header");
    }
    
    // Extract token from Authorization header
    const token = authHeader.split(' ')[1];

    // Verify JWT token
    jwt.verify(token, 'secret_key', (err, decodedToken) => {
        if (err) {
            // Token verification failed
            console.error("Error verifying token:", err);
            return res.status(403).send("Forbidden: Invalid token");
        }
        
        // Token verification successful
        // Extract user ID from decoded token and set it in req.user
        console.log("Decoded token:", decodedToken);
        req.user = { userId: decodedToken.userId }; // Ensure correct property name
        console.log("req.user:", req.user);        
        next(); // Proceed to the next middleware
    });
}
// async function  can also be written as async fucntion DatabaseTest()
const DatabaseTest=async()=>{
    try {
        const userstable=`select * from users;`
        const userresult=await db.all(userstable);
        console.log("users table has:",userresult);
        const commentstable=`select * from comments;`
        const commentresult=await db.get(commentstable);
        console.log("comments table has:",commentresult);
        const articlestable=`select * from articles;`
        const articleresult=await db.get(articlestable);
        console.log("articles table has:",articleresult);
        const followtable=`select * from follows;`
        const followresult=await db.get(followtable);
        console.log("follows table has:",followresult);
    } catch (error) {
      console.error("the error is",error);
    }
   

}
app.listen(port, () => {
    IntializeDatabase();
    console.log(`Server working on port ${port}`);
});

