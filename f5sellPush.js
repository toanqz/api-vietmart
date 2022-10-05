var request = require('request');
var apn = require('node-apn-http2');
var fs = require('fs');
var util = require('util');
var striptags = require('striptags');

const oracledb = require('oracledb');
var OneSignal = require('onesignal-node');

const EventEmitter = require("events").EventEmitter;
EventEmitter.prototype._maxListeners = 0;

let Push = new EventEmitter();

var dbConfig = require('./f5sellConfig.js');
var myCrypto = require('./myCrypto.js');

var curr_push_file = __dirname + '/push/'+myCrypto.getDate(new Date())+'.log';
var log_push = fs.createWriteStream(curr_push_file, { flags: 'a' });

var log_stdout = process.stdout;
console.log = function (d) { 
	var timeCurrent = myCrypto.getDateTime(new Date());
	var new_push_file = __dirname + '/push/'+myCrypto.getDate(new Date())+'.log';
	
	if(new_push_file !== curr_push_file){
		curr_push_file = new_push_file
		log_push = fs.createWriteStream(curr_push_file, { flags: 'a'});
	}
	log_stdout.write(timeCurrent + " :" + util.format(d) + '\n');
};

var log_console = fs.createWriteStream(__dirname + '/push/push_console.log', { flags: 'a'});

console.warn = function (d) { 
	var timeCurrent = myCrypto.getDateTime(new Date());
	log_stdout.write(timeCurrent + ": " + util.format(d) + '\n');
	log_console.write(timeCurrent + ": PushSender " + util.format(d) + '\n');
};

var isConnectedToOracle = false;
var oraClient = null;

process.on('uncaughtException', function(err) {
	console.error('UnCaught Exception: ' + err.stack);
});
process.on('unhandledRejection', function (err) {
	console.log('Unhandled Rejection: ' + err);
});
process.on('warning', function(e){
	console.warn(e.stack);
});
process.on('error', function(e){
	console.error(e.stack);
});

Push.on("execUpdate", (message) => {
	try{
		let error_message = "";
		if(typeof message.ERROR_MESSAGE !== undefined){
			error_message = message.ERROR_MESSAGE;
			if(error_message.length > 500) error_message = error_message.substring(0,500);
		}
		console.log('state##########:'+message.STATE);
		var sql = "";
		if(message.STATE==0){
			sql = "update log_push set SENT_TIME=sysdate" +(error_message.length > 0 ? ", ERROR_MESSAGE='"+error_message+"'" : "")+ " where ID=:ID";
		}else{
			sql = "update log_push set STATE=2, SENT_TIME=sysdate" +(error_message.length > 0 ? ", ERROR_MESSAGE='"+error_message+"'" : "")+ " where ID=:ID";
		}
		oraClient.execute(
			sql, 
			{ID: message.ID}, 
			{autoCommit: true},
			function(err, result){
				if(err) console.log(err.stack);
				else console.log("update log_push " + message.ID + ": " + JSON.stringify(result));
			}
		);
	}catch(e){
		console.warn(e.stack);
	}	
});

var iosThread = 0, androidThread = 0, onesignalThread = 0;

