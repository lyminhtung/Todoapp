const mysql = require('mysql2');
function setupDatabase() {
    const connection = mysql.createConnection({
        host: 'localhost',
        user: 'wpr',
        port: '3306',
        password:'fit2024'
        
    });
    connection.query('DROP DATABASE IF EXISTS `wpr2201140082`', (err, results) => {
        if (err) return;
        
        connection.query('CREATE DATABASE IF NOT EXISTS `wpr2201140082`', (err, results) => {
            if (err) return;
            
            connection.query('USE `wpr2201140082`', (err, results) => {
                if (err) return;
                connection.query(`
                    CREATE TABLE IF NOT EXISTS users (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        full_name VARCHAR(255) NOT NULL,
                        email VARCHAR(255) NOT NULL UNIQUE,
                        password VARCHAR(255) NOT NULL
                    )
                `, (err, results) => {
                    if (err) return;
                    connection.query(`
                        CREATE TABLE IF NOT EXISTS emails (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            sender_id INT NOT NULL,
                            receiver_id INT NOT NULL,
                            subject VARCHAR(255),
                            body TEXT,
                            attachment VARCHAR(255),
                            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                            sender_deleted TINYINT DEFAULT 0,
                            receiver_deleted TINYINT DEFAULT 0,
                            FOREIGN KEY (sender_id) REFERENCES users(id),
                            FOREIGN KEY (receiver_id) REFERENCES users(id)
                        )
                    `, (err, results) => {
                        if (err) return;
                        connection.query(`
                            INSERT INTO users (full_name, password, email)
                            VALUES
                                ("Tung", "123123", "tung1@gmail.com"),
                                ("Hoang", "123123", "to@gmail.com"),
                                ("User A", "123", "a@a.com")
                        `, (err, results) => {
                            if (err) return;
                            connection.query(`
                                INSERT INTO emails (sender_id, receiver_id, subject, body)
                                VALUES
                                    (3, 1, "Hello Tung", "This is a message from User A to Tung."),
                                    (3, 2, "Project Update", "Sending updates on the project."),
                                    (1, 3, "Re: Hello", "This is a reply from Tung to User A."),
                                    (2, 3, "Meeting Schedule", "Hi User A, let's schedule a meeting."),
                                    (2, 1, "Question", "I have a question regarding the new policy."),
                                    (3, 2, "Follow-up", "Following up on our last conversation."),
                                    (1, 2, "Notice", "Important notice regarding system update."),
                                    (2, 3, "Feedback Request", "Please provide feedback on the recent changes.")
                            `, (err, results) => {
                                if (err) return;
                                connection.end();  
                            });
                        });
                    });
                });
            });
        });
    });
}

setupDatabase();
