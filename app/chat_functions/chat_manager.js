const connection = require('../database/config.js');
const crypto = require('crypto');
const sql = require('promise-mysql');

var Chat =  require('../models/chat.js');
var User =  require('../models/user.js');

//TODO use async library to make things more asynchronous

var ChatManager = (function() {
    function ChatManager(chatobj) {
        this.chat_obj = chatobj;
    }

    ChatManager.prototype.loadChatLists = function (userObj, res) {
        //TODO error checking
        var chatobj = new Chat();
        chatobj.loadLists(new User(userObj.username), function(rows) {
            var info = {
                username: userObj.username,
                first: userObj.first,
                last: userObj.last,
                list: rows
            };
            res.render('home', info);
        });
    }

    ChatManager.prototype.joinChat = function(members, username, chatCode, res) {
        var chatobj = new Chat();
        chatobj.setCode(chatCode);

        var sessionStore = function(chatobj) {
            //result is the lines, or null
            return function(result) {
                if(result == null) {
                    //TODO error message
                    res.redirect('/home');
                    return null;
                }
                //TODO FIX THIS SHIT
                members[chatobj.getID()] = chatobj.renderAll(username, 0, result);
                res.redirect('/chats/' + chatobj.getID());
            };
        }
        chatobj.join(new User(username), sessionStore);
    }

    ChatManager.prototype.loadChat = function(members, username, chatID, res) {
        var transport = function(chatObj, notifObj, lineObj) {
            return function(lineResults) {
                if(lineResults == null) {
                    //TODO add error message here
                    res.redirect('/home');
                    return null;
                }
                var info = chatObj.renderAll(username, notifObj.getNumNotifications(), lineResults);
                members[info.id] = info;
                res.render('chat', info);
            };
        };
        var chatobj = new Chat(chatID);
        chatobj.load(new User(username), transport);
    }

    ChatManager.prototype.createChat = function(res, members, chatName, username) {
        var chatInfo = {
            id: crypto.randomBytes(8).toString('hex'),
            chat_name: chatName,
            code: crypto.randomBytes(3).toString('hex')
        };

        var chat = new Chat(chatInfo.id, chatInfo.chat_name, chatInfo.code);

        chat.insert(new User(username), function(result) {
            var info = chat.render();
            members[chat.getID()] = info;
            res.redirect('/chats/' + chat.getID());
        });

        return chatInfo;
    }

    return ChatManager;
})();


module.exports = ChatManager;
