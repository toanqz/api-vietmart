module.exports = {
	connectionLimit : 100,
	user: process.env.NODE_ORACLEDB_USER || "f5sell",
	password: process.env.NODE_ORACLEDB_PASSWORD || "f5sell",
	connectString: process.env.NODE_ORACLEDB_CONNECTIONSTRING || "localhost/orcl",
  
	uploadDir: "D:/F5Sell/web/webapps/ROOT/upload/",
	uploadUrl: "http://localhost:8886/upload/",
	uploadPublicUrl: "http://14.241.37.78:8886/upload/",
	uploadMaxSize: 1024*1024*1024,
	uploadAPIMaxSize: 20*1024*1024,

	ios:{
		
		key: "key/AuthKey_7X2AFHRVGL.p8",
		keyId: "7X2AFHRVGL",
		teamId: "MLGVCWU9A7"
	},
	android:{
		fcmUrl: "https://fcm.googleapis.com/fcm/send"
	},
	
	ghtk: {
		igo: {
			token: "abcxyz",
			pick_address_id: "3584088",
			webhook_hash: "F5SE11IGO902P2M"
		}
	}
	
};
