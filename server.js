const express = require('express');
const db = require('./db');
const requireLogin = require('./authMiddleware');
const app = express();
const PORT = 3000;
const session = require('express-session');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads'),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, unique + ext);
    }
    });

    const upload = multer({ storage });


app.use(session({
  secret: ']MP<;qz](fk2*bb',
  resave: false,
  saveUninitialized: false,
}));

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
  });

  
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

  app.get('/signup', (req, res) => {
    res.render('signup', { title: 'Sign Up' });
  });

  app.post('/signup', upload.single('profile'), async (req, res) => {
    const { username, email, password } = req.body;
  
    const hashedPassword = await bcrypt.hash(password, 10);
    const profileImage = req.file ? `/uploads/${req.file.filename}` : null;
  
    try {
      await db.execute(`
        INSERT INTO users (username, email, password_hash, profile_image)
        VALUES (?, ?, ?, ?)
      `, [username, email, hashedPassword, profileImage]);
  
      res.redirect('/login');
    } catch (err) {
      console.error(err);
      res.render('signup', { title: 'Sign Up', error: 'Username or email already exists' });
    }
  });
  

    app.get('/login', (req, res) => {
        res.render('login', { title: 'Login' });
    });
      
    app.post('/login', async (req, res) => {
        const { username, password } = req.body;
      
        const [[user]] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
      
        if (!user) {
          return res.render('login', { title: 'Login', error: 'Invalid username or password' });
        }
      
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
          return res.render('login', { title: 'Login', error: 'Invalid username or password' });
        }
      
        req.session.user = {
          id: user.id,
          username: user.username,
          profile_image: user.profile_image
        };
      
        res.redirect('/');
    });

    app.get('/logout', (req, res) => {
        req.session.destroy(() => {
          res.redirect('/');
        });
    });
      
      

    app.get('/', async (req, res) => {
        const { filter, tag } = req.query;
        const params = [];
        let query = `
          SELECT 
            q.*, 
            COALESCE(SUM(CASE v.vote_type 
              WHEN 'up' THEN 1 
              WHEN 'down' THEN -1 
              ELSE 0 END), 0) AS vote_count
          FROM questions q
          LEFT JOIN question_votes v ON q.id = v.question_id
        `;
      
        if (filter === 'unanswered') {
          query += `
            LEFT JOIN answers a ON q.id = a.question_id
            GROUP BY q.id
            HAVING COUNT(a.id) = 0
          `;
        } else {
          query += ` GROUP BY q.id`;
        }
      
        if (tag) {
            query = `SELECT * FROM (${query}) AS filtered WHERE FIND_IN_SET(?, filtered.tags) ORDER BY filtered.created_at DESC`;
            params.push(tag);
        } else if (filter !== 'unanswered') {
            query += ` ORDER BY q.created_at DESC`;
        }
      
        const [questions] = await db.execute(query, params);
      
        res.render('index', {
          title: 'Stackit - Home',
          questions,
          user: req.session.user,
          filter: filter || 'newest',
          tag
        });
      });
      
  

  app.get('/ask', requireLogin, (req, res) => {
    res.render('ask', { title: 'Ask Question', user: req.session.user });
  });
  

app.post('/ask', requireLogin, async (req, res) => {
const { title, description, tags } = req.body;

const user = req.session.user.username;

  try {
    await db.execute(
      'INSERT INTO questions (title, description, tags, user) VALUES (?, ?, ?, ?)',
      [title, description, tags.join(','), user]
    );

    res.redirect('/');
  } catch (err) {
    console.error('DB Error:', err);
    res.status(500).send('Something went wrong');
  }

});