Push.on("iosPush", (message) => {
	try{
		iosThread++;
		let startTime = Number(new Date().getTime());
		var note = new apn.Notification();
		var payload = {
			id: message.ID,
			id_user: message.ID_USER,
			state: message.STATE,
			type: message.TYPES
		};
		note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
		note.alert = striptags(myCrypto.decode_1252(message.CONTENT));
		note.payload = payload;
		note.badge = 1;
		note.sound = "default";
		note.topic = message.IOS_BUNDLEID;

		var apnOptions = {
			token: {
				key: dbConfig.ios.key,
				keyId: dbConfig.ios.keyId,
				teamId: dbConfig.ios.teamId,
			},
			production: true
		};
		var apnProvider = new apn.Provider(apnOptions);		
		 console.log(apnOptions);
		 console.log('##############');
		 console.log(message.TOKEN_KEY);
		console.log(message.IOS_BUNDLEID);
		apnProvider.send(note, message.TOKEN_KEY).then((result) => {
		//	console.log(result);
			let state = 1;
			var str = "";
			if(typeof result.sent !== 'undefined' && result.sent.length > 0){
				state = 0;
				str = "SUCCESS"; //JSON.stringify(result.sent[0]);
			}else{
				state = 2;
				if(typeof result.failed !== 'undefined' && result.failed.length > 0){
					var failed = result.failed[0];
					if((typeof failed.error !== 'undefined' && (failed.error.code === 'ETIMEDOUT' || failed.error.code === 'EAI_AGAIN'))
						|| (typeof failed.cause !== 'undefined' && (failed.cause.errno == 'ETIMEDOUT' || failed.cause.errno == 'EAI_AGAIN'))){
						if(typeof message.NUMOFRETRY !== 'undefined' && message.NUMOFRETRY > 5) state = 2;
						else{
							state = 3;
							var numOfRetry = typeof message.NUMOFRETRY === 'undefined' ? 0 : message.NUMOFRETRY;
							message.NUMOFRETRY = numOfRetry + 1;
						}
						str = typeof failed.error.code !== 'undefined' ? failed.error.code : (typeof failed.cause.errno !== 'undefined' ? failed.cause.errno : "ETIMEDOUT");
					}else{
						state = 2;
						if(typeof result.failed[0].error !== 'undefined') str = JSON.stringify(result.failed[0].error);
						else{ 
							str = typeof result.failed[0].status !== 'undefined' ? result.failed[0].status + "|" : "";
							str += typeof result.failed[0].response !== 'undefined' ? result.failed[0].response.reason : JSON.stringify(result.failed[0]);
						}
					}
				}else str = "FAILED";
			}
			apnProvider.shutdown();
			message.STATE = state;
			if(state != 0){
				message["ERROR_MESSAGE"] = str;
				Push.emit("execUpdate", message);
			}else{
				message["ERROR_MESSAGE"] = 'SUCCESS';
				Push.emit("execUpdate", message);
			}
			str = iosThread + " to "+message.ID_USER +" (ios) " +str + " time="+(Number(new Date().getTime()) - startTime);
			console.log(str);
			log_push.write(myCrypto.getDateTime(new Date()) + " " + str + " " +message.CONTENT + '\n');
			iosThread--;
		});
	}catch(e){
		console.log("Exception in iosPush: ");
		console.log(e.stack);
	}
});

Push.on("androidPush", (message) => {
	try{
		androidThread++;
		let startTime = Number(new Date().getTime());
		var pl={
			url: dbConfig.android.fcmUrl,
			method: 'POST',
			headers: {Authorization: 'key='+ message.ANDROID_FCMKEY},
			json: {
				data: {
					content: striptags( myCrypto.decode_1252(message.CONTENT)),
					id: message.ID,
					id_user: message.ID_USER,
					state: message.STATE,
					type: message.TYPES,
					groups: message.GROUPS,
					groups_des: message.GROUPS_DES,
				},
				registration_ids: [message.TOKEN_KEY]
			}
		};
		console.log(pl);
		request(
			pl,
			function (error, res, body) {
				var state = 1;
				var str = "";
				if(error){
					state = 2;
					str = typeof error === 'string' ? error : JSON.stringify(error);
					if(str.toLowerCase().indexOf("connect etimedout") > -1 
						|| str.toLowerCase().indexOf("socket hang up") > -1
						|| str.toLowerCase().indexOf("eai_again")) state = 3;
				}else{
					if (res.statusCode == 200){
						if(body.success > 0){ 
							state = 0;
							str = "SUCCESS";
						}else{
							state = 2;
							str = body.results[0].error;//JSON.stringify(body.results[0]);
						}
					}else{
						state = 2;
						str = res.statusCode + "-" + res.statusMessage;
					}
				}
				message.STATE = state;
				if(state != 0){
					message["ERROR_MESSAGE"] = str;
					Push.emit("execUpdate", message);
				}else{
					message["ERROR_MESSAGE"] = 'SUCCESS';
					Push.emit("execUpdate", message);
				}
				str = androidThread + " to "+message.ID_USER +" (android) "+ str + " time="+(Number(new Date().getTime()) - startTime);
				console.log(str);
				log_push.write(myCrypto.getDateTime(new Date()) + " " + str + " " + message.CONTENT + '\n');
				androidThread--;
			}
		);
	}catch(e){
		console.log("Exception in androidPush: ");
		console.log(e.stack);
	}
});

