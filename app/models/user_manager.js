var logger = require('../../util/logger.js')(module);
var UserCache = require('./user_cache.js');
var cache_functions = require('../cache/cache_functions.js');
var connection = require('../database/config.js');
var password_util = require('../authentication/password_util.js');

var UserManager = function(userObj) {
    this._userObj = userObj;
}; 

UserManager.prototype.leave = function(chat_id, callback) {
    this._userObj.leaveChat(chat_id, callback);
};

//FIXME refactor this to use redis promises (bluebird) 
UserManager.prototype.signup = function(password, signupFailure, signupSuccess) {
    var that = this;
    password_util.storePassword(password, function(err, hash) {
        that._userObj.setPassword(hash);
        that._userObj.insert(function(userObj) {
            var jsonObj = userObj;
            delete jsonObj.password;
            return signupSuccess(jsonObj);
        },
        function(err) {
            return signupFailure();
        });
    });
};

UserManager.prototype.authenticate = function(password, loginResult) {
    var conn = null;
    var inCache = false;
    var user = this._userObj;
    var setConn = function(poolConnection) { conn = poolConnection; return poolConnection; };
    //will handle caching
    var checkDB = user.read();

    var sqlUser = null;
    var validate = function(rows) {
        if(rows.length === 0) {
            return null;
        }
        sqlUser = rows[0];
        return rows[0];
    };
    var retrievePassword = function(result) {
        if(!result) { return null; }
        return password_util.retrievePassword(password, result.password, null, true);
    };

    var loginValidate = function(result) {
        logger.debug("releasing connection");
        connection.release(conn);

        if(!result) { return null; }
        delete sqlUser.password;
        return sqlUser;
    };
    connection.executePoolTransaction([setConn, checkDB, validate, retrievePassword, loginValidate, loginResult], function(err) {logger.error(err);});
};

UserManager.prototype.authenticateEmail = function(userJSON, hash, callback) {
    this._userObj.confirmEmail(userJSON, hash, function(rows) {
        callback(rows);
    });   
};

UserManager.prototype.updatePassword = function(oldPass, newPass, callback) {
    var that = this;
    this._userObj.confirmPassword(oldPass, function(result) {
        if(!result) {
            return callback(result);
        }
        password_util.storePassword(newPass, null, true)
        .then(function(hash) {
            that._userObj.setPassword(hash);
            that._userObj.changePassword(function(rows) {
                callback(result);
            });
            return null;
        });
    });
};

UserManager.prototype.updateUserProfile = function(infoObj, sessionObj, callback) {
    this._userObj.updateSettings(infoObj, sessionObj, function(rows) {
        callback(rows);
    });
};

module.exports = UserManager;
