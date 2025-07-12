const express = require('express');
const db = require('./db');
const requireLogin = require('./authMiddleware');
const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));


app.use((req, res, next) => {
    req.user = {
      id: 'u123',
      username: 'demo_user'
    };
    next();
  });

app.get('/', async (req, res) => {
    const [questions] = await db.execute('SELECT * FROM questions ORDER BY created_at DESC');
    res.render('index', { title: 'Stackit - Home', questions });
});

app.get('/ask', (req, res) => {
    res.render('ask', { title: 'Ask a Question' });
});

app.post('/ask', requireLogin, async (req, res) => {
const { title, description, tags } = req.body;

const user = req.user.username;

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

app.get('/question/:id',  async (req, res) => {
    const [qRows] = await db.execute('SELECT * FROM questions WHERE id = ?', [req.params.id]);
    if (!qRows.length) return res.status(404).send('Question not found');
  
    const [answers] = await db.execute('SELECT * FROM answers WHERE question_id = ? ORDER BY created_at ASC', [req.params.id]);
  
    res.render('question', {
      title: qRows[0].title,
      question: qRows[0],
      answers,
      user: req.user
    });
  });

  app.post('/question/:id/answer', requireLogin,  async (req, res) => {  
    const { answer } = req.body;
    const user = req.user.username;
  
    await db.execute(
      'INSERT INTO answers (question_id, content, user) VALUES (?, ?, ?)',
      [req.params.id, answer, user]
    );
  
    res.redirect(`/question/${req.params.id}`);
  });
  

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
