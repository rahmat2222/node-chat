/**
 * user-password authentication using passport.js
 */
var logger = require('../../util/logger.js')(module);
const password_util = require('./password_util');
const validate_cred_util = require('./validate_cred_util.js');
const connection = require('../database/config.js');
const LocalStrategy = require('passport-local').Strategy;
const crypto = require('crypto');
const UserCache = require('../models/user_cache.js');
const UserManager = require('../models/user_manager.js');
const UserRequest = require('../../microservices/user/user_request.js');
const CleanClient = require('../cache/clean_client.js');

const params = {
    usernameField : 'username', 
    passwordField : 'password',
    passReqToCallback : true
};
//middleware need to return next function
function checkLoggedOut(req, res, next) {
    logger.debug(req.user);
    logger.debug(req.session.user);
    if(!req.isAuthenticated()) {
        res.redirect('/');
    }
    else if(parseInt(req.user.confirmed) === 0) {
        return res.redirect('/signup_success');
    }
    else {
        req.user.url = req.session.user.url;
        delete req.session.user.hash;
        delete req.user.hash;
        //need to return next to pass on to the next function,
        //but only do it if we are logged in. Don't do this
        //if we redirected, because that wiil send headers twice
        return next();
    }
}
function checkOwnUser(req, res, next) {
    //TODO verify session token as well
    req.user.url = req.session.user.url;
    if(req.user.username !== req.params.username) {
        return res.redirect('/users/'+req.user.username);
    }

    return next();
}
function checkLoggedIn(req, res, next) {
    if(req.isAuthenticated()) {
        req.user.url = req.session.user.url;
        res.redirect('/home');
    }
    else {
        return next();
    }
}

function passportSignupCallback(passport, req, res, next) {
    passport.authenticate('signup', function(err, user, info) {
        if(err) {
            logger.error(err);
            res.status(200).json({
                signup_error : true,
                error: err
            });
            return;
        }

        if(!user) {
            res.status(200).json({
                signup_error : true,
                error: "Error signing up, please try again."
            });
            return;
        }
        req.login(user, function(err) {
            if(err) {
                logger.error(err);
                return;
            }
            req.session.sent = false;
            req.session.user = user;
            res.status(200).json({signup_error : false});
        });
    })(req, res, next);
}

function passportAuthCallback(passport, req, res, next) {
    passport.authenticate('login', function(err, user, info) {
        if(err) {
            logger.error(err);
            return;
        }
        if(!user) {
            res.send({login_error : true});
            return;
        }

        req.login(user, function(err) {
            if(err) { logger.error(err); }
            
            req.session.sent = false;
            res.status(200).json({login_error : false});
        });

    })(req, res, next);
}

function logOut(req, res) {
    req.logout();
    req.session.destroy(function(err) {
        logger.info("destroyed");
        res.redirect('/login');
    });
}

function checkExistingUser(req, res) {

    if(!validate_cred_util.validateUsername(req.body.username)) {
        res.send("Username must be at least 5 characters long.");
        return;
    }

    connection.execute('SELECT COUNT(User.username) AS count FROM User WHERE User.username = ? ', [req.body.username], function(rows) {
        if(rows[0].count > 0) {
            res.send("Username exists.");
        }
        else {
            res.send("");
        }
    });
}

function passportAuth(passport) {

    //functions for serializing and deserializing users for session
    passport.serializeUser(function(user, done) {
        logger.info("serializing user");
        //serialize user by username key, so easy to look up in redis
        done(null, user.username);
    });

    passport.deserializeUser(function(username, done) {
        logger.info("deserializing user");
        //NOTE when deserializing user, check cache first, also we are releasing connection
        
        var conn = null;
        var setConn = function(poolConnection) {
            conn = poolConnection;
            return conn;
        };
        var userCache = new UserCache(username);
        var read = userCache.read();

        var end = function(result) {
            logger.debug("releasing connection from deserliazation");
            connection.release(conn);
            if(result.length === 0) {
                return done(null, false);
            }
            return done(null, result[0]);
        };
        connection.executePoolTransaction([setConn, read, end], function(err) {
            throw err;
        });
    });

    passport.use('signup', new LocalStrategy({
        usernameField: 'user_signup',
        passwordField: 'password_signup', passReqToCallback: true
    }, function(req, user_signup, password_signup, done) {
            var info = {
                id: crypto.randomBytes(10).toString('hex'),
                username: user_signup,
                password: password_signup,
                first: req.body.firstname_signup,
                last: req.body.lastname_signup,
                email: req.body.email
            };

            if(!validate_cred_util.validateUsername(info.username)) {
                return done(null, false, req.flash('error', 'Signup error.'));
            }

            //TODO add stronger password checker
            if(!validate_cred_util.validatePassword(info.password)) {
                //TODO less lazy error message lmao
                return done(null, false, req.flash('error', 'Signup error.'));
            }

            //var user_manager = new UserManager(new UserCache(user_signup, info.id, info.password, info.first, info.last, info.email));

            var signupFailure = function() {
                return done("Username exists", false, req.flash('signup_error', 'There was an error signing up'));
            };
            var signupSuccess = function(userObj) {
                req.session.user = userObj; 
                req.session.members = {};
                //this is added in database and cache as well
                return done(null, userObj);
            };
            //user_manager.signup(password_signup, signupFailure, signupSuccess);

            var clean_client = new CleanClient();
            var user_request = new UserRequest(clean_client.genClient());
            user_request.signupRequest(info, function(channel, user) {
                if(user.signup_error) {
                    signupFailure();
                }
                else {
                    signupSuccess(user);
                }
                clean_client.cleanup();
            });
        }
    ));

    passport.use('login', new LocalStrategy(params, function(req, username, password, done) {
        var loginResult = function(user) {
            if(!user) {return done(null, false, req.flash('error', 'Login error.')); }
            req.session.user = user;
            //req.session.rooms = [];
            req.session.members = {};
            return done(null, user);
        };
        //var user_manager = new UserManager(new UserCache(username));
        var clean_client = new CleanClient();
        var user_request = new UserRequest(clean_client.genClient());
        user_request.authenticateRequest(username, password, function(channel, user) {
            loginResult(user);
            clean_client.cleanup();
        });
        //user_manager.authenticate(password, loginResult);
    }));
}

module.exports = {
    logOut,
    checkLoggedOut,
    checkLoggedIn,
    checkOwnUser,
    passportSignupCallback,
    checkExistingUser,
    passportAuth,
    passportAuthCallback
};
