const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const routes = require('./routes/index')
const index = routes
const users = require('./routes/users');
const app = express();
const passport = require('passport');
const session = require('express-session');

// view engine setup
app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

//handles back button problem of caching- reloads page every time to persist session
app.use(function(req, res, next) {
    res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
    next()
})

app.use(session({
    secret: 'asdfog7bsfdogbsfdg',
    resave: true,
    saveUninitialized: true
 } )); // session secret

app.use(passport.initialize());
app.use(passport.session());
app.use('/', index);
app.use('/users', users);
//require('./app/authentication/user-pass.js')(passport)

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

//var server = app.listen(3000)
//initialize passport and persistent login session


//index.post('/login', passport.authenticate('login', {
        //successRedirect: '/home',
        //failureRedirect : '/',
        //failureFlash : false
    //}
//));
module.exports = app;
