const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const setupDatabase = require('./dbsetup');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser'); 
const app = express();
const PORT = process.env.PORT || 8000;
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());  
const secretKey = 'your_secret_key'; 
app.use('/uploads', express.static('uploads'));
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`)});
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'wpr2201140082',
    port: '3306',
}); 
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });
function setCookie(res, user) {
    res.cookie('user_id', user.id, { httpOnly: true, maxAge: 3600000 });  // Cookie will expire in 1 hour
    res.cookie('user_full_name', user.full_name, { httpOnly: true, maxAge: 3600000 });
}
function authenticate(req, res, next) {
    const userId = req.cookies.user_id;
    const userFullName = req.cookies.user_full_name;
    if (!userId || !userFullName) {
        return res.status(401).send('Unauthorized access');
    } connection.query('SELECT * FROM users WHERE id = ?', [userId], (err, results) => {
        if (err) return res.status(500).send("Database error");

        if (results.length === 0 || results[0].full_name !== userFullName) {
            return res.status(401).send('Unauthorized access');
        }  req.user = results[0];  
           next();  
    });
}
app.get('/', (req, res) => {
    res.render('signin');
});
app.get('/signup', (req, res) => {
    res.render('signup');
});
app.post('/signup', (req, res) => {
    const { fullName, email, password, confirmPassword } = req.body;
    if (password !== confirmPassword) {
        return res.send("Passwords do not match");
    }   connection.query('INSERT INTO users (full_name, email, password) VALUES (?, ?, ?)', 
        [fullName, email, password], (err) => {
            if (err) {
                return res.send("Error: Email already used or invalid data");
            } else {
                res.send("Signup successful. <a href='/'>Sign in</a>");
            }
        });
});
app.post('/signin', (req, res) => {
    const { email, password } = req.body;
    connection.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            console.error(err);
            return res.send('Server error');
        }
        if (results.length === 0 || results[0].password !== password) {
            return res.send('Invalid credentials');
        }
        setCookie(res, results[0]);
        res.redirect('/inbox');
    });
});


app.get('/inbox', authenticate, (req, res) => {
    const page = parseInt(req.query.page) || 1; 
    const limit = 5; 
    const offset = (page - 1) * limit;
    connection.query(
        `SELECT emails.*, users.full_name AS sender_name 
         FROM emails 
         JOIN users ON emails.sender_id = users.id 
         WHERE receiver_id = ? AND receiver_deleted = 0 
         ORDER BY timestamp DESC 
         LIMIT ? OFFSET ?`,
        [req.user.id, limit, offset],
        (err, receivedEmails) => {
            if (err) return res.status(500).send("Lỗi khi lấy email đã nhận");
                connection.query(
                `SELECT COUNT(*) AS count 
                 FROM emails 
                 WHERE receiver_id = ? AND receiver_deleted = 0`,
                [req.user.id],
                (err, result) => {
                    if (err) return res.status(500).send("Lỗi khi đếm tổng số email");

                    const totalEmails = result[0].count;
                    const totalPages = Math.ceil(totalEmails / limit); 

                    res.render('inbox', {
                        emails: receivedEmails,       
                        currentPage: page,             
                        totalPages: totalPages,       
                        userName: req.user.full_name,  
                    });
                }
            );
        }
    );
});
app.get('/compose', authenticate, (req, res) => {
    connection.query('SELECT id, full_name, email FROM users WHERE id != ?', [req.user.id], (err, users) => {
        if (err) return res.status(500).send("Database error");
        
        res.render('compose', { 
            users, 
            userName: req.user.full_name,
            currentPage: 'compose'
        });
    });
});
app.get('/outbox', authenticate, (req, res) => {
    const page = parseInt(req.query.page) || 1; 
    const limit = 5;
    const offset = (page - 1) * limit; 
    connection.query(
        `SELECT emails.*, users.full_name AS receiver_name 
         FROM emails 
         JOIN users ON emails.receiver_id = users.id 
         WHERE sender_id = ? AND sender_deleted = 0 
         ORDER BY timestamp DESC 
         LIMIT ? OFFSET ?`, 
        [req.user.id, limit, offset], 
        (err, emails) => {
            if (err) {
                console.error("Error fetching sent emails:", err);
                return res.status(500).send("Error fetching sent emails");
            }
                connection.query(
                `SELECT COUNT(*) AS count 
                 FROM emails 
                 WHERE sender_id = ? AND sender_deleted = 0`, 
                [req.user.id],
                (err, result) => {
                    if (err) {
                        console.error("Error counting emails:", err);
                        return res.status(500).send("Error counting emails");
                    }

                    const totalEmails = result[0].count;
                    const totalPages = Math.ceil(totalEmails / limit);

                  
                    res.render('outbox', {
                        emails: emails,
                        currentPage: page,
                        totalPages: totalPages,
                        userName: req.user.full_name,
                    });
                }
            );
        }
    );
});
app.get('/email/:id', authenticate, (req, res) => {
    const emailId = req.params.id;
    const userId = req.user.id; 

    connection.query(
        'SELECT * FROM emails WHERE id = ? AND (sender_id = ? OR receiver_id = ?)',
        [emailId, userId, userId],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Error fetching email details");
            }
            if (results.length === 0) {
                return res.status(404).send("Email not found");
            }
            const email = results[0];
            res.render('email_detail', { email: email });
        }
    );
});
app.post('/compose', authenticate, upload.single('attachment'), (req, res) => {
    const { recipient, subject, message } = req.body;
    if (!recipient) return res.status(400).send("No recipient provided");
    connection.query('SELECT * FROM users WHERE email = ?', [recipient], (err, results) => {
        if (err) return res.status(500).send("Database error");
        if (results.length === 0) return res.status(404).send("Recipient not found");
        const receiverId = results[0].id;
        connection.query(
            'INSERT INTO emails (sender_id, receiver_id, subject, body, attachment) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, receiverId, subject || "(no subject)", message || "", req.file ? req.file.filename : null],
            (err) => {
                if (err) return res.status(500).send("Error sending email");
                
                res.redirect('/inbox');
            }
        );
    });
});
app.post('/delete-inbox-email/:emailId', authenticate, (req, res) => {
    const emailId = req.params.emailId;  

    if (!emailId) {
        return res.status(400).send("Email ID is required");
    }
    connection.query(
        'UPDATE emails SET receiver_deleted = 1 WHERE id = ? AND receiver_id = ?',
        [emailId, req.user.id],  
        (err, results) => {
            if (err) {
                return res.status(500).send("Error deleting email");
            }           
            res.redirect('/inbox');
        }
    );
});

app.post('/delete-email/:emailId', authenticate, (req, res) => {
    const emailId = req.params.emailId;
    const userId = req.user.id; 
    connection.query(
        'DELETE FROM emails WHERE id = ? AND sender_id = ?',
        [emailId, userId],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Error deleting email");
            }
            if (results.affectedRows === 0) {
                return res.status(404).send("Email not found or you do not have permission to delete it");
            }
            res.redirect('/outbox');
        }
    );
});
app.get('/signin', (req, res) => {
   res.render('signin'); 
});

app.get('/signout', (req, res) => {

    res.clearCookie('authToken'); 
    req.session = null; 
    res.redirect('/signin');
});

