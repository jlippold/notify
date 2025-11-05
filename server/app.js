const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const authRoutes = require('./routes/auth');
const pushRoutes = require('./routes/push');
const topicsRoutes = require('./routes/topics');
const publishRoutes = require('./routes/publish');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true },
  })
);

app.get('/', (req, res) => {
  res.status(200).send('OK');
});

app.use('/auth', authRoutes);
app.use('/push', pushRoutes);
app.use('/topics', topicsRoutes);
app.use('/publish', publishRoutes);

const port = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${port}`);
  });
}

module.exports = app;


