//WHEN Handlebars IS LOADED BY REQUIRE.JS, Handlebars.templates, which loads
//precompiled templates, is undefined, so have to use this global variable for now.
//No idea why thsi happens
//make sure to use handlebars 4.0.10 for both global and local binary
const handlebars = Handlebars;
var chatAjaxService = require('./service/chatAjaxService.js');
var OnlineView = require('./view/onlineview.js');
var LineView = require('./view/lineview.js');

var SocketView = require('./viewmodel/socketview.js');
var ChatInfo= require('./viewmodel/chatinfo.js');
var TypingView = require('./viewmodel/typingview.js');

var NotifView = require('./viewmodel/notifview.js');
var ChatView = require('./viewmodel/chatview.js');
var ChatViewModel = require('./chatViewModel.js');

var DirectChatView = require('./viewmodel/directChatView.js');
var OnlineViewModel = require('./viewmodel/onlineview.js');
var VotingView = require('./viewmodel/votingview.js');

function parseID(url) {
    var str = url;
    if(str.charAt(str.length - 1) === '/') {
        str = str.substring(0, str.length - 1);
    }

    return str.split("/")[2];
}

function cutSlash(url) {
    var str = url;
    if(str.charAt(str.length - 1) === '/') {
        return str.substring(0, str.length - 1);
    }
    return str;
}

function displayLines(chatList, handlebars, lines, display) {
    for(var i = 0; i < lines.length; i++) {
        var html, template;
        if(lines[i].direction === "right") {
            template = handlebars.templates.message_template(lines[i]);
        }
        else {
            template = handlebars.templates.message_response_template(lines[i]);
        }
        display(template);
    }
}



//XXX this is code is garbage and im sorry to anyone who has to read this 
(function() {
    var reached = false;

    $(document).ready(function() {
        //TODO organize ajax calls
        var csrfTokenObj = {
            _csrf: $('input[name=_csrf]').val()
        };
        var roomID = parseID(window.location.pathname);
        var dependencies = ['chatAjaxService', 'onlineview', 'lineview', 'socketview', 'chatinfo', 
                        'typingview', 'notifview', 'chatview', 'chatviewmodel', 
                        'directChatView', 'onlineviewModel', 'votingview'];

        initializeData(roomID, csrfTokenObj, dependencies);

        //HACK for some reason, require doesnt get called sometimes, so refresh the page if that's the case
    });

    function initializeData(roomID, csrfTokenObj, dependencies) {
        console.log("inside require function");
        reached = true;
        chatAjaxService.chatAjax(cutSlash(window.location.pathname)+'/renderInfo', 'GET', null, function(data) {
            $('.chat-header').remove();
            $('.chat').prepend(handlebars.templates.chatinfo(data));
            //zombie cookie
            console.log("entered userid check");

            if(!sessionStorage.getItem('userid')) {
                console.log("userid not set");
                chatAjaxService.chatAjaxPromise('/home/fetch_home', 'POST', JSON.stringify(csrfTokenObj))
                .then(function(data) {
                    console.log("fetch_home post success");
                    Cookies.set('userid', data.cookie);
                    sessionStorage.setItem('userid', data.cookie);
                })
                .then(function(data) {
                    return ajaxRenderLines(chatAjaxService, csrfTokenObj);

                }).then(function(data) {
                    console.log("initLines post successful");
                    renderLinesCB(data);
                    setup(roomID);
                });
            }
            else {
                ajaxRenderLines(chatAjaxService, csrfTokenObj).then(function(data) {
                    renderLinesCB(data);
                    setup(roomID);
                });
            }
            setUpEvents(chatAjaxService, roomID, csrfTokenObj);
        });

    }

})();

function setUpEvents(chatAjaxService, roomID, csrfTokenObj) {
    $('.remove-user').submit(function(evt) {
        evt.preventDefault();
        var chat_id = $(this).parent().attr('id');

        var postObj = {
            _csrf: csrfTokenObj._csrf,
            chatID: chat_id 
        };
        chatAjaxService.chatAjax('/chats/remove_user', 'POST', JSON.stringify(postObj), 
            function(data) {
                $('#' + chat_id).remove();
                if(parseID(window.location.pathname) === chat_id) {
                    window.location.replace('/home');
                }
        });
    });

    $('.chat-history-group').scroll(function() {
        if($(this).scrollTop() !== 0) { return; }

        var firstMessage = $('.message-data:first');
        var curScroll = firstMessage.offset().top - $(document).scrollTop();
        chatAjaxService.chatAjax(cutSlash(window.location.pathname)+'/loadLines', 'GET', null, 
            function(data) {
                console.log(data);
                if(data.lines === null) {return;}

                var chat = $('.chat-history-group');
                var chatList = chat.find('ul');

                //we want to prepend to beginning of list, since scrolling up
                displayLines(chatList, handlebars, data.lines, function(line) {
                    chatList.prepend(line);
                });

                //TODO dont hardcode this, okay for now
                chat.scrollTop(firstMessage.offset().top - curScroll);
        });
    });
}

function ajaxRenderLines(chatAjaxService, csrfTokenObj) {
    return chatAjaxService.chatAjaxPromise(cutSlash(window.location.pathname)+'/initLines', 'GET', null);
}

function renderLinesCB(data) {
    var chat = $('.chat-history-group');
    var chatList = chat.find('ul');
    displayLines(chatList, handlebars, data.lines, function(line) {
        chatList.append(line);
    });
    chat.scrollTop(chat[0].scrollHeight);
}

function setup(roomID) {

    var userid = sessionStorage.getItem('userid');

    var cvm = new ChatViewModel(userid, roomID, handlebars);
    cvm.initChatNotifs(roomIDs, ChatInfo, SocketView);
    cvm.initTyping(TypingView, SocketView);
    cvm.initChat(SocketView, ChatView, NotifView, OnlineView, DirectChatView);
    cvm.initVoting(SocketView, VotingView);
}
