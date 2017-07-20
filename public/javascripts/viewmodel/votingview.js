define(['socketview'], function(socketview) {
    return {
        VotingView: (function() {

            function VotingView(userid, socketview) {
                this._userid = userid;
                this._socketview = socketview;
                //TODO refactor joinRoom in voteview to a super class or something
                this._socketview.joinRoom();
            }

            VotingView.prototype.setReceiveListener = function(displayVote) {
                this._socketview.addListener('vote', function(data) {
                    //console.log("received vote from", data);
                    displayVote(data);
                });
            };

            VotingView.prototype.setSubmitListener = function(voteElement, selector) {
                var that = this;
                console.log(selector);

                voteElement.on('click', selector, function(event) {
                    //FIXME this is ratchet as fuck omg
                    var line_id = $(event.target).parent().parent().attr('lineid');
                    event.preventDefault();

                    that._socketview.send('vote', {
                        userid: that._userid,
                        line_id: line_id
                    });
                });
            };

            return VotingView;
        })()
    };
});
