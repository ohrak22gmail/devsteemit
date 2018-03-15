'use strict';
var steem = require('steem')
var fs = require('fs');
var config = require('./config.json')
var author = 'paybackbot';
var permlink = new Date().toISOString().replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();

console.log('Start');

var arr = [];
var obj = {
    "lastCommentTime": "",
    "permlinkList": []
}

function update() {
    getReward();

    fs.readFile('./commentData.json', 'utf-8', function (error, data) {
        obj = JSON.parse(data);
        obj.permlinkList.push(permlink);
        var nextTime = new Date(obj.lastCommentTime);
        nextTime.setHours(nextTime.getHours() + 1);
        var now = new Date();

        if (now > nextTime) {
            console.log('can comment');
            broadcastComment();
        }
        else {
            console.log("you need 1 hours");
        }
    });

    payout();
}
setInterval(update, 3 * 60 * 60 * 1000);

function broadcastComment() {
    steem.broadcast.comment(
        config.post,
        '', // Parent Author
        'kr', // Parent Permlink
        author, // Author
        permlink, // Permlink
        '페이백 봇 테스트 #1', // Title
        '<html>\n<p>&nbsp;&nbsp;소개</p>\n<p>&nbsp;\n<p>보팅을 하시면 페이아웃 후 저자보상으로 받은 스팀달러를 보팅 기여도에 따라 차등 분배하여 보내드립니다. &nbsp;&nbsp;</p>\n<p>테스트 기간 중에는 보상이 정상적으로 지급되지 않을 수 있습니다. &nbsp;&nbsp;</p>\n<p>&nbsp;&nbsp;개발내역</p>\n<p>&nbsp;\n<p>1.자동 포스팅.&nbsp;&nbsp;</p>\n<p>&nbsp;\n<p>2.자동 보상받기.&nbsp;&nbsp;</p>\n<p>&nbsp;\n<p>3.자동 보상송금.&nbsp;&nbsp;</p>\n</html>', // Body
        { tags: ['paybackbot'] }, // Json Metadata
        function (err, result) {
            console.log(err, result);
            if (err) {
                throw err;
            }
            else {
                // comment에 성공하면 리스트에 저장한다. 나중에 보상에 성공하면 지워준다.
                fs.readFile('./commentData.json', 'utf-8', function (error, data) {
                    obj = JSON.parse(data);
                    if (obj.permlinkList.indexOf(permlink) > -1) {
                        obj.permlinkList.push(permlink);
                    }
                    obj.lastCommentTime = new Date().toISOString();
                    fs.writeFile('./commentData.json', JSON.stringify(obj), function (err) {
                        if (err)
                            throw err;
                        console.log('File write completed');
                    });
                });
            }
        }
    );
}

function getReward() {
    steem.api.getAccounts([author], function (err, response) {
        if (err) {
            console.log("ERROR: Something Went Wrong Grabbing @" + author + "'s Account Info!");
        }
        if (response) {
            console.log("response: " + JSON.stringify(response));
            rewardvests = response[0];
            rv = rewardvests["reward_vesting_balance"];
            rvnum = parseFloat(rv);
            rs = rewardvests["reward_vesting_steem"];
            rd = rewardvests["reward_sbd_balance"];
            console.log("Pending Rewards: " + rd + " / " + rs + " / " + rv);
            if (rvnum > 0) {
                console.log("Pending Rewards Found! Claiming Now!");
                steem.broadcast.claimRewardBalance(config.post, author, '0.000 STEEM', '0.000 SBD', rv, function (err, result) {
                    if (err) {
                        console.log("ERROR Claiming Rewards! :(");
                        console.log(err);
                    }
                    if (result) {
                        console.log("Woot! Rewards Claimed!");
                    }
                });
            }
        }
    });
}



