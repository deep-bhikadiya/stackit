function requireLogin(req, res, next) {
    if (!req.user) {
      return res.status(403).send('You must be logged in to perform this action');
    }
    next();
  }
  
  module.exports = requireLogin;
  