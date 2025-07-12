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

app.get('/question/:id', async (req, res) => {
    const { id } = req.params;
  
    const [qResult] = await db.execute('SELECT * FROM questions WHERE id = ?', [id]);
  
    if (qResult.length === 0) {
      return res.status(404).render('404', { message: 'Question not found' });
    }
    const question = qResult[0];
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
  
    res.render('question', {title: question.title, question, answers, user: req.user });
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

  app.post('/answer/:id/vote', requireLogin, express.json(), async (req, res) => {
    const { id } = req.params;
    const { type } = req.body;
    const user = req.user.username;
  
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
  
    if (!answer || answer.user !== req.user.username) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }
  
    await db.execute('UPDATE answers SET is_accepted = false WHERE question_id = ?', [answer.question_id]);
    await db.execute('UPDATE answers SET is_accepted = true WHERE id = ?', [id]);
  
    res.json({ success: true, acceptedId: id });
  });
  
  

  

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