function payout() {

    fs.readFile('./commentData.json', 'utf-8', function (error, data) {
        obj = JSON.parse(data);
        for (var i = obj.permlinkList.length - 1; i >= 0; i--) {
            steem.api.getContent(author, obj.permlinkList[i], function (err, result) {
                console.log(err, result);
                if (err) {
                    throw err;
                }
                else if (result) {
                    var arr = result.total_payout_value.split(' ');
                    var total_payout_value = parseFloat(arr[0]);
                    if (total_payout_value > 0.001) { // SBD                        
                        var reward_balance, recent_claims, basePrice, retSBD;
                        var msg = "total # of voter : " + result.active_votes.length;    // voters 수를 출력
                        console.log(msg);
                        // 보상 풀에 있는 reward 잔액과 보상할 금액 정보 얻기
                        steem.api.getRewardFund("post", function (err, rewardFund) {
                            reward_balance = parseFloat(rewardFund.reward_balance.split(' '))
                            recent_claims = parseInt(rewardFund.recent_claims)
                            steem.api.getCurrentMedianHistoryPrice(function (err, historyPrice) {
                                var basePrice = parseFloat(historyPrice.base.split(' '))
                                var quotePrice = parseFloat(historyPrice.quote.split(' '))
                                basePrice = basePrice / quotePrice      // feed_price 구함
                                for (var i = 0; i < result.active_votes.length; i++) {   // voters 수 만큼 반복
                                    var rshares = parseInt(result.active_votes[i].rshares)   // i번째 voter가 준 shares 값
                                    // rshares를 SBD로 변환
                                    retSBD = ((reward_balance / recent_claims) * basePrice * rshares).toFixed(2)
                                    var str = result.active_votes[i].voter + ' :  $' + retSBD + ' : ' + result.active_votes[i].rshares;
                                    console.log(str);
                                    if (retSBD > 0.001) {
                                        //transfer(result.active_votes[i].voter, retSBD);
                                    }
                                }
                            });
                        });

                        obj.permlinkList.splice(i, 1);
                        fs.writeFile('./commentData.json', JSON.stringify(obj), function (err) {
                            if (err)
                                throw err;
                            console.log('File write completed2');
                        });
                    }
                }
            });

            //steem.api.getActiveVotes(author, obj.permlinkList[i], function (err, voters) {
            //    var reward_balance, recent_claims, basePrice, retSBD;
            //    var msg = "total # of voter : " + voters.length;    // voters 수를 출력
            //    console.log(msg);
            //    // 보상 풀에 있는 reward 잔액과 보상할 금액 정보 얻기
            //    steem.api.getRewardFund("post", function (err, rewardFund) {
            //        reward_balance = parseFloat(rewardFund.reward_balance.split(' '))
            //        recent_claims = parseInt(rewardFund.recent_claims)
            //        steem.api.getCurrentMedianHistoryPrice(function (err, historyPrice) {
            //            var basePrice = parseFloat(historyPrice.base.split(' '))
            //            var quotePrice = parseFloat(historyPrice.quote.split(' '))
            //            basePrice = basePrice / quotePrice      // feed_price 구함
            //            for (var i = 0; i < voters.length; i++) {   // voters 수 만큼 반복
            //                var rshares = parseInt(voters[i].rshares)   // i번째 voter가 준 shares 값
            //                // rshares를 SBD로 변환
            //                retSBD = ((reward_balance / recent_claims) * basePrice * rshares).toFixed(2)
            //                var str = voters[i].voter + ' :  $' + retSBD + ' : ' + voters[i].rshares;
            //                console.log(str);
            //                if (retSBD > 0.001) {
            //                    transfer(voters[i].voter, retSBD);
            //                }
            //            }
            //        });
            //    });
            //});
        }
        
    });
}

function transfer(name, value) {

    steem.broadcast.transfer(config.active, author, name, value + ' SBD', 'paybackbot reward', function (err, result) {
        console.log(err, result);
        if (err) {

        }
        else if (result) {

        }
    });
}