Push.on("onesignalPush",(message) => {
	try{
		onesignalThread++;
        let startTime = Number(new Date().getTime());
        let appId = message.APP_ID;
        let appAuthKey = message.APP_KEY;
		var data = {
            contents: {
                en: message.CONTENT,
                vi: message.CONTENT,
            },
            include_player_ids: [message.DEVICE_TYPE],
        };
        
        if (message.HEADING) {
            data = {
                ...data,
                headings: {
                    en: message.HEADING,
                    vi: message.HEADING,
                },
            };
        }		
        var OSClient = new OneSignal.Client(appId, appAuthKey);
        OSClient.createNotification(data).then((result) => {
            if(result.statusCode != 200){
                message.STATE = 2;
                message.ERROR_MESSAGE = result.statusCode;
            }else{
                if(result.body.errors){
                    message.STATE = 2;
                    message.ERROR_MESSAGE = JSON.stringify(result.body.errors);
                }else{
                    message.STATE = 0;
                    message.ERROR_MESSAGE = result.body.id;
                }
            }
            let str = onesignalThread + " to "+message.ID_USER +" " + message.ERROR_MESSAGE + " time="+(Number(new Date().getTime()) - startTime);
			console.log(str);
            log_push.write(myCrypto.getDateTime(new Date()) + " " + str + " " +message.CONTENT + '\n');
            onesignalThread--;
            Push.emit("execUpdate", message);
        }).catch((e) => {
            message.STATE = 2;
            if(e instanceof OneSignal.HTTPError){
                message.ERROR_MESSAGE = e.statusCode + "-" + e.body.errors[0];
            }else{
                message.ERROR_MESSAGE = "Exception" + e;
            }
            let str = onesignalThread + " to "+message.ID_USER +" " + message.ERROR_MESSAGE + " time="+(Number(new Date().getTime()) - startTime);
            console.log(str);
			log_push.write(myCrypto.getDateTime(new Date()) + " " + str + " " +message.CONTENT + '\n');
            onesignalThread--;
			Push.emit("execUpdate", message);
        });
	}catch(e){
		console.log("Exception in onesignalPush: ");
        console.log(e.stack);
	}
});

setInterval(() => { sendP(); }, 1000);

function sendP(){
	try {
		if(isConnectedToOracle && oraClient != null){
			var numRows = 1000;
			var bindvars = {
				cursor:  { type: oracledb.CURSOR, dir : oracledb.BIND_OUT }
			};
			oraClient.execute(
				"BEGIN :cursor := GET_PUSHNEW; END;",
				bindvars,
				{ outFormat: oracledb.OBJECT, autoCommit: true },
				function(err, results){
					if(err){
						console.log(err.stack);
						isConnectedToOracle = false;
						oraClient = null;
					}else{
						results.outBinds.cursor.getRows(numRows, function(err1, result){
							if(err1){
								console.log(err1.stack);
							}else{
								//console.log("Num of message: " + result.length);
								for(var i=0; i<result.length ; i++){
									var messageType = result[i].TYPES;
									var messageHeading = "";
									if(messageType == 1) messageHeading = "Chính sách";
									else if(messageType == 2 || messageType == 3) messageHeading = "Đơn hàng";
									else if(messageType == 4) messageHeading = "Thông báo rút tiền";
									else if(messageType == 5) messageHeading = "Thông báo thanh toán";
									else if(messageType == 6) messageHeading = "Tin tức, sự kiện";
									else if(messageType == 7) messageHeading = "Thưởng, khuyến mại";
									else messageHeading = "Thông báo";
									
									var message = {
										"ID": result[i].ID,
										"ID_USER": result[i].ID_USER,
										"DEVICE_TYPE": result[i].DEVICE_TYPE,
										"TOKEN_KEY": result[i].TOKEN_KEY,
										"STATE": result[i].STATE,
										"TYPES": messageType,
										"HEADING": messageHeading,
										"CONTENT": result[i].CONTENT,
										"IOS_BUNDLEID": result[i].IOS_BUNDLEID,
										"ANDROID_FCMKEY": result[i].ANDROID_FCMKEY,
										"GROUPS": result[i].GROUPS,
										"GROUPS_DES": result[i].GROUPS_DES,
										"ID_SHOP": result[i].ID_SHOP,
										"APP_ID": result[i].APP_ID,
										"APP_KEY": result[i].APP_KEY,
										"ERROR_MESSAGE": ''
									};
									//console.log(message);
									var functionName = "";
									if(message.ID_SHOP === 'F6LKFY'){
										if(typeof message.DEVICE_TYPE === 'undefined' || message.DEVICE_TYPE === null || message.DEVICE_TYPE.length === 0){
											message.STATE = 2;
											message.ERROR_MESSAGE = "Unknow deviceType";
											functionName = "execUpdate";
										}else functionName = "onesignalPush";
									}else{
										if(message.DEVICE_TYPE === '0') functionName = "iosPush";
										else if(message.DEVICE_TYPE === '1') functionName = "androidPush";
										else {
											console.warn("Unknow deviceType " + JSON.stringify(message));
											message.STATE = 2;
											message.ERROR_MESSAGE = "Unknow deviceType";
											functionName = "execUpdate";
										}
									}
									Push.emit(functionName, message);
								}
							}
							results.outBinds.cursor.close();
						});
					}
				}
			);
		}else{
			oracledb.getConnection(
				{
					user: dbConfig.user,
					password: dbConfig.password,
					connectString: dbConfig.connectString
				},
				function (err, connection){
					if(err){
						console.error(err);
					}else{
						isConnectedToOracle = true;
						oraClient = connection;
						console.log("Oracle on PushSender connected");
					}
				}
			);
		}
			  
	} catch (e) {
		console.log("Exception in sendP: " + e);
	}
}