app.get('/question/:id', async (req, res) => {
    const { id } = req.params;
  
    const [qResult] = await db.execute('SELECT * FROM questions WHERE id = ?', [id]);
  
    if (qResult.length === 0) {
      return res.status(404).render('404', { message: 'Question not found' });
    }
    const question = qResult[0];

    const [[{ vote_count }]] = await db.execute(`
        SELECT COALESCE(SUM(CASE vote_type 
          WHEN 'up' THEN 1 
          WHEN 'down' THEN -1 
          ELSE 0 END), 0) AS vote_count
        FROM question_votes
        WHERE question_id = ?
      `, [id]);
    
      question.vote_count = vote_count;

    const [answers] = await db.execute(`
      SELECT 
        a.*, 
        COALESCE(SUM(CASE v.vote_type 
          WHEN 'up' THEN 1 
          WHEN 'down' THEN -1 
          ELSE 0 END), 0) AS vote_count
      FROM answers a
      LEFT JOIN answer_votes v ON a.id = v.answer_id
      WHERE a.question_id = ?
      GROUP BY a.id
      ORDER BY a.created_at ASC
    `, [id]);
  
    res.render('question', {title: question.title, question, answers, user: req.session.user });
  });
  
  

  app.post('/question/:id/answer', requireLogin,  async (req, res) => {  
    const { answer } = req.body;
    const user = req.session.user.username;
  
    await db.execute(
      'INSERT INTO answers (question_id, content, user) VALUES (?, ?, ?)',
      [req.params.id, answer, user]
    );
  
    res.redirect(`/question/${req.params.id}`);
  });

  app.post('/answer/:id/vote', requireLogin, express.json(), async (req, res) => {
    const { id } = req.params;
    const { type } = req.body;
    const user = req.session.user.username;
  
    try {
      
      const [[existing]] = await db.execute(
        'SELECT vote_type FROM answer_votes WHERE user = ? AND answer_id = ?',
        [user, id]
      );
  
      let voteChange = 0;
  
      if (!existing) {
        voteChange = type === 'up' ? 1 : -1;
        await db.execute(
          'INSERT INTO answer_votes (user, answer_id, vote_type) VALUES (?, ?, ?)',
          [user, id, type]
        );
      } else if (existing.vote_type === type) {
        return res.json({ success: true, newVotes: null }); 
      } else {
        voteChange = type === 'up' ? 2 : -2;
        await db.execute(
          'UPDATE answer_votes SET vote_type = ? WHERE user = ? AND answer_id = ?',
          [type, user, id]
        );
      }
  
      const [[updated]] = await db.execute(`
        SELECT 
          a.id,
          COALESCE(SUM(CASE v.vote_type 
            WHEN 'up' THEN 1 
            WHEN 'down' THEN -1 
            ELSE 0 END), 0) AS vote_count
        FROM answers a
        LEFT JOIN answer_votes v ON a.id = v.answer_id
        WHERE a.id = ?
        GROUP BY a.id
      `, [id]);
      
  
      res.json({ success: true, newVotes: updated.vote_count });
  
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false });
    }
  });
  
  
  app.post('/answer/:id/accept', requireLogin, express.json(), async (req, res) => {
    const { id } = req.params;
  
    const [[answer]] = await db.execute(`
      SELECT a.question_id, q.user
      FROM answers a
      JOIN questions q ON a.question_id = q.id
      WHERE a.id = ?
    `, [id]);
  
    if (!answer || answer.user !== req.session.user.username) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }
  
    await db.execute('UPDATE answers SET is_accepted = false WHERE question_id = ?', [answer.question_id]);
    await db.execute('UPDATE answers SET is_accepted = true WHERE id = ?', [id]);
  
    res.json({ success: true, acceptedId: id });
  });

  app.post('/question/:id/vote', requireLogin, express.json(), async (req, res) => {
    const { id } = req.params;
    const { type } = req.body;
    const user = req.session.user.username;
  
    try {
      const [[existing]] = await db.execute(
        'SELECT vote_type FROM question_votes WHERE user = ? AND question_id = ?',
        [user, id]
      );
  
      let voteChange = 0;
  
      if (!existing) {
        voteChange = type === 'up' ? 1 : -1;
        await db.execute(
          'INSERT INTO question_votes (user, question_id, vote_type) VALUES (?, ?, ?)',
          [user, id, type]
        );
      } else if (existing.vote_type === type) {
        return res.json({ success: true, newVotes: null }); 
      } else {
        voteChange = type === 'up' ? 2 : -2;
        await db.execute(
          'UPDATE question_votes SET vote_type = ? WHERE user = ? AND question_id = ?',
          [type, user, id]
        );
      }
  
      const [[{ vote_count }]] = await db.execute(`
        SELECT 
          COALESCE(SUM(CASE vote_type 
            WHEN 'up' THEN 1 
            WHEN 'down' THEN -1 
            ELSE 0 END), 0) AS vote_count
        FROM question_votes
        WHERE question_id = ?
      `, [id]);
  
      res.json({ success: true, newVotes: vote_count });
  
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false });
    }
  });
  
  
  

  

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
