# 📦 Stackit

A Stack Overflow–style Q&A web application built using **Node.js**, **Express**, **EJS**, and **MySQL**, with clean and responsive frontend using HTML, CSS, and JavaScript.

---

## ✨ Features

- 📝 Ask and answer technical questions
- 🔍 Filter questions by tags
- 👍 Voting system (upvote/downvote)
- 🔒 User authentication
- 📊 Dynamic leaderboard or question popularity
- 📅 Questions ordered by recency

---

## 🛠️ Tech Stack

| Layer     | Tech Used                         |
|-----------|-----------------------------------|
| Frontend  | HTML, CSS, JavaScript             |
| Backend   | Node.js, Express, EJS             |
| Database  | MySQL                             |
| ORM/Query | `mysql2` with async/await         |
| View Engine | EJS Templating                   |

---

## 🚀 Getting Started

### 📦 Prerequisites

- Node.js v18+ (or v22 for full compatibility)
- MySQL server
- Git (optional but recommended)

### 🧑‍💻 Clone & Install

```bash
git clone https://github.com/yourusername/stackit.git
cd stackit
npm install
```

### Database

- Import the database using the db_schema.sql file:

    ```
    mysql -u your_mysql_user -p stackit < db_schema.sql
    ```

- Update database credentials in the db.js file to match your MySQL setup:

    ```node.js
    const db = mysql.createPool({
        host: 'localhost',
        user: 'your_mysql_user',
        password: 'your_mysql_password',
        database: 'stackit',
    });