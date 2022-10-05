module.exports = {
    encrypt: function (text) {
        return encrypt({
            alg: 'des-ede3-cbc',//des-ede3
            autoPad: false,
            key: 'EvNCpc_CsKH@2019_v2',
            plaintext: "Hello world!",
            iv: null
        });
    },
	decode_1252: function(text){
		return decode_1252(text);
	},
	getDate: function(date){
		return getDate(date);
	},
	getDateTime: function(date){
		return getDateTime(date);
	}
};

function getDate(date){
	if(date == null || date.length == 0) date = new Date();
	var year = date.getFullYear(); 
	var month = date.getMonth() + 1; month = (month < 10 ? "0" : "") + month;
	var day = date.getDate(); day = (day < 10 ? "0" : "") + day;

	return year + month + day;
}

function getDateTime(date) {
	if(date == null || date.length == 0) date = new Date();
	var hour = date.getHours();	hour = (hour < 10 ? "0" : "") + hour;
	var min = date.getMinutes(); min = (min < 10 ? "0" : "") + min;
	var sec = date.getSeconds(); sec = (sec < 10 ? "0" : "") + sec;
	var year = date.getFullYear(); 
	var month = date.getMonth() + 1; month = (month < 10 ? "0" : "") + month;
	var day = date.getDate(); day = (day < 10 ? "0" : "") + day;

	return day + "/" + month + "/" + year + " " + hour + ":" + min + ":" + sec;
}

const  crypto = require('crypto');

const md5 = text => {
	return crypto.createHash('md5').update(text).digest();
};

/*function encrypt(param) {
	var secretKey = md5(param.key);
	secretKey = Buffer.concat([secretKey, secretKey.slice(0, 8)]);
	//secretKey = Buffer.from(secretKey, 'base64');
	var binaryIV = Buffer.alloc(0);
	
	const cipher = crypto.createCipheriv(param.alg, secretKey, binaryIV);
	var encrypted = cipher.update(param.plaintext, 'utf16le', 'base64');
		encrypted += cipher.final('base64');
		encrypted = encrypted.replace(/\+/g,"___");
		encrypted = encrypted.replace(/\//g,"aaaa_1");
	return encrypted;
}*/

function getAlgorithm(keyBase64) {
    var key = Buffer.from(keyBase64, 'base64');
    switch (key.length) {
        case 16:
            return 'aes-128-cbc';
        case 32:
            return 'aes-256-cbc';
		case 24:
			return 'aes-192-cbc';
    }
    throw new Error('Invalid key length: ' + key.length);
}

function encrypt(param) {
	var secretKey = Buffer.from(param.key, 'base64');
	var binaryIV = Buffer.alloc(0);
	
	const cipher = crypto.createCipheriv(getAlgorithm(secretKey), secretKey, binaryIV);
	var encrypted = cipher.update(param.plaintext, 'utf16le', 'base64');
		encrypted += cipher.final('base64');
		encrypted = encrypted.replace(/\+/g,"___");
		encrypted = encrypted.replace(/\//g,"aaaa_1");
	return encrypted;
}

function decode_1252(s){
    if (s==null || s.length<1) return "";
        
	var i=0;
	var name="";
	var s1="";
	var c=0;
	var startFound =false;

    while (i < s.length) {
        if (s.charAt(i) == '&' ) { // tim thay ky tu bat dau: &
            if (name.length>0) { //start existed but end not found
				s1 =s1+name;
            }
            if (i< s.length-1){
				if (s.charAt(i+1)=='#' ) {
					startFound=true;

					name =""; //reset name
					i++;//bo qua ky tu #
				} else if (s.charAt(i+1)=='n' ) { //&nbsp;
					startFound=true;

					name =""; //reset name
				} else {// windows-1252 encode
					s1=s1+s.charAt(i);
				}
            } else { //not parameter
				s1=s1+s.charAt(i);
            }
        } else if (s.charAt(i)==';' ) {//end
	        if (name.length>0) {
				if(name=="nbsp") {
					s1+=" ";

					startFound = false;
					name = "";
				} else {
					c = name*1;

					s1 += String.fromCharCode(c);
					
					startFound = false;
					name = "";
				}
            } else { // found END but START not existed
				s1=s1+s.charAt(i);
            }
        } else { //not start or end character
            if (! startFound) {
				s1 = s1 + s.charAt(i);
            } else {
				name=name+s.charAt(i);
            }
        }

        i++;
    }
    if (name.length>0) { //start existed but end not found
        s1=s1+name;
    }

    return s1;
}

