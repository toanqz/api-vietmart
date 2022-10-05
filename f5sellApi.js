const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const PORT = 4006;
var formidable = require('formidable');
var crypto = require("crypto");
const router = express.Router();
const jwt = require("jsonwebtoken");
var base64 = require("base-64");
//connect to oracledb
var oracledb = require("oracledb");
var dbConfig = require("./f5sellConfig.js");
//decode e
var ent = require("ent");
var encode = require("ent/encode");
var decode = require("ent/decode");

var HashTable = require("jshashtable");
var htOTP = new HashTable();

//loging //######################   loging   ##############
var logger = require("morgan");
var fs = require("fs");
var util = require("util");
var curr_log_file = __dirname + "/log/f5sell_" + getDate() + ".log";
var log_file = fs.createWriteStream(curr_log_file, {
  flags: "a"
});
var log_stdout = process.stdout;
console.log = function(d) {
  //
  var timeCurrent = getDateTime();
  var new_log_file = __dirname + "/log/f5sell_" + getDate() + ".log";
  if (new_log_file !== curr_log_file) {
    curr_log_file = new_log_file;
    log_file = fs.createWriteStream(curr_log_file, { flags: "a" });
  }
  log_file.write(timeCurrent + " :" + util.format(d) + "\n");
  log_stdout.write(timeCurrent + " :" + util.format(d) + "\n");
};

function getDateTime() {
  var date = new Date();
  var hour = date.getHours();
  hour = (hour < 10 ? "0" : "") + hour;
  var min = date.getMinutes();
  min = (min < 10 ? "0" : "") + min;
  var sec = date.getSeconds();
  sec = (sec < 10 ? "0" : "") + sec;
  var year = date.getFullYear();
  var month = date.getMonth() + 1;
  month = (month < 10 ? "0" : "") + month;
  var day = date.getDate();
  day = (day < 10 ? "0" : "") + day;
  return year + "/" + month + "/" + day + " " + hour + ":" + min + ":" + sec;
}

function getDate() {
  var date = new Date();
  var year = date.getFullYear();
  var month = date.getMonth() + 1;
  month = (month < 10 ? "0" : "") + month;
  var day = date.getDate();
  day = (day < 10 ? "0" : "") + day;

  return year + month + day;
}

var request = require("request");
//####################################
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.listen(PORT, function () {
	console.log('Server is running on Port ' + PORT, PORT);
	/* setInterval(function(){
		 global.gc();
		 const mu = process.memoryUsage();
		 console.log(JSON.stringify(mu));
	 }, 5*60*1000);*/
});
app.get("/checking", function(req, res) {
  res.json({
    res: "cannot suppost GET METHOD"
  });
});
app.post("/checking", function(req, res) {
  res.json({
    Tutorial: "Welcome to the Node express JWT Tutorial POST METHOD"
  });
});
//check crash app
process.on("uncaughtException", function(err) {
  console.log("Caught exception: " + err);
});

// route middleware to verify a token
function checkToken(req, res, next) {
  console.log("################# START checkToken ###################");
  var jsonResponse1 = {};
  try {
    var token = req.headers.authorization.split(" ")[1];
    console.log("token:" + token); 
    if (token) {
      // verifies secret and checks exp
      jwt.verify(token, "f5sellsecretkey@123#_toannn", function(err, decoded) {
        console.log("err:" + err);
        if (err) {
          jsonResponse1["ERROR"] = "0002";
          jsonResponse1["MESSAGE"] = "FAILED";
          jsonResponse1["RESULT"] = "Phiên đăng nhập hết hạn, vui lòng đăng nhập lại để sử dụng hệ thống.";
          console.log('checkToken '+err);
          console.log(jsonResponse1);
          res.send(jsonResponse1);
        } else {
          //check them username xe dung ko
          var userparse = jwt.decode(token, { complete: true });
          if (req.body.USERNAME === userparse.payload.username) {
            	if(req.body.IDSHOP===userparse.payload.idshop){
                next();
             }else {
             	jsonResponse1["ERROR"] = "0002";
             	jsonResponse1["MESSAGE"] = "FAILED";
             	jsonResponse1["RESULT"] = 'Sai mã shop, vui lòng kiểm tra lại';
             	console.log(jsonResponse1);
           	  res.send(jsonResponse1);
             }
          } else {
            next();
          }
        }
      });
    } else {
      jsonResponse1["ERROR"] = "0002";
      jsonResponse1["MESSAGE"] = "FAILED";
      jsonResponse1["RESULT"] = "Không có token, vui lòng kiểm tra lại";
      console.log(jsonResponse1);
      res.send(jsonResponse1);
    }
  } catch (e) {
    console.log("ShopOnline Caught exception: " + e);
    jsonResponse1["ERROR"] = "0002";
    jsonResponse1["MESSAGE"] = "FAILED";
    jsonResponse1["RESULT"] = "Token không chính xác. Xin vui lòng thử lại";
    console.log(jsonResponse1);
    res.send(jsonResponse1);
  }
  console.log("################# END checkToken ###################");
}
// getshopinfo
app.post("/getshopinfo", function(req, res) {
  console.log("################# START GetShopInfo ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          p1: req.body.IDSHOP,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
		console.log(bindvars);
        connection.execute(
          "BEGIN :cursor := init.GetShopInfo(:p1); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
			  doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi parameters";
              console.log(jsonResponse);
              res.send(jsonResponse);
            } else {
              result.outBinds.cursor.getRows(
                1,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
				  console.log(jsonResponse);
                  doClose(connection, result.outBinds.cursor);
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in GetShopInfo: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    console.log(jsonResponse);
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End GetShopInfo ######################");
  }
});

app.post("/getshopinfo2", async(req, res) => {
  console.log("################# START GetShopInfo2 ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100;
    oracledb.fetchAsString = [oracledb.CLOB];
    async function run() {
      let pool;
      try {
        pool = await oracledb.createPool(dbConfig);
        var bindvars = {
          p1: req.body.IDSHOP,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        let connection;
        try {
          connection = await pool.getConnection();
          const result = await connection.execute(
            "BEGIN :cursor := init.GetShopInfo(:p1); END;",
            bindvars,
            { outFormat: oracledb.OBJECT }
          );
          const resultSet = result.outBinds.cursor;
          let rows;
          do {
            rows = await resultSet.getRows(numRows); // get numRows rows at a time
            if (rows == null || rows.length === 0) {
              jsonResponse["ERROR"] = "0004";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Không có dữ liệu";
            } else {
              jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
            }
          } while (rows.length === numRows);
          // always close the ResultSet
          await resultSet.close();
          console.log(jsonResponse);
          res.send(jsonResponse);
        } catch (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi";
          console.log(jsonResponse);
          res.send(jsonResponse);
        } finally {
          if (connection) {
            try {
              await connection.close(); // Put the connection back in the pool
            } catch (err) {
              console.error(err);
            }
          }
        }
      } catch (err) {
        console.error(err);
        jsonResponse["ERROR"] = "0003";
        jsonResponse["MESSAGE"] = "FAILED";
        jsonResponse["RESULT"] = "Gọi API lỗi";
        console.log(jsonResponse);
        res.send(jsonResponse);
      } finally {
        await pool.close();
      }
    }
    run();
  } catch (e) {
    console.log("Exception in GetShopInfo2: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End GetShopInfo2 ######################");
  }
});
// login//
app.post("/login", function(req, res) {
  console.log("################# START login ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 1;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          p1: req.body.IDSHOP,
          p2: req.body.USERNAME,
          p3: req.body.PASSWORD,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.login(:p1, :p2, :p3); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi parameters";
              console.log(jsonResponse);
              res.send(jsonResponse);
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    if (newObj.ERROR == "0000") {
                      var ec = base64.encode(req.body.PASSWORD);
                      const JWTToken = jwt.sign(
                        {
                          idshop: req.body.IDSHOP,
                          username: req.body.USERNAME,
                          password: ec
                        },
                        "f5sellsecretkey@123#_toannn",
                        {
                          expiresIn: "168h" // 1 tuan
                        }
                      );
                      /*var decoded = jwt.decode(JWTToken);
                      // get the decoded payload and header
                      var decoded = jwt.decode(JWTToken, { complete: true });
                      console.log(decoded.header);
                      console.log(decoded.payload);
                      //return*/
                      newObj.TOKEN = JWTToken;
                    } 
                    jsonResponse = newObj;
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in login: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End login ######################");
  }
});

app.post("/login1", function(req, res) {
  console.log("################# START login1 ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    var numRows = 1;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          p1: jsonRequest.IDSHOP,
          p2: jsonRequest.USERNAME,
          p3: jsonRequest.PASSWORD,
		      p4: jsonRequest.UUID,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
		    console.log(bindvars);
        connection.execute(
          "BEGIN :cursor := APPS.login1(:p1, :p2, :p3, :p4); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi parameters";
              console.log(jsonResponse);
              res.send(jsonResponse);
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lỗi";
                  } else if (rows == null || rows.length == 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    if (newObj.ERROR == "0000") {
                      var ec = base64.encode(req.body.PASSWORD);
                      const JWTToken = jwt.sign(
                        {
                          idshop: req.body.IDSHOP,
                          username: req.body.USERNAME,
                          password: ec
                        },
                        "f5sellsecretkey@123#_toannn",
                        {
                          expiresIn: "168h" // 1 tuan
                        }
                      );
                      newObj.TOKEN = JWTToken;
                    } 
                    jsonResponse = newObj;
                  }
                  doClose(connection, result.outBinds.cursor);
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in login1: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End login1 ######################");
  }
});

// reg_user
app.post("/reg_user", function(req, res) {
  console.log("################# START reg_user ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          p1: req.body.FULL_NAME,
          p2: req.body.MOBILE,
          p3: req.body.EMAIL,
          p4: req.body.ID_CITY,
          p5: req.body.ID_DISTRICT,
          p6: req.body.ADDRESS,
          p7: req.body.PASSWORD,
          p8: req.body.IDSHOP,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.reg_user(:p1, :p2, :p3, :p4, :p5, :p6, :p7, :p8); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                1,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in reg_user: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End reg_user ######################");
  }
});

// reg_user1
app.post("/reg_user1", function(req, res) {
  console.log("################# START reg_user1 ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          p1: req.body.FULL_NAME,
          p2: req.body.MOBILE,
          p3: req.body.EMAIL,
          p4: req.body.ID_CITY,
          p5: req.body.ID_DISTRICT,
          p6: req.body.ADDRESS,
          p7: req.body.PASSWORD,
          p8: req.body.IDSHOP,
          p9: req.body.INVITE_CODE,
          p10: req.body.ID_WARD,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.reg_user1(:p1, :p2, :p3, :p4, :p5, :p6, :p7, :p8, :p9, :p10); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                1,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in reg_user1: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End reg_user1 ######################");
  }
});
// reset_pass
app.post("/reset_pass", function(req, res) {
  console.log("################# START reset_pass ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var token = jwt.decode(req.headers.authorization.split(' ')[1], {complete: true});
        
        var bindvars = {
          p1: token.payload.username,
          p2: token.payload.idshop,
          p3: req.body.OLD_PWD,
          p4: req.body.NEW_PWD,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.reset_pass(:p1, :p2, :p3, :p4); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                1,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in reset_pass: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End reset_pass ######################");
  }
});

// upgrade_user
app.post("/upgrade_user", checkToken, function(req, res) {
  console.log("################# START upgrade_user ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        var bindvars = {
          p1: token.payload.username,
          p2: token.payload.idshop,
          p3: req.body.INVITE_CODE,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.upgrade_user(:p1, :p2, :p3); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                1,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in upgrade_user: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End upgrade_user ######################");
  }
});

// update_device
app.post("/update_device", checkToken, function(req, res) {
  console.log("################# START update_device ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.APP_VERSION,
          p3: req.body.MODEL_NAME,
          p4: req.body.TOKEN_KEY,
          p5: req.body.DEVICE_TYPE,
          p6: req.body.OS_VERSION,
          p7: req.body.UUID,
          p8: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.update_device(:p1, :p2, :p3, :p4, :p5, :p6, :p7, :p8); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                1,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                    
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in update_device: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End update_device ######################");
  }
});

// check_device
app.post("/check_device", function(req, res) {
  console.log("################# START check_device ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          p1: req.body.APP_VERSION,
          p2: req.body.MODEL_NAME,
          p3: req.body.TOKEN_KEY,
          p4: req.body.DEVICE_TYPE,
          p5: req.body.OS_VERSION,
          p6: req.body.UUID,
          p7: req.body.IDSHOP,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.check_device(:p1, :p2, :p3, :p4, :p5, :p6, :p7); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                1,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                    
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in check_device: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End check_device ######################");
  }
});

//lấy danh sách tỉnh
app.post("/get_city", function(req, res) {
  console.log("################# START get_city ######################");
  var jsonResponse = {};
  try {
    var numRows = 1000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.get_city(); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
            } else {
              result.outBinds.cursor.getRows(numRows, function(err, rows) {
                  if (err) {
                    console.error(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    if (newObj.ERROR == "0000") {
                      jsonResponse["ERROR"] = newObj.ERROR;
                      jsonResponse["MESSAGE"] = newObj.MESSAGE;
                      jsonResponse["RESULT"] = newObj.RESULT;
                      jsonResponse["INFO"] = rows;
                    } else {
                      jsonResponse = newObj;
                    }
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in get_city : " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# get_city ######################");
  }
});

//lấy danh sách quận huyện   
app.post("/get_district", function(req, res) {
  console.log("################# START get_district ######################");
  var jsonResponse = {};
  try {
    var numRows = 1000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err.MESSAGE);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          p1: req.body.ID_CITY,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
		console.log(bindvars);
        connection.execute(
          "BEGIN :cursor := APPS.get_district(:p1); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    if (newObj.ERROR == "0000") {
                      jsonResponse["ERROR"] = newObj.ERROR;
                      jsonResponse["MESSAGE"] = newObj.MESSAGE;
                      jsonResponse["RESULT"] = newObj.RESULT;
                      jsonResponse["INFO"] = rows;
                    } else {
                      jsonResponse = newObj;
                      console.log(jsonResponse);
                    }
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in get_district : " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# get_district ######################");
  }
});

//lấy danh sách xa phuong   
app.post("/get_ward", function(req, res) {
  console.log("################# START get_ward ######################");
  var jsonResponse = {};
  try {
    var numRows = 1000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          p1: req.body.ID_DISTRICT,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
		console.log(bindvars);
        connection.execute(
          "BEGIN :cursor := APPS.get_ward(:p1); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    if (newObj.ERROR == "0000") {
                     jsonResponse["ERROR"] = newObj.ERROR;
                      jsonResponse["MESSAGE"] = newObj.MESSAGE;
                      jsonResponse["RESULT"] = newObj.RESULT;
                      jsonResponse["INFO"] = rows;
                    } else {
                      jsonResponse = newObj;
                      console.log(jsonResponse);
                    }
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in get_ward : " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# get_ward ######################");
  }
});

// get_list_ctv
app.post("/get_list_ctv", checkToken, function(req, res) {
  console.log("################# START get_list_ctv ######################");
  var jsonResponse = {};
  try {
    var numRows = 1000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.SEARCH,
          p3: req.body.ID_CITY,
          p4: req.body.I_PAGE,
          p5: req.body.NUMOFPAGE,
          p6: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
		console.log(bindvars);
        connection.execute(
          "BEGIN :cursor := APPS.get_list_ctv(:p1, :p2, :p3, :p4, :p5, :p6); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    if (newObj.ERROR == "0000") {
                      jsonResponse["ERROR"] = newObj.ERROR;
                      jsonResponse["MESSAGE"] = newObj.MESSAGE;
                      jsonResponse["RESULT"] = newObj.RESULT;
                      jsonResponse["INFO"] = rows;
                    } else {
                      jsonResponse = newObj;
                      console.log(jsonResponse);
                    }
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in get_list_ctv: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# end get_list_ctv ######################");
  }
});

// get_list_ctv_child
app.post("/get_list_ctv_child", checkToken, function(req, res) {
  console.log("################# START get_list_ctv_child ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.SEARCH,
          p3: req.body.ID_CITY,
          p4: req.body.I_PAGE,
          p5: req.body.NUMOFPAGE,
          p6: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.get_list_ctv_child(:p1, :p2, :p3, :p4, :p5, :p6); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    if (newObj.ERROR == "0000") {
                      jsonResponse["ERROR"] = newObj.ERROR;
                      jsonResponse["MESSAGE"] = newObj.MESSAGE;
                      jsonResponse["RESULT"] = newObj.RESULT;
                      jsonResponse["INFO"] = rows;
                    } else {
                      console.log(newObj);
                      jsonResponse = newObj;
                    }
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in get_list_ctv_child: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# end get_list_ctv_child ######################");
  }
});

app.post("/edit_info_ctv", checkToken, function(req, res) {
  console.log("################# START edit_info_ctv ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 10;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.USER_CTV,
          p3: req.body.NAME,
          p4: req.body.DOB,
          p5: req.body.GENDER,
          p6: req.body.EMAIL,
          p7: req.body.CITY_NAME,
          p8: req.body.DISTRICT_NAME,
          p9: req.body.ADDRESS,
          p10: req.body.STK,
          p11: req.body.TENTK,
          p12: req.body.TENNH,
          p13: req.body.AVATAR,
          p14: token.payload.idshop,
          p15: req.body.CMT,
          p16: req.body.IMG1,
          p17: req.body.IMG2,
		  p18: req.body.WARD_NAME,
		  p19: (typeof req.body.CHINHANHNH === 'undefined' ? '' : req.body.CHINHANHNH),
		  p20: (typeof req.body.MOBILE === 'undefined' ? '' : req.body.MOBILE),
		  p21: (typeof req.body.PASSWORD === 'undefined' ? '' : req.body.PASSWORD),
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.edit_info_ctv(:p1, :p2, :p3, :p4, :p5,:p6, :p7, :p8, :p9, :p10, :p11, :p12, :p13, :p14, :p15, :p16, :p17, :p18, :p19, :p20, :p21); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in edit_info_ctv: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End edit_info_ctv ######################");
  }
});

app.post("/edit_info_ctv2", checkToken, function(req, res) {
  console.log("################# START edit_info_ctv2 ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 10;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
		
		//Update user
		var bindvars = {
		  p1: token.payload.username,
		  p2: req.body.NAME,
		  p3: req.body.DOB,
		  p4: req.body.GENDER,
		  p5: req.body.EMAIL,
		  p6: req.body.CITY_NAME,
		  p7: req.body.DISTRICT_NAME,
		  p8: req.body.WARD_NAME,
		  p9: req.body.ADDRESS,
		  p10: req.body.CCCD,
		  p11: imgeCCCDBefore,
		  p12: imgeCCCDAfter,
		  p13: token.payload.idshop,
		  cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
		};
		connection.execute(
		  "BEGIN :cursor := API_APPS.edit_info_ctv2(:p1, :p2, :p3, :p4, :p5,:p6, :p7, :p8, :p9, :p10, :p11, :p12, :p13); END;",
		  bindvars,
		  { outFormat: oracledb.OBJECT },
		  function(err, result) {
			if (err) {
			  console.error(err);
			  doRelease(connection);
			  jsonResponse["ERROR"] = "0003";
			  jsonResponse["MESSAGE"] = "FAILED";
			  jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
			  console.log(jsonResponse);
			  res.send(jsonResponse);
			  return;
			} else {
			  result.outBinds.cursor.getRows(
				numRows,
				function(err, rows) {
				  if (err) {
					console.log(err);
					jsonResponse["ERROR"] = "0003";
					jsonResponse["MESSAGE"] = "FAILED";
					jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
				  } else if (rows == null || rows.length === 0) {
					jsonResponse["ERROR"] = "0004";
					jsonResponse["MESSAGE"] = "FAILED";
					jsonResponse["RESULT"] = "Không có dữ liệu";
				  } else {
					jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
				  }
				  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
				  doRelease(connection);
				  console.log(jsonResponse);
				  res.send(jsonResponse);
				}
			  );
			}
		  }
		);
      }
    );
  } catch (e) {
    console.log("Exception in edit_info_ctv2: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End edit_info_ctv2 ######################");
  }
});

app.post("/edit_info_ctv1", checkToken, function(req, res) {
  console.log("################# START edit_info_ctv1 ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 10;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.USER_CTV,
          p3: req.body.NAME,
          p4: req.body.DOB,
          p5: req.body.GENDER,
          p6: req.body.EMAIL,
          p7: req.body.CITY_NAME,
          p8: req.body.DISTRICT_NAME,
          p9: req.body.ADDRESS,
          p10: req.body.STK,
          p11: req.body.TENTK,
          p12: req.body.TENNH,
          p13: req.body.AVATAR,
          p14: token.payload.idshop,
          p15: req.body.CMT,
          p16: req.body.IMG1,
          p17: req.body.IMG2,
          p18: req.body.INVITE_CODE,
		      p19: req.body.WARD_NAME,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.edit_info_ctv1(:p1, :p2, :p3, :p4, :p5,:p6, :p7, :p8, :p9, :p10, :p11, :p12, :p13, :p14, :p15, :p16, :p17, :p18, :p19); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in edit_info_ctv1: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End edit_info_ctv1 ######################");
  }
});


//get_info_detail
app.post("/get_info_ctv_detail", checkToken, function(req, res) {
  console.log( "################# START get_info_ctv_detail ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 1;
  //  oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.USER_CTV,
          p3: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.get_info_ctv_detail(:p1, :p2, :p3); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); 
      }
    );
  } catch (e) {
    console.log("Exception in get_info_ctv_detail: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End get_info_ctv_detail ######################"
    );
  }
});

//reset_pass_ctv
app.post("/reset_pass_ctv", checkToken, function(req, res) {
  console.log("################# START reset_pass_ctv ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 1;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.USER_CTV,
          p3: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.reset_pass_ctv(:p1, :p2, :p3); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error("ass" + err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in reset_pass_ctv: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End reset_pass_ctv ######################");
  }
});

//reset_pass_ctv2
app.post("/reset_pass_ctv2", checkToken, function(req, res) {
  console.log("################# START reset_pass_ctv2 ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 1;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.PASSWORD,
          p3: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := API_APPS.reset_pass_ctv(:p1, :p2, :p3); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error("ass" + err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in reset_pass_ctv2: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End reset_pass_ctv2 ######################");
  }
});

//get_product_cat
app.post("/get_product_cat", function(req, res) {
  console.log("################# START get_product_cat ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
		      p1: req.body.USERNAME,
          p2: req.body.ID_PARENT,
          p3: req.body.IDSHOP,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.get_product_cat(:p1, :p2, :p3); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var jsonResponse = {};
                    var newList = [];
                        newList.INFO = [];
                    var jsonpush2 = {};

                    var curid = "";
                    var currinfo = [];
                    var currMenu = {};
                    for (var i = 0; i < rows.length; i++) {
                      var id = rows[i].ID;
                      var name = rows[i].NAME;
                      var id_parent = rows[i].ID_PARENT;

                      var sub_id = rows[i].SUB_ID;
                      var sub_name = rows[i].SUB_NAME;
                      var sub_id_parent = rows[i].SUB_ID_PARENT;

                      if (curid !== id) {
                        currMenu = {};
                        currMenu["ID"] = id;
                        currMenu["NAME"] = name;
                        currMenu["ID_PARENT"] = id_parent;
                        curid = id;
                        currinfo = [];
						
						            if (sub_id) {
                          jsonpush2 = {};
                          jsonpush2["SUB_ID"] = sub_id;
                          jsonpush2["SUB_NAME"] = sub_name;
                          jsonpush2["SUB_ID_PARENT"] = sub_id_parent;
							            currinfo.push(jsonpush2);
                        }
						            if (curid.length > 0) {
						              currMenu.INFO = currinfo;
                          newList.push(currMenu);
                        }
                      } else {
                        jsonpush2 = {};
                        jsonpush2["SUB_ID"] = sub_id;
                        jsonpush2["SUB_NAME"] = sub_name;
                        jsonpush2["SUB_ID_PARENT"] = sub_id_parent;
                        currinfo.push(jsonpush2);
                      }
                    }
                    jsonResponse["ERROR"] = "0000";
                    jsonResponse["MESSAGE"] = "SUCCESS";
                    jsonResponse["RESULT"] = "Lấy danh sách sản phẩm thành công";
                    jsonResponse["DETAIL"] = newList;
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in get_product_cat: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End get_product_cat ######################");
  }
});

//get_product_cat_detail
app.post("/get_product_cat_detail", function(req, res) {
  console.log("################# START get_product_cat_detail ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          //console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          p1: req.body.username,
          p2: req.body.SUB_ID_PARENT,
          p3: req.body.SUB_ID,
          p4: req.body.PAGE,
          p5: req.body.NUMOFPAGE,
          p6: req.body.IDSHOP,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.get_product_cat_detail(:p1, :p2, :p3, :p4, :p5, :p6); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              //console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_product = [];
                    for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      jsonpush["ID_PRODUCT"] = rows[i].ID;
                      jsonpush["IMAGE_COVER"] = rows[i].IMAGE_COVER;
                      jsonpush["PRODUCT_NAME"] = rows[i].PRODUCT_NAME;
                      jsonpush["PRICE"] = rows[i].PRICE;
                      jsonpush["IMG1"] = rows[i].IMG1;
                      jsonpush["IMG2"] = rows[i].IMG2;
                      jsonpush["IMG3"] = rows[i].IMG3;
                      jsonpush["ID_PRODUCT_PROPERTIES"] = rows[i].ID_PRODUCT_PROPERTIES;
                      jsonpush["PROPERTIES_NAME"] = rows[i].PROPERTIES_NAME;
                      jsonpush["PROPERTIES"] = rows[i].PROPERTIES;
                      jsonpush["CODE_PRODUCT"] = rows[i].CODE_PRODUCT;
                      jsonpush["DESCRIPTION"] = rows[i].DESCRIPTION;
                      jsonpush["SUB_ID"] = rows[i].SUB_ID_PARENT;
                      jsonpush["DESCRIPTION_HTML"] = rows[i].DESCRIPTION_HTML;
                      jsonpush["LINK_AFFILIATE"] = rows[i].LINK_AFFILIATE;
                      jsonpush["COMMISSION"] = rows[i].COMMISSION;
                      jsonpush["CONTENT_WEB"] = rows[i].CONTENT_WEB;
                      jsonpush["CONTENT_FB"] = rows[i].CONTENT_FB;
                      jsonpush["MEDIA_FB"] = rows[i].MEDIA_FB;
                      jsonpush["VIDEO_FB"] = rows[i].VIDEO_FB;
                      jsonpush["COMISSION_PRODUCT"] = rows[i].COMISSION_PRODUCT;
					            jsonpush["START_PROMOTION"] = rows[i].START_PROMOTION;
                      jsonpush["END_PROMOTION"] = rows[i].END_PROMOTION;
                      jsonpush["PRICE_PROMOTION"] = rows[i].PRICE_PROMOTION;
                      jsonpush["PRICE_WHOLESALE"] = rows[i].PRICE_WHOLESALE;
                      jsonpush["WARRANTY"] = rows[i].WARRANTY;
                      jsonpush["PRICE_IMPORT"] = rows[i].PRICE_IMPORT;
					            jsonpush["HHMAX"] = rows[i].HHMAX;
                      jsonpush["TRAINING"] = rows[i].TRAINING;
					            jsonpush["IMG_THUMBNAIL"] = rows[i].IMG_THUMBNAIL;
                      sub_product.push(jsonpush);
                    }
                    jsonResponse["ERROR"] = newObj.ERROR;
                    jsonResponse["MESSAGE"] = newObj.MESSAGE;
                    jsonResponse["RESULT"] = newObj.RESULT;
                    jsonResponse["INFO"] = sub_product;
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  //console.log(jsonResponse);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in get_product_cat_detail: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End get_product_cat_detail ######################");
  }
});

//get_properties
app.post("/get_properties", function(req, res) {
  console.log("################# START get_properties ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          p1: req.body.LIST_PROPERTIES,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.get_properties(:p1); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newList = [];
                        newList.INFO = [];
                    var jsonpush2 = {};

                    var curid = "";
                    var currinfo = [];
                    var currMenu = {};
                    for (var i = 0; i < rows.length; i++) {
                      var id = rows[i].ID;
                      var name = rows[i].NAME;
                      var type_id = rows[i].TYPE_ID;
                      type_id = type_id.toString();
                      var properties = rows[i].PROPERTIES;
                  	 	console.log('curid:'+curid.length);
                      console.log('type_id:'+type_id);
                      if (curid !== type_id) {
                        if (curid.length > 0) {
                          currMenu.INFO = currinfo;
                          newList.push(currMenu);
                        }
                        currMenu = {};
                        currMenu["NAME"] = name;
                        currMenu["TYPE_ID"] = type_id;
                        curid = type_id;
                        currinfo = [];
                        
                      } 
                      jsonpush2 = {};
                      jsonpush2["SUB_ID"] = id;
                      jsonpush2["SUB_PROPERTIES"] = properties;
                      currinfo.push(jsonpush2);
                    }
                    if (curid != "") {
                      currMenu.INFO = currinfo;
                      newList.push(currMenu);
                    }
                    jsonResponse["ERROR"] = "0000";
                    jsonResponse["MESSAGE"] = "SUCCESS";
                    jsonResponse["RESULT"] = "Lấy danh sách thuộc tính sản phẩm thành công";
                    jsonResponse["DETAIL"] = newList;
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in get_properties: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End get_properties ######################");
  }
});

//order_product
app.post("/order_product", checkToken, function(req, res) {
  console.log("################# START order_product ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 10;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.CODE_PRODUCT,
          p3: req.body.AMOUNT,
          p4: req.body.PRICE,
          p5: req.body.MONEY,
          p6: req.body.BONUS,
          p7: req.body.FULL_NAME,
          p8: req.body.MOBILE_RECEIVER,
          p9: req.body.ID_CITY,
          p10: req.body.ID_DISTRICT,
          p11: req.body.ADDRESS,
          p12: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.order_product(:p1, :p2, :p3, :p4, :p5, :p6, :p7, :p8, :p9, :p10, :p11, :p12); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in order_product: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End order_product ######################");
  }
});

//order_product
app.post("/order_product2", checkToken, function(req, res) {
  console.log("################# START order_product2 ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 10;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.CODE_PRODUCT,
          p3: req.body.AMOUNT,
          p4: req.body.PRICE,
          p5: req.body.MONEY,
          p6: req.body.BONUS,
          p7: req.body.ID_PRODUCT_PROPERTIES,
          p8: req.body.FULL_NAME,
          p9: req.body.MOBILE_RECEIVER,
          p10: req.body.ID_CITY,
          p11: req.body.ID_DISTRICT,
          p12: req.body.ADDRESS,
          p13: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.order_product2(:p1, :p2, :p3, :p4, :p5, :p6, :p7, :p8, :p9, :p10, :p11, :p12, :p13); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in order_product2: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End order_product2 ######################");
  }
});

//order_product
app.post("/order_product3", checkToken, function(req, res) {
  console.log("################# START order_product3 ######################");
  var jsonResponse = {};
  try {
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Đặt đơn hàng lỗi, vui lòng thử lại sau.";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
		console.log(req.body);
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.CODE_PRODUCT,
          p3: req.body.AMOUNT,
          p4: req.body.PRICE,
          p5: req.body.MONEY,
          p6: req.body.BONUS,
          p7: req.body.ID_PRODUCT_PROPERTIES,
          p8: req.body.DISTCOUNT,
          p9: req.body.NOTE,
          p10: req.body.FULL_NAME,
          p11: req.body.MOBILE_RECEIVER,
          p12: req.body.ID_CITY,
          p13: req.body.ID_DISTRICT,
          p14: req.body.ADDRESS,
          p15: token.payload.idshop,
          p16: (typeof req.body.FEESHIP === 'undefined' ? 0 : req.body.FEESHIP),
          p17: (typeof req.body.ID_WARD === 'undefined' ? '' : req.body.ID_WARD),
		  p18: (typeof req.body.PAYMENT_TYPE === 'undefined' ? '' : req.body.PAYMENT_TYPE),
		  p19: (typeof req.body.REQUEST_DATE === 'undefined' ? '' : req.body.REQUEST_DATE),
		  p20: (typeof req.body.REQUEST_TIME_START === 'undefined' ? '' : req.body.REQUEST_TIME_START),
		  p21: (typeof req.body.REQUEST_TIME_END === 'undefined' ? '' : req.body.REQUEST_TIME_END),
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
		console.log(bindvars);
        connection.execute(
          "BEGIN :cursor := APPS.order_product3(:p1, :p2, :p3, :p4, :p5, :p6, :p7, :p8, :p9, :p10, :p11, :p12, :p13, :p14, :p15, :p16, :p17, :p18, :p19, :p20, :p21); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Đặt đơn hàng lỗi, vui lòng thử lại sau.";
              console.log(jsonResponse);
              res.send(jsonResponse);
            } else {
				result.outBinds.cursor.getRows(1, function(err, rows) {
                  if (err) {
                    console.error(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Đặt đơn hàng lỗi, vui lòng thử lại sau.";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  result.outBinds.cursor.close(); // always close the RESULTSet
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                });
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in order_product2: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Lỗi hệ thống, vui lòng thử lại sau!";
	console.log(jsonResponse);
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End order_product3 ######################");
  }
});

//order_product4
app.post("/order_product4", checkToken, function(req, res) {
  console.log("################# START order_product4 ######################");
  var jsonResponse = {};
  try {
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Đặt đơn hàng lỗi, vui lòng thử lại sau.";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
		console.log(req.body);
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.CODE_PRODUCT,
          p3: req.body.AMOUNT,
          p4: req.body.PRICE,
          p5: req.body.MONEY,
          p6: req.body.BONUS,
          p7: req.body.ID_PRODUCT_PROPERTIES,
          p8: req.body.DISTCOUNT,
          p9: req.body.NOTE,
          p10: req.body.FULL_NAME,
          p11: req.body.MOBILE_RECEIVER,
          p12: req.body.ID_CITY,
          p13: req.body.ID_DISTRICT,
          p14: req.body.ADDRESS,
          p15: token.payload.idshop,
          p16: (typeof req.body.FEESHIP === 'undefined' ? 0 : req.body.FEESHIP),
          p17: (typeof req.body.ID_WARD === 'undefined' ? '' : req.body.ID_WARD),
          p18: (typeof req.body.STORE_ID === 'undefined' ? '' : req.body.STORE_ID),
		  p19: (typeof req.body.PAYMENT_TYPE === 'undefined' ? '' : req.body.PAYMENT_TYPE),
		  p20: (typeof req.body.REQUEST_DATE === 'undefined' ? '' : req.body.REQUEST_DATE),
		  p21: (typeof req.body.REQUEST_TIME_START === 'undefined' ? '' : req.body.REQUEST_TIME_START),
		  p22: (typeof req.body.REQUEST_TIME_END === 'undefined' ? '' : req.body.REQUEST_TIME_END),
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
		console.log(bindvars);
        connection.execute(
          "BEGIN :cursor := API_APPS.order_product(:p1, :p2, :p3, :p4, :p5, :p6, :p7, :p8, :p9, :p10, :p11, :p12, :p13, :p14, :p15, :p16, :p17, :p18, :p19, :p20, :p21, :p22); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Đặt đơn hàng lỗi, vui lòng thử lại sau.";
              console.log(jsonResponse);
              res.send(jsonResponse);
            } else {
				result.outBinds.cursor.getRows(1, function(err, rows) {
                  if (err) {
                    console.error(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Đặt đơn hàng lỗi, vui lòng thử lại sau.";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  result.outBinds.cursor.close(); // always close the RESULTSet
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                });
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in order_product4: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Lỗi hệ thống, vui lòng thử lại sau!";
	console.log(jsonResponse);
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End order_product4 ######################");
  }
});

//edit_order_product2
app.post('/edit_order_product2',checkToken, function(req, res){
  console.log('################# START edit_order_product2 ######################');
  var jsonResponse = {};
	try{
		var jsonRequest = JSON.parse(JSON.stringify(req.body));
		console.log(jsonRequest);
    oracledb.fetchAsString = [ oracledb.CLOB ];
		oracledb.getConnection(dbConfig,
			function (err, connection) {
				if (err) {
					console.error(err);
				  jsonResponse["ERROR"] = "0003";
				  jsonResponse["MESSAGE"] = "FAILED";
				  jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
				  console.log(jsonResponse);
				  res.send(jsonResponse);
					return;
				}
				//bind with parameters
				var token = jwt.decode(req.headers.authorization.split(' ')[1], {complete: true});
				var time_receiver = req.body.TIME_RECEIVER;
				if(typeof time_receiver === 'undefined' || time_receiver === null) time_receiver = "";
				else if(time_receiver.length > 10) time_receiver = time_receiver.substring(0,10).trim();
				
				var bindvars = {
					p1:  token.payload.username,
					p2:  req.body.CODE_PRODUCT,
					p3:  req.body.AMOUNT,
					p4:  req.body.PRICE,
					p5:  req.body.MONEY,
					p6:  req.body.BONUS,
					p7:  req.body.FULL_NAME,
					p8:  req.body.MOBILE_RECEIVER,
					p9:  req.body.ID_CITY,
					p10:  req.body.ID_DISTRICT,
					p11:  req.body.ADDRESS,
					p12:  req.body.CODE_ORDER,
					p13:  req.body.STATUS,
					p14:  req.body.EXTRA_SHIP,
					p15:  time_receiver,
					p16:  req.body.NOTE,
					p17: token.payload.idshop,
					p18:  req.body.PERCENT_PRODUCT,
					cursor:  { type: oracledb.CURSOR, dir : oracledb.BIND_OUT }
				};
				connection.execute(
					"BEGIN :cursor := APPS.edit_order_product(:p1, :p2, :p3, :p4, :p5, :p6, :p7, :p8, :p9, :p10, :p11, :p12, :p13, :p14, :p15, :p16, :p17, :p18); END;",
					bindvars,
					{outFormat: oracledb.OBJECT },
					function(err, result) {
						if (err) {
							console.error(err);
							//doClose(connection, result.outBinds.cursor); // always close the RESULTSet
							doRelease(connection);
						  jsonResponse["ERROR"] = "0003";
						  jsonResponse["MESSAGE"] = "FAILED";
						  jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
						  console.log(jsonResponse);
						  res.send(jsonResponse);
							return;
						} else {
							result.outBinds.cursor.getRows( // get numRows rows
								1,
								function (err, rows) {
									if (err) {
										jsonResponse["ERROR"] = "0003";
										jsonResponse["MESSAGE"] = "FAILED";
										jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
									} else if (rows == null || rows.length === 0) {   // no rows, or no more rows
										jsonResponse["ERROR"] = "0004";
										jsonResponse["MESSAGE"] = "FAILED";
										jsonResponse["RESULT"] = "Không có dữ liệu";
									} else {
										jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
								});
							}
						});
					}
				);
			}catch(e){
				console.log("Exception in edit_order_product2: " + e);
				jsonResponse["ERROR"] = "-1";
				jsonResponse["MESSAGE"] = "FAILED";
				jsonResponse["RESULT"] = "Exception";
				res.send(jsonResponse);
			}finally{
				res.status(200);
				console.log('################# End edit_order_product2 ######################');
			}
		});

//edit_order_product
app.post("/edit_order_product", checkToken, function(req, res) {
  console.log("################# START edit_order_product ######################");
  var jsonResponse = {};
  try {
    console.log(req.body);
    var numRows = 1;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.CODE_PRODUCT,
          p3: req.body.AMOUNT,
          p4: req.body.PRICE,
          p5: req.body.MONEY,
          p6: req.body.BONUS,
          p7: req.body.ID_PRODUCT_PROPERTIES,
          p8: req.body.FULL_NAME,
          p9: req.body.MOBILE_RECEIVER,
          p10: req.body.ID_CITY,
          p11: req.body.ID_DISTRICT,
          p12: req.body.ADDRESS,
          p13: req.body.CODE_ORDER,
          p14: req.body.STATUS,
          p15: req.body.EXTRA_SHIP,
          p16: req.body.TIME_RECEIVER,
          p17: req.body.NOTE,
		  p18: req.body.DISTCOUNT,
          p19: token.payload.idshop,
		  p20: req.body.PAYED,
		  p21: (typeof req.body.SURCHARGE === 'undefined' ? 0 : req.body.SURCHARGE),
		  p22: (typeof req.body.NOTE_SHOP === 'undefined' ? 0 : req.body.NOTE_SHOP),
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
		
        connection.execute(
          "BEGIN :cursor := APPS.edit_order_product2(:p1, :p2, :p3, :p4, :p5, :p6, :p7, :p8, :p9, :p10, :p11, :p12, :p13, :p14, :p15, :p16, :p17, :p18, :p19, :p20,:p21, :p22); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
				console.log(jsonResponse);
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in edit_order_product: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End edit_order_product ######################"
    );
  }
});

//get_order_history
app.post("/get_order_history", checkToken, function(req, res) {
  console.log("################# START get_order_history ######################");
  var jsonResponse = {};
  try {
    var numRows = 100;//(typeof req.body.NUMOFPAGE === 'undefined' ? 1 : req.body.NUMOFPAGE);
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        console.log(req.headers.authorization);
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.START_TIME,
          p3: req.body.END_TIME,
          p4: req.body.USER_CTV,
          p5: req.body.STATUS,
          p6: req.body.PAGE,
          p7: req.body.NUMOFPAGE,
          p8: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
		console.log(bindvars);
        connection.execute(
          "BEGIN :cursor := APPS.get_order_history(:p1, :p2, :p3, :p4, :p5, :p6, :p7, :p8); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
					jsonResponse["TOTAL_ORDER"] = 0;
                    jsonResponse["INFO"] = [];
                    console.log(jsonResponse);
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_ = [];
                    console.log('rows:'+rows.length);
                    for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      jsonpush["ID"] = rows[i].ID;
                      jsonpush["CODE_ORDER"] = rows[i].CODE_ORDER;
                      jsonpush["CREATE_BY"] = rows[i].CREATE_BY;
                      jsonpush["FULL_NAME_CTV"] = rows[i].FULL_NAME_CTV;
                      jsonpush["USER_CODE"] = rows[i].USER_CODE;
                      jsonpush["CREATE_DATE"] = rows[i].CREATE_DATE;
                      jsonpush["TIME_RECEIVER"] = rows[i].TIME_RECEIVER;
                      jsonpush["STATUS"] = rows[i].STATUS;
                      jsonpush["STATUS_NAME"] = rows[i].STATUS_NAME;
                      jsonpush["MOBILE_RECCEIVER"] = rows[i].MOBILE_RECCEIVER;
                      jsonpush["FULLNAME_RECEIVER"] = rows[i].FULLNAME_RECEIVER;
                      jsonpush["TOTAL_MONEY"] = rows[i].TOTAL_MONEY;
                      jsonpush["STATUS_EDIT"] = rows[i].STATUS_EDIT;
                      jsonpush["LINE_NUMBER"] = rows[i].LINE_NUMBER;
                      jsonpush["DISCOUNT"] = rows[i].DISTCOUNT;
                      jsonpush["TOTAL_COMMISSION"] = rows[i].TOTAL_COMMISSION;
                      jsonpush["USER_COMMISSION"] = rows[i].USER_COMMISSION;
					  jsonpush["SHIP_MONEY"] = rows[i].EXTRA_MONEY;
					  jsonpush["REQUEST_DATE"] = rows[i].REQUEST_DATE;
					  jsonpush["REQUEST_TIME"] = rows[i].REQUEST_TIME;
					  jsonpush["STORE_ID"] = rows[i].STORE_ID;
                      sub_.push(JSON.parse(JSON.stringify(jsonpush)));
                    }
                    jsonResponse["ERROR"] = newObj.ERROR;
                    jsonResponse["MESSAGE"] = newObj.MESSAGE;
                    jsonResponse["RESULT"] = newObj.RESULT;
                    jsonResponse["TOTAL_ORDER"] = newObj.TT;
                    jsonResponse["INFO"] = sub_;
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in get_order_history: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End get_order_history ######################"
    );
  }
});

//get_order_history_detail
app.post("/get_order_history_detail", checkToken, function(req, res) {
  console.log("################# START get_order_history_detail ######################");
  var jsonResponse = {};
  try {
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });

        var bindvars = {
          p1: token.payload.username,
          p2: req.body.CODE_ORDER,
          p3: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
		console.log(bindvars);
        connection.execute(
          "BEGIN :cursor := APPS.get_order_history_detail(:p1, :p2, :p3); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
            } else {
              result.outBinds.cursor.getRows(100, function(err, rows) {
                  if (err) {
                    console.error(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
              });
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in get_order_history_detail: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
	console.log(jsonResponse);
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End get_order_history_detail ######################");
  }
});

//get_order_history_detail_pp
app.post("/get_order_history_detail_pd", checkToken, function(req, res) {
  console.log(
    "################# START get_order_history_detail_pd ######################"
  );
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        //console.log(token.payload.username);
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.CODE_ORDER,
          p3: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.get_order_history_detail_pd(:p1, :p2, :p3); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_ = [];
                    for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      jsonpush["ID"] = rows[i].ID;
                      jsonpush["NUM"] = rows[i].NUM;
                      jsonpush["ID_CODE_ORDER"] = rows[i].ID_CODE_ORDER;
                      jsonpush["ID_PRODUCT_PROPERTIES"] = rows[i].ID_PRODUCT_PROPERTIES;
                      jsonpush["OD_PRODUCT_PROPERTIES"] = rows[i].OD_PRODUCT_PROPERTIES;
                      jsonpush["PROPERTIES"] = rows[i].PROPERTIES;
                      jsonpush["PRICE"] = rows[i].PRICE;
                      jsonpush["MONEY"] = rows[i].MONEY;
                      jsonpush["IMAGE_COVER"] = rows[i].IMAGE_COVER;
                      jsonpush["PRODUCT_NAME"] = rows[i].PRODUCT_NAME;
                      jsonpush["STATUS_EDIT"] = rows[i].STATUS_EDIT;
                      jsonpush["COMMISSION_PRICE"] = rows[i].COMMISSION_PRICE;
                      jsonpush["COMMISSION"] = rows[i].COMMISSION;
                      jsonpush["CODE_PRODUCT"] = rows[i].CODE_PRODUCT;
                      jsonpush["COMMISSION_PRODUCT"] = rows[i].P_COMMISSION;
                      jsonpush["COMISSION_PRODUCT"] = rows[i].P_COMMISSION;
                      jsonpush["PRODUCT_COMMISSION"] = rows[i].PRODUCT_COMMISSION;
                      jsonpush["DISCOUNT"] = rows[i].DISTCOUNT;
                      jsonpush["NOTE"] = rows[i].NOTE;
					  jsonpush["NOTE_SHOP"] = rows[i].NOTE_SHOP;
                      sub_.push(jsonpush);
                    }
                    jsonResponse["ERROR"] = newObj.ERROR;
                    jsonResponse["MESSAGE"] = newObj.MESSAGE;
                    jsonResponse["RESULT"] = newObj.RESULT;
                    jsonResponse["INFO"] = sub_;
                  }
                  console.log(jsonResponse);
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in get_order_history_detail_pd: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End get_order_history_detail_pd ######################"
    );
  }
});

//get_commission
app.post("/get_commission", checkToken, function(req, res) {
  console.log("################# START get_commission ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(req.body);
    var numRows = 100000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.USER_CTV,
          p3: req.body.PAGE + '',
          p4: req.body.NUMOFPAGE + '',
          p5: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
		console.log(bindvars);
        connection.execute(
          "BEGIN :cursor := APPS.get_commission(:p1, :p2, :p3, :p4, :p5); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_ = [];
                    for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      jsonpush["ID"] = rows[i].ID;
                      jsonpush["ID_USER"] = rows[i].ID_USER;
                      jsonpush["USERNAME"] = rows[i].USERNAME;
                      jsonpush["FULL_NAME"] = rows[i].FULL_NAME;
                      jsonpush["USER_CODE"] = rows[i].USER_CODE;
                      jsonpush["BALANCE"] = rows[i].BALANCE;
                      jsonpush["UPDATE_TIME"] = rows[i].UPDATE_TIME;
                      jsonpush["LINE_NUMBER"] = rows[i].LINE_NUMBER;
                      sub_.push(jsonpush);
                    }
                    
                    jsonResponse["ERROR"] = newObj.ERROR;
                    jsonResponse["MESSAGE"] = newObj.MESSAGE;
                    jsonResponse["RESULT"] = newObj.RESULT;
                    jsonResponse["TONGHH"] = newObj.TONGHH;
                    jsonResponse["TONGRUT"] = newObj.TONGRUT;
                    jsonResponse["INFO"] = sub_;
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in get_commission: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End get_commission ######################");
  }
});

//get_commission2
app.post("/get_commission2", checkToken, function(req, res) {
  console.log("################# START get_commission2 ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(req.body);
    var numRows = 100000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.USER_CTV,
          p3: req.body.PAGE + '',
          p4: req.body.NUMOFPAGE + '',
          p5: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
		console.log(bindvars);
        connection.execute(
          "BEGIN :cursor := API_APPS.get_commission(:p1, :p2, :p3, :p4, :p5); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_ = [];
                    for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      jsonpush["ID"] = rows[i].ID;
                      jsonpush["ID_USER"] = rows[i].ID_USER;
                      jsonpush["USERNAME"] = rows[i].USERNAME;
                      jsonpush["FULL_NAME"] = rows[i].FULL_NAME;
                      jsonpush["USER_CODE"] = rows[i].USER_CODE;
                      jsonpush["BALANCE"] = rows[i].BALANCE;
                      jsonpush["UPDATE_TIME"] = rows[i].UPDATE_TIME;
                      jsonpush["LINE_NUMBER"] = rows[i].LINE_NUMBER;
                      sub_.push(jsonpush);
                    }
                    
                    jsonResponse["ERROR"] = newObj.ERROR;
                    jsonResponse["MESSAGE"] = newObj.MESSAGE;
                    jsonResponse["RESULT"] = newObj.RESULT;
                    jsonResponse["TONGHH"] = newObj.TONGHH;
                    jsonResponse["TONGRUT"] = newObj.TONGRUT;
                    jsonResponse["INFO"] = sub_;
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in get_commission: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End get_commission ######################");
  }
});

//get_withdrawal
app.post("/get_withdrawal", checkToken, function(req, res) {
  console.log("################# START get_withdrawal ######################");
  var jsonResponse = {};
  try {
    console.log(req.body);
    // var numRows = req.body.NUMOFPAGE;
	// if (typeof numRows === 'undefined' || isNaN(numRows)) numRows = 1000;
	var numRows = 1000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        //console.log(token.payload.username);
        var bindvars = {
          p1: token.payload.username,
		  p2: (typeof req.body.STATUS === 'undefined' ? '' : req.body.STATUS),
          p3: req.body.PAGE + '',
          p4: req.body.NUMOFPAGE + '',
          p5: token.payload.idshop,
		  p6: (typeof req.body.IS_PROCESS === 'undefined' ? '' : req.body.IS_PROCESS),
		  p7: (typeof req.body.START_TIME === 'undefined' ? '' : req.body.START_TIME),
		  p8: (typeof req.body.END_TIME === 'undefined' ? '' : req.body.END_TIME),
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
		
		console.log(bindvars);
        connection.execute(
          "BEGIN :cursor := APPS.get_withdrawal2(:p1, :p2, :p3, :p4, :p5, :p6, :p7, :p8); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_ = [];
                    for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      jsonpush["ID"] = rows[i].ID;
                      jsonpush["ID_USER"] = rows[i].ID_USER;
                      jsonpush["USERNAME"] = rows[i].USERNAME;
                      jsonpush["FULL_NAME"] = rows[i].FULL_NAME;
                      jsonpush["USER_CODE"] = rows[i].USER_CODE;
                      jsonpush["BALANCE"] = rows[i].BALANCE;
                      jsonpush["UPDATE_TIME"] = rows[i].UPDATE_TIME;
                      jsonpush["AMOUNT"] = rows[i].AMOUNT;
                      jsonpush["ID_REQUEST"] = rows[i].ID_REQUEST;
                      jsonpush["IS_READ"] = rows[i].IS_READ;
                      jsonpush["LINE_NUMBER"] = rows[i].LINE_NUMBER;
                      jsonpush["TRANSACTION_TYPE"] = rows[i].TRANSACTION_TYPE;
                      jsonpush["COMMENTS"] = rows[i].COMENT;
                      jsonpush["IS_PROCESS"] = rows[i].IS_PROCESS;
                      jsonpush["STATUS"] = rows[i].STATUS;
					  jsonpush["AMOUNT_PROCESS"] = rows[i].AMOUNT_PROCESS;
                      sub_.push(jsonpush);
                    }
                    jsonResponse["ERROR"] = newObj.ERROR;
                    jsonResponse["MESSAGE"] = newObj.MESSAGE;
                    jsonResponse["RESULT"] = newObj.RESULT;
                    jsonResponse["INFO"] = sub_;
                  }
                  console.log(jsonResponse);
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in get_withdrawal: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End get_withdrawal ######################");
  }
});

//get_withdrawal_history
app.post("/get_withdrawal_history", checkToken, function(req, res) {
  console.log(
    "################# START get_withdrawal_history ######################"
  );
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        //console.log(token.payload.username);
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.USER_CTV,
          p3: req.body.START_TIME,
          p4: req.body.END_TIME,
          p5: req.body.PAGE,
          p6: req.body.NUMOFPAGE,
          p7: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := API_APPS.get_withdrawal_history(:p1, :p2, :p3, :p4, :p5, :p6, :p7); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_ = [];
                    for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      jsonpush["ID"] = rows[i].ID;
                      jsonpush["ID_USER"] = rows[i].ID_USER;
                      jsonpush["USERNAME"] = rows[i].USERNAME;
                      jsonpush["FULL_NAME"] = rows[i].FULL_NAME;
                      jsonpush["USER_CODE"] = rows[i].USER_CODE;
                      jsonpush["BALANCE"] = rows[i].BALANCE;
                      jsonpush["MOBILE"] = rows[i].MOBILE;
                      jsonpush["EMAIL"] = rows[i].EMAIL;
                      jsonpush["UPDATE_TIME"] = rows[i].UPDATE_TIME;
                      jsonpush["AMOUNT"] = rows[i].AMOUNT;
                      jsonpush["LINE_NUMBER"] = rows[i].LINE_NUMBER;
                      jsonpush["TRANSACTION_TYPE"] = rows[i].TRANSACTION_TYPE;
                      jsonpush["COMMENTS"] = rows[i].COMENT;
                      jsonpush["TRANSACTION_NAME"] = rows[i].TRANSACTION_NAME;
                      sub_.push(jsonpush);
                    }
                    jsonResponse["ERROR"] = newObj.ERROR;
                    jsonResponse["MESSAGE"] = newObj.MESSAGE;
                    jsonResponse["RESULT"] = newObj.RESULT;
                    jsonResponse["INFO"] = sub_;                    
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in get_withdrawal_history: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End get_withdrawal_history ######################"
    );
  }
});

//get_request_withdrawal
app.post("/get_request_withdrawal", checkToken, function(req, res) {
  console.log("################# START get_request_withdrawal ######################");
  var jsonResponse = {};
  try {
    console.log(req.body);
    var numRows = 1;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        //console.log(token.payload.username);
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.AMOUNT,
          p3: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.get_request_withdrawal(:p1, :p2, :p3); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  console.log(jsonResponse);
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in get_request_withdrawal: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End get_request_withdrawal ######################"
    );
  }
});

//report_default
app.post("/report_default", checkToken, function(req, res) {
  console.log("################# START report_default ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        //console.log(token.payload.username);
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.YEAR,
          p3: req.body.MONTH,
          p4: req.body.REPORT_TYPE,
          p5: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.report_default(:p1, :p2, :p3, :p4, :p5); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_ = [];
                    for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      if (req.body.REPORT_TYPE === "1") {
                        jsonpush["YEAR"] = rows[i].YEAR;
                      } else if (req.body.REPORT_TYPE === "2") {
                        jsonpush["MONTH"] = rows[i].MONTH;
                      } else if (req.body.REPORT_TYPE === "3") {
                        jsonpush["DAY"] = rows[i].DAY;
                      }

                      jsonpush["TOTAL_ORDER"] = rows[i].TOTAL_ORDER;
                      jsonpush["TOTAL_MONEY"] = rows[i].TOTAL_MONEY;
                      jsonpush["TOTAL_COMMISSION"] = rows[i].TOTAL_HH;
                      jsonpush["TOTAL_TT"] = rows[i].TOTAL_TT;
                      sub_.push(jsonpush);
                    }
                    jsonResponse["ERROR"] = newObj.ERROR;
                    jsonResponse["MESSAGE"] = newObj.MESSAGE;
                    jsonResponse["RESULT"] = newObj.RESULT;
                    jsonResponse["INFO"] = sub_;
                  }
                  console.log(jsonResponse);
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); 
      }
    );
  } catch (e) {
    console.log("Exception in report_default: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End report_default ######################");
  }
});

//report_item
app.post("/report_item", checkToken, function(req, res) {
  console.log("################# START report_item ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        //console.log(token.payload.username);
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.START_TIME,
          p3: req.body.END_TIME,
          p4: req.body.REPORT_TYPE,
          p5: req.body.CODE_PRODUCT,
          p6: req.body.PAGE,
          p7: req.body.NUMOFPAGE,
          p8: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.report_item(:p1, :p2, :p3, :p4, :p5, :p6, :p7, :p8); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_ = [];
                    for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      if (req.body.REPORT_TYPE === "1") {
                        jsonpush["ID_PRODUCT_CATEGORY"] = rows[i].ID_PRODUCT_CATEGORY;
                        jsonpush["NAME"] = rows[i].NAME;
                      } else if (req.body.REPORT_TYPE === "2") {
                        jsonpush["ID_PRODUCT_CATEGORY"] = rows[i].ID_PRODUCT_CATEGORY;
                        jsonpush["NAME"] = rows[i].NAME;
                      } else if (req.body.REPORT_TYPE === "3") {
                        jsonpush["ID_PRODUCT_PROPERTIES"] = rows[i].ID_PRODUCT_PROPERTIES;
                        jsonpush["PROPERTIES_NAME"] = rows[i].PROPERTIES;
                      } else if (req.body.REPORT_TYPE === "4") {
                        jsonpush["CODE_PRODUCT"] = rows[i].PR_CODE;
                        jsonpush["PRODUCT_NAME"] = rows[i].PRODUCT_NAME;
                      }

                      jsonpush["TOTAL_ORDER"] = rows[i].TONGDH;
                      jsonpush["TOTAL_QUANTITY"] = rows[i].SANLUONG;
                      jsonpush["TOTAL_REVENUE"] = rows[i].TONGDS;
                      sub_.push(jsonpush);
                    }
                    jsonResponse["ERROR"] = newObj.ERROR;
                    jsonResponse["MESSAGE"] = newObj.MESSAGE;
                    jsonResponse["RESULT"] = newObj.RESULT;
                    jsonResponse["INFO"] = sub_;
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in report_item: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End report_item ######################");
  }
});

//get_sub_product
app.post("/get_sub_product", function(req, res) {
  console.log("################# START get_sub_product ######################");
  var jsonResponse = {};
  try {
    var numRows = 1000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          p1: req.body.USERNAME,
          p2: req.body.ID_PARENT,
          p3: req.body.IDSHOP,
		  p4: req.body.SEARCH_NAME,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
		console.log(bindvars);
        connection.execute(
          "BEGIN :cursor := APPS.get_sub_product(:p1, :p2, :p3, :p4); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
            } else {
              result.outBinds.cursor.getRows(numRows, function(err, rows) {
                  if (err) {
                    console.error(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newList = [];
                        //newList.INFO = [];
                    var jsonpush2 = {};
                    var curid = "";
                    var currinfo = [];
                    var currMenu = {};
					var count_maxproduct=0;

                    for (var i = 0; i < rows.length; i++) {
                      var id = rows[i].ID;
                      var parent_name = rows[i].PARENT_NAME;
                      var sub_id = rows[i].SUB_ID;
                      var sub_name = rows[i].SUB_NAME;
                      var sub_id_parent = rows[i].ID_PARENT;
                      var id_product = rows[i].ID_PRODUCT;
                      var image_cover = rows[i].IMAGE_COVER;
                      var product_name = rows[i].PRODUCT_NAME;
                      var price = rows[i].PRICE;
                      var img1 = rows[i].IMG1;
                      var img2 = rows[i].IMG2;
                      var img3 = rows[i].IMG3;
                      var id_product_properties = rows[i].ID_PRODUCT_PROPERTIES;
                      var code_product = rows[i].CODE_PRODUCT;
                      var description = rows[i].DESCRIPTION;
                      var link_affiliate = rows[i].LINK_AFFILIATE;
                      var description_html = rows[i].DESCRIPTION_HTML;
                      var content_web = rows[i].CONTENT_WEB;
                      var content_fb = rows[i].CONTENT_FB;
                      var media_fb = rows[i].MEDIA_FB;
                      var video_fb = rows[i].VIDEO_FB;
                      var commission_product = rows[i].COMISSION_PRODUCT;
                      var start_promotion = rows[i].START_PROMOTION;
                      var end_promotion = rows[i].END_PROMOTION;
                      var price_promotion = rows[i].PRICE_PROMOTION;
                      var price_wholesale = rows[i].PRICE_WHOLESALE;
                      var warranty = rows[i].WARRANTY;
                      var price_import = rows[i].PRICE_IMPORT;
                      var maxhh = rows[i].HHMAX;
                      var training = rows[i].TRAINING;
					  var img_thumbnail = rows[i].IMG_THUMBNAIL;
                      if (curid !== id) {
                        if (curid.length > 0) {
                          currMenu.INFO = currinfo;
                          newList.push(currMenu);
                        }
                        currMenu = {};
                        currMenu["ID"] = id;
                        currMenu["PARENT_NAME"] = parent_name;
                        curid = id;
                        currinfo = [];
						count_maxproduct=0;
                      }
                      jsonpush2 = {};
                      jsonpush2["SUB_ID"] = sub_id;
                      jsonpush2["SUB_NAME"] = sub_name;
                      jsonpush2["SUB_ID_PARENT"] = sub_id_parent;
                      jsonpush2["ID_PRODUCT"] = id_product;
                      jsonpush2["IMAGE_COVER"] = image_cover;
                      jsonpush2["PRODUCT_NAME"] = product_name;
                      jsonpush2["PRICE"] = price;
                      jsonpush2["IMG1"] = img1;
                      jsonpush2["IMG2"] = img2;
                      jsonpush2["IMG3"] = img3;
                      jsonpush2["ID_PRODUCT_PROPERTIES"] = id_product_properties;
                      jsonpush2["CODE_PRODUCT"] = code_product;
                      jsonpush2["DESCRIPTION"] = description;
                      jsonpush2["LINK_AFFILIATE"] = link_affiliate;
                      jsonpush2["DESCRIPTION_HTML"] = description_html;
                      jsonpush2["CONTENT_WEB"] = content_web;
                      jsonpush2["CONTENT_FB"] = content_fb;
                      jsonpush2["MEDIA_FB"] = media_fb;
                      jsonpush2["VIDEO_FB"] = video_fb;
                      jsonpush2["COMISSION_PRODUCT"] = commission_product;
                      jsonpush2["START_PROMOTION"] = start_promotion;
                      jsonpush2["END_PROMOTION"] = end_promotion;
                      jsonpush2["PRICE_PROMOTION"] = price_promotion;
                      jsonpush2["PRICE_WHOLESALE"] = price_wholesale;
                      jsonpush2["WARRANTY"] = warranty;
                      jsonpush2["PRICE_IMPORT"] = price_import;
                      jsonpush2["MAXHH"] = maxhh;
                      jsonpush2["TRAINING"] = training;
                      jsonpush2["IMG_THUMBNAIL"] = img_thumbnail;
                      count_maxproduct=count_maxproduct+1;
                      // hien thi toi da 10 sp
                      if(count_maxproduct < 11){
                        currinfo.push(jsonpush2);
                      }
                    }
                    if (curid != "") {
                      currMenu.INFO = currinfo;
                      newList.push(currMenu);
                    }
                    jsonResponse["ERROR"] = "0000";
                    jsonResponse["MESSAGE"] = "SUCCESS";
                    jsonResponse["RESULT"] = "Lấy danh sách sản phẩm thành công";
                    jsonResponse["DETAIL"] = newList;
                  }
                  //console.log(jsonResponse);
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in get_sub_product: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End get_sub_product ######################");
  }
});

//get_sub_product1
app.post("/get_sub_product1", function(req, res) {
  console.log("################# START get_sub_product1 ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          p1: req.body.USERCODE,
          p2: req.body.ID_CATEGORY,
		      p3: req.body.ID_PRODUCT,
          p4: req.body.IDSHOP,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.get_sub_product1(:p1, :p2, :p3, :p4); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newList = [];
                        newList.INFO = [];
                    var jsonpush = {};
                    var jsonpush2 = {};
                    var curid = "";
                    var currinfo = [];
                    var currMenu = {};

                    for (var i = 0; i < rows.length; i++) {
                      var id = rows[i].ID;
                      var parent_name = rows[i].PARENT_NAME;
                      var sub_id = rows[i].SUB_ID;
                      var sub_name = rows[i].SUB_NAME;
                      var sub_id_parent = rows[i].ID_PARENT;
                      var id_product = rows[i].ID_PRODUCT;
                      var image_cover = rows[i].IMAGE_COVER;
                      var product_name = rows[i].PRODUCT_NAME;
                      var price = rows[i].PRICE;
                      var img1 = rows[i].IMG1;
                      var img2 = rows[i].IMG2;
                      var img3 = rows[i].IMG3;
                      var id_product_properties = rows[i].ID_PRODUCT_PROPERTIES;
                      var code_product = rows[i].CODE_PRODUCT;
                      var description = rows[i].DESCRIPTION;
                      var link_affiliate = rows[i].LINK_AFFILIATE;
                      var description_html = rows[i].DESCRIPTION_HTML;
                      var content_web = rows[i].CONTENT_WEB;
                      var content_fb = rows[i].CONTENT_FB;
                      var media_fb = rows[i].MEDIA_FB;
                      var video_fb = rows[i].VIDEO_FB;
                      var commission_product = rows[i].COMISSION_PRODUCT;
                      var start_promotion = rows[i].START_PROMOTION;
                      var end_promotion = rows[i].END_PROMOTION;
                      var price_promotion = rows[i].PRICE_PROMOTION;
                      var price_wholesale = rows[i].PRICE_WHOLESALE;
                      var warranty = rows[i].WARRANTY;
                      var price_import = rows[i].PRICE_IMPORT;
                      var maxhh = rows[i].HHMAX;
                      var training = rows[i].TRAINING;
					            var img_thumbnail = rows[i].IMG_THUMBNAIL;
                      if (curid !== id) {
                        if (curid.length > 0) {
                          currMenu.INFO = currinfo;
                          newList.push(currMenu);
                        }
                        currMenu = {};
                        currMenu["ID"] = id;
                        currMenu["PARENT_NAME"] = parent_name;
                        curid = id;
                        currinfo = [];
                      }
                      jsonpush2 = {};
                      jsonpush2["SUB_ID"] = sub_id;
                      jsonpush2["SUB_NAME"] = sub_name;
                      jsonpush2["SUB_ID_PARENT"] = sub_id_parent;
                      jsonpush2["ID_PRODUCT"] = id_product;
                      jsonpush2["IMAGE_COVER"] = image_cover;
                      jsonpush2["PRODUCT_NAME"] = product_name;
                      jsonpush2["PRICE"] = price;
                      jsonpush2["IMG1"] = img1;
                      jsonpush2["IMG2"] = img2;
                      jsonpush2["IMG3"] = img3;
                      jsonpush2["ID_PRODUCT_PROPERTIES"] = id_product_properties;
                      jsonpush2["CODE_PRODUCT"] = code_product;
                      jsonpush2["DESCRIPTION"] = description;
                      jsonpush2["LINK_AFFILIATE"] = link_affiliate;
                      jsonpush2["DESCRIPTION_HTML"] = description_html;
                      jsonpush2["CONTENT_WEB"] = content_web;
                      jsonpush2["CONTENT_FB"] = content_fb;
                      jsonpush2["MEDIA_FB"] = media_fb;
                      jsonpush2["VIDEO_FB"] = video_fb;
                      jsonpush2["COMISSION_PRODUCT"] = commission_product;
                      jsonpush2["START_PROMOTION"] = start_promotion;
                      jsonpush2["END_PROMOTION"] = end_promotion;
                      jsonpush2["PRICE_PROMOTION"] = price_promotion;
                      jsonpush2["PRICE_WHOLESALE"] = price_wholesale;
                      jsonpush2["WARRANTY"] = warranty;
                      jsonpush2["PRICE_IMPORT"] = price_import;
                      jsonpush2["MAXHH"] = maxhh;
                      jsonpush["TRAINING"] = training;
					            jsonpush["IMG_THUMBNAIL"] = img_thumbnail;
                      currinfo.push(jsonpush2);
                    }
                    if (curid != "") {
                      currMenu.INFO = currinfo;
                      newList.push(currMenu);
                    }
                    jsonResponse["ERROR"] = "0000";
                    jsonResponse["MESSAGE"] = "SUCCESS";
                    jsonResponse["RESULT"] = "Lấy danh sách sản phẩm thành công";
                    jsonResponse["DETAIL"] = newList;
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in get_sub_product1: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End get_sub_product1 ######################");
  }
});

//get_sub_product_child
app.post("/get_sub_product_child", function(req, res) {
  console.log(
    "################# START get_sub_product_child ######################"
  );
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          p1: req.body.USERNAME,
          p2: req.body.SUB_ID,
          p3: req.body.IDSHOP,
    		  p4: req.body.SEARCH_NAME,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        console.log(bindvars);
        connection.execute(
          "BEGIN :cursor := APPS.get_sub_product_child(:p1, :p2, :p3, :p4); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newList = [];
                        newList.INFO = [];
                    var jsonpush = {};
                    var jsonpush2 = {};
                    var curid = "";
                    var currinfo = [];
                    var currMenu = {};
		          			var count_maxproduct=0;

                    for (var i = 0; i < rows.length; i++) {
                      var sub_id = rows[i].SUB_ID;
                      var sub_name = rows[i].SUB_NAME;

                      var sub_id_parent = rows[i].ID_PARENT;
                      var id_product = rows[i].ID_PRODUCT;
                      var image_cover = rows[i].IMAGE_COVER;
                      var product_name = rows[i].PRODUCT_NAME;
                      var price = rows[i].PRICE;
                      var img1 = rows[i].IMG1;
                      var img2 = rows[i].IMG2;
                      var img3 = rows[i].IMG3;
                      var id_product_properties = rows[i].ID_PRODUCT_PROPERTIES;
                      var code_product = rows[i].CODE_PRODUCT;
                      var description = rows[i].DESCRIPTION;
                      var link_affiliate = rows[i].LINK_AFFILIATE;
                      var description_html = rows[i].DESCRIPTION_HTML;
                      var content_web = rows[i].CONTENT_WEB;
                      var content_fb = rows[i].CONTENT_FB;
                      var media_fb = rows[i].MEDIA_FB;
                      var video_fb = rows[i].VIDEO_FB;
                      var commission_product= rows[i].COMISSION_PRODUCT;
                      var start_promotion = rows[i].START_PROMOTION;
                      var end_promotion = rows[i].END_PROMOTION;
                      var price_promotion = rows[i].PRICE_PROMOTION;
                      var price_wholesale = rows[i].PRICE_WHOLESALE;
                      var warranty = rows[i].WARRANTY;
                      var price_import = rows[i].PRICE_IMPORT;
                      var maxhh = rows[i].HHMAX;
                      var training = rows[i].TRAINING;
                      var img_thumbnail = rows[i].IMG_THUMBNAIL;
                      if (curid !== sub_id) {
                        if (curid.length > 0) {
                          currMenu.INFO = currinfo;
                          newList.push(currMenu);
                        }
                        currMenu = {};
                        currMenu["SUB_ID"] = sub_id;
                        currMenu["SUB_NAME"] = sub_name;
                        curid = sub_id;
                        currinfo = [];
						            count_maxproduct=0;
                      }
                      jsonpush2 = {};
            					jsonpush2["SUB_ID"] = sub_id;
                      jsonpush2["SUB_ID_PARENT"] = sub_id_parent;
                      jsonpush2["ID_PRODUCT"] = id_product;
                      jsonpush2["IMAGE_COVER"] = image_cover;
                      jsonpush2["PRODUCT_NAME"] = product_name;
                      jsonpush2["PRICE"] = price;
                      jsonpush2["IMG1"] = img1;
                      jsonpush2["IMG2"] = img2;
                      jsonpush2["IMG3"] = img3;
                      jsonpush2["ID_PRODUCT_PROPERTIES"] = id_product_properties;
                      jsonpush2["CODE_PRODUCT"] = code_product;
                      jsonpush2["DESCRIPTION"] = description;
                      jsonpush2["LINK_AFFILIATE"] = link_affiliate;
                      jsonpush2["DESCRIPTION_HTML"] = description_html;
                      jsonpush2["CONTENT_WEB"] = content_web;
                      jsonpush2["CONTENT_FB"] = content_fb;
                      jsonpush2["MEDIA_FB"] = media_fb;
                      jsonpush2["VIDEO_FB"] = video_fb;
                      jsonpush2["COMISSION_PRODUCT"] = commission_product;
                      jsonpush2["START_PROMOTION"] = start_promotion;
                      jsonpush2["END_PROMOTION"] = end_promotion;
                      jsonpush2["PRICE_PROMOTION"] = price_promotion;
                      jsonpush2["PRICE_WHOLESALE"] = price_wholesale;
                      jsonpush2["WARRANTY"] = warranty;
                      jsonpush2["PRICE_IMPORT"] = price_import;
                      jsonpush2["MAXHH"] = maxhh;
                      jsonpush["TRAINING"] = training;
					            jsonpush["IMG_THUMBNAIL"] = img_thumbnail;
					            count_maxproduct=count_maxproduct+1;
                      // hien thi toi da 10 sp
                      if(count_maxproduct<11){
                        currinfo.push(jsonpush2);
                      }
                    }
                    if (curid != "") {
                      currMenu.INFO = currinfo;
                      newList.push(currMenu);
                    }
                    jsonResponse["ERROR"] = "0000";
                    jsonResponse["MESSAGE"] = "SUCCESS";
                    jsonResponse["RESULT"] = "Lấy danh sách sản phẩm thành công";
                    jsonResponse["DETAIL"] = newList;
                    //console.log(jsonResponse);
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in get_sub_product_child: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End get_sub_product_child ######################"
    );
  }
});

app.post("/get_product_search", function(req, res) {
  console.log("################# START get_product_search ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 1000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
		
        var bindvars = {
          p1: req.body.USERNAME,
		  p2: req.body.IDSHOP,
		  p3: req.body.KEYWORD,
          p4: req.body.PAGE,
          p5: req.body.NUMOFPAGE, 
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := API_APPS.get_product_by_search(:p1, :p2, :p3, :p4, :p5); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_ = [];
                    for (var i = 0; i < rows.length; i++) {
						var jsonpush = {};
						jsonpush["SUB_ID"] = rows[i].SUB_ID;
						jsonpush["SUB_NAME"] = rows[i].SUB_NAME;
						jsonpush["SUB_ID_PARENT"] = rows[i].ID_PARENT;
						jsonpush["PARENT_NAME"] = rows[i].PARENT_NAME;
						jsonpush["ID_PRODUCT"] = rows[i].ID_PRODUCT;
						jsonpush["PRODUCT_NAME"] = rows[i].PRODUCT_NAME;
						jsonpush["PRICE"] = rows[i].PRICE;
						jsonpush["IMAGE_COVER"] = rows[i].IMAGE_COVER;
						jsonpush["IMG1"] = rows[i].IMG1;
						jsonpush["IMG2"] = rows[i].IMG2;
						jsonpush["IMG3"] = rows[i].IMG3;
						jsonpush["ID_PRODUCT_PROPERTIES"] = rows[i].ID_PRODUCT_PROPERTIES;
						jsonpush["CODE_PRODUCT"] = rows[i].CODE_PRODUCT;
						jsonpush["DESCRIPTION"] = rows[i].DESCRIPTION;
						jsonpush["LINK_AFFILIATE"] = rows[i].LINK_AFFILIATE;
						jsonpush["DESCRIPTION_HTML"] = rows[i].DESCRIPTION_HTML;
						jsonpush["CONTENT_FB"] = rows[i].CONTENT_FB;
						jsonpush["MEDIA_FB"] = rows[i].MEDIA_FB;
						jsonpush["VIDEO_FB"] = rows[i].VIDEO_FB;
						jsonpush["COMISSION_PRODUCT"] = rows[i].COMISSION_PRODUCT;
						jsonpush["START_PROMOTION"] = rows[i].START_PROMOTION;
						jsonpush["END_PROMOTION"] = rows[i].END_PROMOTION;
						jsonpush["PRICE_PROMOTION"] = rows[i].PRICE_PROMOTION;
						jsonpush["PRICE_WHOLESALE"] = rows[i].PRICE_WHOLESALE;
						jsonpush["WARRANTY"] = rows[i].WARRANTY;
						jsonpush["PRICE_IMPORT"] = rows[i].PRICE_IMPORT;
						jsonpush["MAXHH"] = rows[i].HHMAX;
						sub_.push(jsonpush);
                    }
                    jsonResponse["ERROR"] = rows[0].ERROR;
                    jsonResponse["MESSAGE"] = rows[0].MESSAGE;
                    jsonResponse["RESULT"] = rows[0].RESULT;
                    jsonResponse["INFO"] = sub_;
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in get_product_search: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End get_product_search ######################");
  }
});

app.post("/get_list_notify", checkToken, function(req, res) {
  console.log("################# START get_list_notify ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 1000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        //console.log(token.payload.username);
		
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.PAGE,
          p3: req.body.NUMOFPAGE,
          p4: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.get_list_nofi(:p1, :p2, :p3, :p4); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_ = [];
                    for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      jsonpush["ID"] = rows[i].ID;
                      jsonpush["CONTENT"] = rows[i].CONTENT;
                      jsonpush["SENT_TIME"] = rows[i].SENT_TIME;
                      jsonpush["IS_READ"] = rows[i].IS_READ;
					  jsonpush["TYPE"] = rows[i].TYPES;
                      sub_.push(jsonpush);
                    }
                    jsonResponse["ERROR"] = rows[0].ERROR;
                    jsonResponse["MESSAGE"] = rows[0].MESSAGE;
                    jsonResponse["RESULT"] = rows[0].RESULT;
                    jsonResponse["SUM_NOT_READ"] = rows[0].TONG;
                    jsonResponse["INFO"] = sub_;
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in get_list_notify: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End get_list_notify ######################");
  }
});

app.post("/update_notify", checkToken, function(req, res) {
  console.log("################# START update_notify ######################");
  var jsonResponse = {};
  try {
    var numRows = 1;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.ID_NOTIFY,
          p3: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        console.log(bindvars);
        connection.execute(
          "BEGIN :cursor := APPS.update_list_nofi(:p1, :p2, :p3); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    jsonResponse["ERROR"] = newObj.ERROR;
                    jsonResponse["MESSAGE"] = newObj.MESSAGE;
                    jsonResponse["RESULT"] = newObj.RESULT;
                  }
                  console.log(jsonResponse);
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in update_notify: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End update_notify ######################");
  }
});

app.post("/update_comission", checkToken, function(req, res) {
  console.log(
    "################# START update_comission ######################"
  );
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 10;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters //
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        //console.log(token.payload.username);
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.USER_CTV,
          p3: req.body.AMOUNT,
          p4: req.body.COMMENTS,
          p5: req.body.TYPES,
          p6: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.update_commis(:p1, :p2, :p3, :p4, :p5, :p6); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var jsonResponse = {};
                    jsonResponse["ERROR"] = newObj.ERROR;
                    jsonResponse["MESSAGE"] = newObj.MESSAGE;
                    jsonResponse["RESULT"] = newObj.RESULT;
                  }
                  console.log(jsonResponse);
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in update_comission: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End update_comission ######################"
    );
  }
});

app.post("/report_ctv", checkToken, function(req, res) {
  console.log("################# START report_ctv ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.YEAR,
          p3: req.body.MONTH,
          p4: req.body.REPORT_TYPE,
          p5: token.payload.idshop,
		  p6: (typeof req.body.SEARCH === 'undefined' ? '' : req.body.SEARCH),
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.report_ctv(:p1, :p2, :p3, :p4, :p5, :p6); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_ = [];
                    for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      jsonpush["FULL_NAME"] = rows[i].FULL_NAME;
                      jsonpush["CREATE_BY"] = rows[i].CREATE_BY;
                      jsonpush["USER_CODE"] = rows[i].USER_CODE;
                      jsonpush["SUM_ORDER"] = rows[i].SUM_ORDER;
                      jsonpush["SUM_MONEY"] = rows[i].SUM_MONEY;
                      jsonpush["SUM_COMMISSION"] = rows[i].SUM_COMMISSION;
                      sub_.push(jsonpush);
                    }
                    jsonResponse["ERROR"] = newObj.ERROR;
                    jsonResponse["MESSAGE"] = newObj.MESSAGE;
                    jsonResponse["RESULT"] = newObj.RESULT;
                    jsonResponse["INFO"] = sub_;
                  }
                  console.log(jsonResponse);
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in report_ctv: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End report_ctv ######################");
  }
});

app.post("/report_ctv_detail", checkToken, function(req, res) {
  console.log(
    "################# START report_ctv_detail ######################"
  );
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 1000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        //console.log(token.payload.username);
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.USER_CTV,
          p3: req.body.YEAR,
          p4: req.body.MONTH,
          p5: req.body.PAGE,
          p6: req.body.NUMOFPAGE,
          p7: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.report_ctv_detail(:p1, :p2, :p3, :p4, :p5, :p6, :p7); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_ = [];
                    for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      jsonpush["CREATE_BY"] = rows[i].CREATE_BY;
                      jsonpush["CREATE_DATE"] = rows[i].CREATE_DATE;
                      jsonpush["FN_TIME"] = rows[i].FN_TIME;
                      jsonpush["CODE_ORDER"] = rows[i].CODE_ORDER;
                      jsonpush["SUM_MONEY"] = rows[i].SUM_MONEY;
                      jsonpush["SUM_COMMISSION"] = rows[i].SUM_COMMISSION;
                      sub_.push(jsonpush);
                    }
                    jsonResponse["ERROR"] = newObj.ERROR;
                    jsonResponse["MESSAGE"] = newObj.MESSAGE;
                    jsonResponse["RESULT"] = newObj.RESULT;
                    jsonResponse["FULL_NAME"] = newObj.FULL_NAME;
                    jsonResponse["USER_CODE"] = newObj.USER_CODE;
                    jsonResponse["MOBILE"] = newObj.CREATE_BY;
                    jsonResponse["EMAIL"] = newObj.EMAIL;
                    jsonResponse["INFO"] = sub_;
                  }
                  //console.log(jsonResponse);
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in report_ctv_detail: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End report_ctv_detail ######################"
    );
  }
});

app.post("/update_withdrawal", checkToken, function(req, res) {
  console.log(
    "################# START update_withdrawal ######################"
  );
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 1000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        //console.log(token.payload.username);
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.ID_REQUEST,
          p3: req.body.STATUS,
          p4: req.body.AMOUNT,
          p5: req.body.COMMENTS,
          p6: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.update_withdrawal(:p1, :p2, :p3, :p4, :p5, :p6); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    jsonResponse["ERROR"] = newObj.ERROR;
                    jsonResponse["MESSAGE"] = newObj.MESSAGE;
                    jsonResponse["RESULT"] = newObj.RESULT;
                  }
                  console.log(jsonResponse);
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in update_withdrawal: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End update_withdrawal ######################"
    );
  }
});

app.post("/get_infomation", function(req, res) {
  console.log("################# START get_infomation ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 1000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          p1: req.body.USERNAME,
          p2: req.body.TYPES,
          p3: req.body.CATEGORY,
          p4: req.body.IDSHOP,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.get_infomation(:p1, :p2, :p3, :p4); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var sub_ = [];
                    for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      if (req.body.TYPES === "2" || req.body.TYPES === "4") {
                        jsonpush["COMMENTS"] = rows[i].COMMENTS;
                      } else if (req.body.TYPES === "3") {
                        jsonpush["COMMENTS"] = rows[i].COMMENTS;
                        jsonpush["CATEGORY"] = rows[i].CATEGORY;
                      }
                      jsonpush["TYPES"] = rows[i].TYPES;
                      jsonpush["ID"] = rows[i].ID;
                      jsonpush["TITLE"] = rows[i].TITLE;
                      jsonpush["CONTENT"] = rows[i].CONTENT;
                      jsonpush["CREATE_DATE"] = rows[i].CREATE_DATE;
                      jsonpush["DESCRIPTION"] = rows[i].DESCRIPTION;
                      jsonpush["IS_ACTIVE"] = rows[i].IS_ACTIVE;
                      jsonpush["IMAGE_COVER"] = rows[i].IMAGE_COVER;
                      sub_.push(jsonpush);
                    }
                    jsonResponse["ERROR"] = rows[0].ERROR;
                    jsonResponse["MESSAGE"] = rows[0].MESSAGE;
                    jsonResponse["RESULT"] = rows[0].RESULT;
                    jsonResponse["INFO"] = sub_;
                  }
                  res.send(jsonResponse);
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in get_infomation: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End get_infomation ######################");
  }
});

//report_fluctuations
app.post("/report_fluctuations", checkToken, function(req, res) {
  console.log(
    "################# START report_fluctuations ######################"
  );
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        //console.log(token.payload.username);
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.YEAR,
          p3: req.body.MONTH,
          p4: req.body.PR_CODE,
          p5: req.body.REPORT_TYPE,
          p6: req.body.DISPLAY_TYPE,
          p7: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.report_fluctuations(:p1, :p2, :p3, :p4, :p5, :p6, :p7); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_ = [];
                    for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      if (req.body.REPORT_TYPE === "1") {
                        jsonpush["MONTH"] = rows[i].MONTH;
                      } else if (req.body.REPORT_TYPE === "2") {
                        jsonpush["DAY"] = rows[i].DAY;
                      }

                      if (
                        req.body.DISPLAY_TYPE === "1" ||
                        req.body.DISPLAY_TYPE === "2"
                      ) {
                        jsonpush["ID_PRODUCT_CATEGORY"] = rows[i].ID_PRODUCT_CATEGORY;
                        jsonpush["NAME"] = rows[i].NAME;
                      } else if (req.body.DISPLAY_TYPE === "3") {
                        jsonpush["ID_PRODUCT_PROPERTIES"] = rows[i].ID_PRODUCT_PROPERTIES;
                        jsonpush["PROPERTIES"] = rows[i].PROPERTIES;
                      } else if (req.body.DISPLAY_TYPE === "4") {
                        jsonpush["PR_CODE"] = rows[i].PR_CODE;
                        jsonpush["PRODUCT_NAME"] = rows[i].PRODUCT_NAME;
                      }

                      jsonpush["TOTAL_ORDER"] = rows[i].TONGDH;
                      jsonpush["TOTAL_QUANTITY"] = rows[i].SANLUONG;
                      jsonpush["TOTAL_REVENUE"] = rows[i].TONGDS;
                      sub_.push(jsonpush);
                    }
                    jsonResponse["ERROR"] = newObj.ERROR;
                    jsonResponse["MESSAGE"] = newObj.MESSAGE;
                    jsonResponse["RESULT"] = newObj.RESULT;
                    jsonResponse["INFO"] = sub_;
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in report_fluctuations: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End report_fluctuations ######################"
    );
  }
});
//info_category
app.post("/get_info_category", checkToken, function(req, res) {
  console.log(
    "################# START get_info_category ######################"
  );
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        //console.log(token.payload.username);
        var bindvars = {
          p1: token.payload.username,
          p2: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.info_cat(:p1, :p2); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_ = [];
                    for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      jsonpush["TYPES"] = rows[i].TYPES;
                      jsonpush["TYPES_NAME"] = rows[i].TYPES_NAME;
                      jsonpush["ACTIVE_WAIT"] = rows[i].ACTIVE_WAIT;
                      jsonpush["ACTIVE_DENIED"] = rows[i].ACTIVE_DENIED;
                      sub_.push(jsonpush);
                    }
                    jsonResponse["ERROR"] = newObj.ERROR;
                    jsonResponse["MESSAGE"] = newObj.MESSAGE;
                    jsonResponse["RESULT"] = newObj.RESULT;
                    jsonResponse["INFO"] = sub_;
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in get_info_category: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End get_info_category ######################"
    );
  }
});
//get_info_list
app.post("/get_info_list", checkToken, function(req, res) {
  console.log("################# START get_info_list ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        //console.log(token.payload.username);
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.TYPES,
          p3: req.body.IS_ACTIVE,
          p4: req.body.PAGE,
          p5: req.body.NUMOFPAGE,
          p6: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.info_list(:p1, :p2, :p3, :p4, :p5, :p6 ); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_ = [];
                    for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      jsonpush["ID"] = rows[i].ID;
                      jsonpush["TITLE"] = rows[i].TITLE;
                      jsonpush["CONTENT"] = rows[i].CONTENT;
                      jsonpush["CREATE_DATE"] = rows[i].CREATE_DATE;
                      jsonpush["TYPES"] = rows[i].TYPES;
                      jsonpush["DESCRIPTION"] = rows[i].DESCRIPTION;
                      jsonpush["ID_USER"] = rows[i].ID_USER;
                      jsonpush["FULL_NAME"] = rows[i].FULL_NAME;
                      jsonpush["IS_ACTIVE"] = rows[i].IS_ACTIVE;
                      jsonpush["ACTIVE_NAME"] = rows[i].ACTIVE_NAME;
                      jsonpush["IMAGE_COVER"] = rows[i].IMAGE_COVER;
                      sub_.push(jsonpush);
                    }
                    jsonResponse["ERROR"] = newObj.ERROR;
                    jsonResponse["MESSAGE"] = newObj.MESSAGE;
                    jsonResponse["RESULT"] = newObj.RESULT;
                    jsonResponse["INFO"] = sub_;
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in get_info_list: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End get_info_list ######################");
  }
});

//get_info_detail
app.post("/get_info_detail", checkToken, function(req, res) {
  console.log("################# START get_info_detail ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        //console.log(token.payload.username);
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.ID_INFO,
          p3: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.info_detail(:p1, :p2, :p3); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
      			  console.log(jsonResponse);
			        res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  console.log(jsonResponse);
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in get_info_detail: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End get_info_detail ######################");
  }
});

//get_info_detail
app.post("/get_info_history", checkToken, function(req, res) {
  console.log(
    "################# START get_info_history ######################"
  );
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        //console.log(token.payload.username);
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.ID_INFO,
          p3: req.body.PAGE,
          p4: req.body.NUMOFPAGE,
          p5: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.info_his(:p1, :p2, :p3, :p4, :p5); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_ = [];
                    for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      jsonpush["ID"] = rows[i].ID;
                      jsonpush["ID_INFO"] = rows[i].ID_INFO;
                      jsonpush["COMMENTS"] = rows[i].COMMENTS;
                      jsonpush["IS_ACTIVE"] = rows[i].IS_ACTIVE;
                      jsonpush["CREATE_TIME"] = rows[i].CREATE_TIME;
                      jsonpush["ACTIVE_NAME"] = rows[i].ACTIVE_NAME;
                      jsonpush["ID_USER"] = rows[i].ID_USER;
                      sub_.push(jsonpush);
                    }
                    jsonResponse["ERROR"] = newObj.ERROR;
                    jsonResponse["MESSAGE"] = newObj.MESSAGE;
                    jsonResponse["RESULT"] = newObj.RESULT;
                    jsonResponse["INFO"] = sub_;
                    
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in get_info_history: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End get_info_history ######################"
    );
  }
});

//info_change
app.post("/info_change", checkToken, function(req, res) {
  console.log("################# START info_change ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 10;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        //console.log(token.payload.username);
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.ID_INFO,
          p3: req.body.IS_ACTIVE,
          p4: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.info_change(:p1, :p2, :p3, :p4); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in info_change: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End info_change ######################");
  }
});

app.post("/get_config_commission", checkToken, function(req, res) {
  console.log(
    "################# START get_config_commission ######################"
  );
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 10;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        //console.log(token.payload.username);
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.VALUES,
          p3: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.get_config_commis(:p1, :p2, '2', :p3); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in get_config_commission: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End get_config_commission ######################"
    );
  }
});

app.post("/get_config1", checkToken, function(req, res) {
  console.log("################# START get_config1 ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        var bindvars = {
          p1: token.payload.username,
          p2: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.config1(:p1, '2', :p2); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
      		  doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_ = [];
                    for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      jsonpush["ID"] = rows[i].ID;
                      jsonpush["VALUE"] = rows[i].VALUE;
                      jsonpush["DISCOUNT_UP"] = rows[i].DISCOUNT_UP;
                      jsonpush["DISCOUNT_DOWN"] = rows[i].DISCOUNT_DOWN;
                      jsonpush["TYPES"] = rows[i].TYPES;
                      sub_.push(jsonpush);
                    }
                    jsonResponse["ERROR"] = newObj.ERROR;
                    jsonResponse["MESSAGE"] = newObj.MESSAGE;
                    jsonResponse["RESULT"] = newObj.RESULT;
                    jsonResponse["INFO"] = sub_;
                  }
                  console.log(jsonResponse);
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in get_config1: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End get_config1 ######################");
  }
});

//get_product_trend
app.post("/get_product_trend", function(req, res) {
  console.log(
    "################# START get_product_trend ######################"
  );
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          p1: req.body.USERNAME,
          p2: req.body.IDSHOP,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        console.log(bindvars);
        connection.execute(
          "BEGIN :cursor := APPS.get_product_trend(:p1, :p2); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                 		console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    //var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_product = [];
                    console.log("rows: " +rows.length);
                    for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      jsonpush["ID"] = rows[i].ID;
          					  jsonpush["ID_PRODUCT"] = rows[i].ID;
                      jsonpush["IMAGE_COVER"] = rows[i].IMAGE_COVER;
                      jsonpush["PRODUCT_NAME"] = rows[i].PRODUCT_NAME;
                      jsonpush["PRICE"] = rows[i].PRICE;
                      jsonpush["IMG1"] = rows[i].IMG1;
                      jsonpush["IMG2"] = rows[i].IMG2;
                      jsonpush["IMG3"] = rows[i].IMG3;
                      jsonpush["ID_PRODUCT_PROPERTIES"] = rows[i].ID_PRODUCT_PROPERTIES;
                      jsonpush["PROPERTIES_NAME"] = rows[i].PROPERTIES_NAME;
                      jsonpush["PROPERTIES"] = rows[i].PROPERTIES;
                      jsonpush["CODE_PRODUCT"] = rows[i].CODE_PRODUCT;
                      jsonpush["DESCRIPTION"] = rows[i].DESCRIPTION;
                      jsonpush["SUB_ID"] = rows[i].SUB_ID_PARENT;
                      jsonpush["DESCRIPTION_HTML"] = rows[i].DESCRIPTION_HTML;
                      jsonpush["LINK_AFFILIATE"] = rows[i].LINK_AFFILIATE;
                      jsonpush["COMMISSION"] = rows[i].COMMISSION;
                      jsonpush["CONTENT_WEB"] = rows[i].CONTENT_WEB;
                      jsonpush["CONTENT_FB"] = rows[i].CONTENT_FB;
                      jsonpush["MEDIA_FB"] = rows[i].MEDIA_FB;
                      jsonpush["VIDEO_FB"] = rows[i].VIDEO_FB;
                      jsonpush["STATUS_TREND"] = rows[i].STATUS_TREND;
                      jsonpush["COMISSION_PRODUCT"] = rows[i].COMISSION_PRODUCT;
					            jsonpush["START_PROMOTION"] = rows[i].START_PROMOTION;
                      jsonpush["END_PROMOTION"] = rows[i].END_PROMOTION;
                      jsonpush["PRICE_PROMOTION"] = rows[i].PRICE_PROMOTION;
                      jsonpush["PRICE_WHOLESALE"] = rows[i].PRICE_WHOLESALE;
                      jsonpush["WARRANTY"] = rows[i].WARRANTY;
                      jsonpush["PRICE_IMPORT"] = rows[i].PRICE_IMPORT;
					            jsonpush["HHMAX"] = rows[i].HHMAX;
                      jsonpush["TRAINING"] = rows[i].TRAINING;
					            jsonpush["IMG_THUMBNAIL"] = rows[i].IMG_THUMBNAIL;

                      sub_product.push(jsonpush);
                    }
                    jsonResponse["ERROR"] = rows[0].ERROR;
                    jsonResponse["MESSAGE"] = rows[0].MESSAGE;
                    jsonResponse["RESULT"] = rows[0].RESULT;
                    jsonResponse["INFO"] = sub_product;
                    
                  }
        		  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in get_product_trend: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End get_product_trend ######################"
    );
  }
});

//get_product_trend_status
app.post("/get_product_trend_status", function(req, res) {
  console.log(
    "################# START get_product_trend_status ######################"
  );
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          p1: req.body.TREND_STATUS,
          p2: req.body.USERNAME,
          p3: req.body.IDSHOP,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        console.log(bindvars);
        connection.execute(
          "BEGIN :cursor := API_APPS.get_product_trend_status(:p1, :p2, :p3); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                 		console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    //var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_product = [];
                    console.log("rows: " +rows.length);
                    for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      jsonpush["ID"] = rows[i].ID;
          					  jsonpush["ID_PRODUCT"] = rows[i].ID;
                      jsonpush["IMAGE_COVER"] = rows[i].IMAGE_COVER;
                      jsonpush["PRODUCT_NAME"] = rows[i].PRODUCT_NAME;
                      jsonpush["PRICE"] = rows[i].PRICE;
                      jsonpush["IMG1"] = rows[i].IMG1;
                      jsonpush["IMG2"] = rows[i].IMG2;
                      jsonpush["IMG3"] = rows[i].IMG3;
                      jsonpush["ID_PRODUCT_PROPERTIES"] = rows[i].ID_PRODUCT_PROPERTIES;
                      jsonpush["PROPERTIES_NAME"] = rows[i].PROPERTIES_NAME;
                      jsonpush["PROPERTIES"] = rows[i].PROPERTIES;
                      jsonpush["CODE_PRODUCT"] = rows[i].CODE_PRODUCT;
                      jsonpush["DESCRIPTION"] = rows[i].DESCRIPTION;
                      jsonpush["SUB_ID"] = rows[i].SUB_ID_PARENT;
                      jsonpush["DESCRIPTION_HTML"] = rows[i].DESCRIPTION_HTML;
                      jsonpush["LINK_AFFILIATE"] = rows[i].LINK_AFFILIATE;
                      jsonpush["COMMISSION"] = rows[i].COMMISSION;
                      jsonpush["CONTENT_WEB"] = rows[i].CONTENT_WEB;
                      jsonpush["CONTENT_FB"] = rows[i].CONTENT_FB;
                      jsonpush["MEDIA_FB"] = rows[i].MEDIA_FB;
                      jsonpush["VIDEO_FB"] = rows[i].VIDEO_FB;
                      jsonpush["STATUS_TREND"] = rows[i].STATUS_TREND;
                      jsonpush["COMISSION_PRODUCT"] = rows[i].COMISSION_PRODUCT;
					            jsonpush["START_PROMOTION"] = rows[i].START_PROMOTION;
                      jsonpush["END_PROMOTION"] = rows[i].END_PROMOTION;
                      jsonpush["PRICE_PROMOTION"] = rows[i].PRICE_PROMOTION;
                      jsonpush["PRICE_WHOLESALE"] = rows[i].PRICE_WHOLESALE;
                      jsonpush["WARRANTY"] = rows[i].WARRANTY;
                      jsonpush["PRICE_IMPORT"] = rows[i].PRICE_IMPORT;
					            jsonpush["HHMAX"] = rows[i].HHMAX;
                      jsonpush["TRAINING"] = rows[i].TRAINING;
					            jsonpush["IMG_THUMBNAIL"] = rows[i].IMG_THUMBNAIL;

                      sub_product.push(jsonpush);
                    }
                    jsonResponse["ERROR"] = rows[0].ERROR;
                    jsonResponse["MESSAGE"] = rows[0].MESSAGE;
                    jsonResponse["RESULT"] = rows[0].RESULT;
                    jsonResponse["INFO"] = sub_product;
                    
                  }
        		  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in get_product_trend: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End get_product_trend ######################"
    );
  }
});

app.post("/get_product_trend1", function(req, res) {
  console.log(
    "################# START get_product_trend1 ######################"
  );
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          p1: req.body.USERNAME,
          p2: req.body.IDSHOP,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.get_product_trend1(:p1, :p2); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                 		console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_product = [];
                    for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      jsonpush["ID"] = rows[i].ID;
          					  jsonpush["ID_PRODUCT"] = rows[i].ID;
                      jsonpush["IMAGE_COVER"] = rows[i].IMAGE_COVER;
                      jsonpush["PRODUCT_NAME"] = rows[i].PRODUCT_NAME;
                      jsonpush["PRICE"] = rows[i].PRICE;
                      jsonpush["ID_PRODUCT_PROPERTIES"] = rows[i].ID_PRODUCT_PROPERTIES;
                      jsonpush["PROPERTIES_NAME"] = rows[i].PROPERTIES_NAME;
                      jsonpush["PROPERTIES"] = rows[i].PROPERTIES;
                      jsonpush["CODE_PRODUCT"] = rows[i].CODE_PRODUCT;
                      jsonpush["SUB_ID"] = rows[i].SUB_ID_PARENT;
                      jsonpush["DESCRIPTION_HTML"] = rows[i].DESCRIPTION_HTML;
                      jsonpush["LINK_AFFILIATE"] = rows[i].LINK_AFFILIATE;
                      jsonpush["COMMISSION"] = rows[i].COMMISSION;
                      jsonpush["STATUS_TREND"] = rows[i].STATUS_TREND;
                      jsonpush["COMISSION_PRODUCT"] = rows[i].COMISSION_PRODUCT;
					            jsonpush["START_PROMOTION"] = rows[i].START_PROMOTION;
                      jsonpush["END_PROMOTION"] = rows[i].END_PROMOTION;
                      jsonpush["PRICE_PROMOTION"] = rows[i].PRICE_PROMOTION;
                      jsonpush["PRICE_WHOLESALE"] = rows[i].PRICE_WHOLESALE;
                      jsonpush["WARRANTY"] = rows[i].WARRANTY;
                      jsonpush["PRICE_IMPORT"] = rows[i].PRICE_IMPORT;
					            jsonpush["HHMAX"] = rows[i].HHMAX;
                      jsonpush["TRAINING"] = rows[i].TRAINING;
					            jsonpush["IMG_THUMBNAIL"] = rows[i].IMG_THUMBNAIL;

                      sub_product.push(jsonpush);
                    }
                    jsonResponse["ERROR"] = newObj.ERROR;
                    jsonResponse["MESSAGE"] = newObj.MESSAGE;
                    jsonResponse["RESULT"] = newObj.RESULT;
                    jsonResponse["INFO"] = sub_product;
                  }
				  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in get_product_trend: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End get_product_trend ######################"
    );
  }
});

/*Gửi mã kích hoạt
app.post('/sendCode', async (req, res) => {
  console.log("################# START GET OTP ######################");
  var jsonResponse = {};
	try{
		var reqBody = JSON.parse(JSON.stringify(req.body));
		console.log(reqBody);
		var numRows = 10;
		oracledb.fetchAsString = [oracledb.CLOB];
		oracledb.getConnection(
		  {
			user: dbConfig.user,
			password: dbConfig.password,
			connectString: dbConfig.connectString
		  },
      function(err, connection) {
        console.log("################# START 111111 ######################");
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var msisdn = typeof reqBody.MSISDN !== "undefined" ? reqBody.MSISDN : "";
        if (msisdn.length > 0) msisdn = validateMsisdn(msisdn);
        if(msisdn.length === 0 ){
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Số điện thoại không hợp lệ";
          console.log(jsonResponse);
          res.send(jsonResponse);
        }else{
          var bindvars = {
            p1: req.body.MSISDN,
            p2: '2',
            p3: req.body.IDSHOP,
            cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
          };
          connection.execute(
            "BEGIN :cursor := init.gen_otp(:p1, :p2, :p3); END;",
            bindvars,
            { outFormat: oracledb.OBJECT },
            function(err, result) {
              if (err) {
                console.error(err);
                //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                doRelease(connection);
                jsonResponse["ERROR"] = "0003";
                jsonResponse["MESSAGE"] = "FAILED";
                jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
                console.log(jsonResponse);
                res.send(jsonResponse);
                return;
              } else {
                result.outBinds.cursor.getRows(
                  numRows,
                  function(err, rows) {
                    if (err) {
                      console.log(err);
                      jsonResponse["ERROR"] = "0003";
                      jsonResponse["MESSAGE"] = "FAILED";
                      jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                      doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                      doRelease(connection);  
                      console.log(jsonResponse);
                      res.send(jsonResponse);
                    } else if (rows == null || rows.length === 0) {
                      jsonResponse["ERROR"] = "0004";
                      jsonResponse["MESSAGE"] = "FAILED";
                      jsonResponse["RESULT"] = "Không có dữ liệu";
                      doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                      doRelease(connection);  
                      console.log(jsonResponse);
                      res.send(jsonResponse);
                    } else {
						let rsCode = "";
                      for (var i = 0; i < rows.length; i++) {
                        rsCode=rows[i].RESULT;
                      }
                      console.log("Mã OTP: "+rsCode);
					  try{
						doClose(connection, result.outBinds.cursor); // always close the RESULTSet
					  }catch(e){
						  console.log(e);
					  }
					  doRelease(connection);
                      if(rsCode.length>20){
                        jsonResponse["ERROR"] = "0003";
                        jsonResponse["MESSAGE"] = "FAILED";
                        jsonResponse["RESULT"] = rsCode;
                        console.log(jsonResponse);
                        res.send(jsonResponse);
                      }else{
                        var data1 = 
                          '<RQST>' +
                            '<USERNAME>f5sell</USERNAME>' +
                            '<PASSWORD>avxvzy</PASSWORD>' +
                            '<TYPE>2</TYPE>' +
                            '<BRANDNAME>NEOJSC</BRANDNAME>' +
                            '<MOBILE>'+msisdn+'</MOBILE>' +
                            '<CONTENT>Mã OTP của bạn là: '+rsCode+'</CONTENT>' +
                            '<MSGID>'+msisdn+'</MSGID>' +
                            '<UNICODE>0</UNICODE>' +
                          '</RQST>';
                        request(
                          {
                            url: 'http://g3g4.vn/smsws/api/insertSms.jsp',
                            method: 'POST',
                            headers: {
                              "content-type": "application/xml",  // <--Very important!!!
                            },
                            body: data1,
                            query: data1
                          },
                          function (error, res1, body) {
                            if (!error && res1.statusCode == 200) {
                              var resultsms = body.trim();
                              console.log("resultsms=== "+resultsms);
                              if(resultsms.indexOf("Success")>-1){
                                jsonResponse["ERROR"] = "0000";
                                jsonResponse["MESSAGE"] = "TRUE";
                                jsonResponse["RESULT"] = "Mã OTP đã được gửi đến số điện thoại";
                              }else{
                                jsonResponse["ERROR"] = "-1";
                                jsonResponse["MESSAGE"] = "FAILED";
                                jsonResponse["RESULT"] = "Gửi mã OTP xuống thất bại";
                              }
                            } else {
                              console.log(error);
                              jsonResponse["ERROR"] = "-1";
                              jsonResponse["MESSAGE"] = "FAILED";
                              jsonResponse["RESULT"] = "Gửi mã OTP xuống thất bại";
                            }
                            console.log(jsonResponse);
                            res.send(jsonResponse);
                          }
                        );
                      }	// end check getotp
                    }
                  }
                );
              }
            }
          );//
        }	
      }
	  );
	}catch(e){
		console.log("Exception in sendCode: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
	}finally{
		res.status(200);
		console.log("################# END GET OTP ######################");
  }
});
*/

/*Hàm kiểm tra số điện thoại hợp lệ*/
function validateMsisdn(msisdn){
	let mobile = "";
	try{ 
		var ok = true;
		mobile = msisdn.replace(/\s+/g,"");
		for(var i=0; i<mobile.length; i++){
			let c = parseInt(mobile.charAt(i));
			if(typeof c !== 'number'){
				ok = false;
				break;
			}
		}
		if(ok){
			if(mobile.substring(0,2) === "84" && mobile.length == 11) mobile = "0" + mobile.substring(2);
			if(mobile.length === 9) mobile = "0" + mobile;
			if(mobile.length !== 10 || (mobile.length === 10 && mobile.substring(0,1) !== "0")) mobile = "";
		}else{
			mobile = "";
		}
	}catch(e){}
	return mobile;
}

/*Hàm kích hoạt khi người dùng gửi mã OTP lên
app.post('/active', async (req, res) => {
  console.log("################# START ACTIVE ######################");
  var jsonResponse = {};
	try{
    console.log("active Request: " + JSON.stringify(req.body));
    var numRows = 1;
	  oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
	      }
	      var bindvars = {
          p1: req.body.ICODE,
          p2: req.body.MSISDN,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
				console.log("buoc ICODE: "+req.body.ICODE);
				console.log("buoc sdt: "+req.body.MSISDN);

        connection.execute(
          "BEGIN :cursor := init.active(:p1, :p2); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
		      doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    let rsUpdate = "";
                    for (var i = 0; i < rows.length; i++) {
                      rsUpdate=rows[i].ERROR;
                    }
                    console.log("rsUpdate: "+rsUpdate);
                    if(rsUpdate === "0"){
                      jsonResponse["ERROR"] = "0000";
                      jsonResponse["MESSAGE"] = "SUCCESS";
                      jsonResponse["RESULT"] = "Thành công";
                    }else{
                      jsonResponse["ERROR"] = "0004";
                      jsonResponse["MESSAGE"] = "FAILED";
                      if(rsUpdate === "4") jsonResponse["RESULT"] = "Số lần xác thực vượt quá quy định";
                      else if(rsUpdate === "5") jsonResponse["RESULT"] = "Mã kích hoạt chưa được tạo hoặc đã hết hạn";
                      else if(rsUpdate === "6") jsonResponse["RESULT"] = "Mã kích hoạt không đúng";
                      else jsonResponse["RESULT"] = "Lỗi xác thực OTP";
                    }
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );//
	    }// end funct
	  )// end get connection
	}catch(e){
		console.log("Exception in active: " + e);
		jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
	}finally{
		res.status(200);
		console.log("################# END ACTIVE ######################");
  }
});
*/

app.post("/get_checksum", function(req, res) {
    console.log("################# START get_checksum ######################");
    var jsonResponse = {};
    try {
		  var data = req.body.str_array;
      var ckey = "yQtWXsGxUYGgnQ6e7KzhzCpE";
      var uut = crypto.createHash('md5').update(ckey+data).digest("hex");
          uut = crypto.createHash('md5').update(uut+data).digest("hex");
      console.log(uut);
      res.send(uut);
	  } catch (e) {
		  console.log("Exception in get_checksum: " + e);
      jsonResponse["ERROR"] = "-1";
      jsonResponse["MESSAGE"] = "FAILED";
      jsonResponse["RESULT"] = "Exception";
      res.send(jsonResponse);
	  } finally {
      res.status(200);
      console.log("################# End get_checksum ######################");
	  }
});

app.post("/get_apinhanh", function(req, res) {
    console.log("################# START get_apinhanh ######################");
    var jsonResponse = {};
    try {
        var querystring = require('querystring');
        var data = req.body.str_array;
        var str_url = req.body.str_url;
        var ckey = "yQtWXsGxUYGgnQ6e7KzhzCpE";
        var uut = crypto.createHash('md5').update(ckey+data).digest("hex");
            uut = crypto.createHash('md5').update(uut+data).digest("hex");
        console.log(uut);
        //var data1 = "{'version':'1.0','apiUsername':'depvapkapi','data':'"+data+"','checksum' :'"+uut+"'}";
	    	var data1 = querystring.stringify(
          {
            "version":"1.0",
            "apiUsername":"depvapkapi",
            "data":data,
            "checksum" :uut
          }
        );
        console.log("data1 "+data1);
        request(
          {
            url: 'https://dev2.nhanh.vn'+str_url,
            method: 'POST',
            headers: {
              "content-type": "text/plain",  // <--Very important!!!,
              'Content-Length': Buffer.byteLength(data1)
            },
            body: data1,
            query: data1
          },
          function (error, res1, body) {
            if (!error && res1 !== null && res1.statusCode == 200) {
              var resultsms = body.trim();
              console.log("resultsms=== "+resultsms);
              res.send(resultsms);
            } else {
              console.log(error);
              jsonResponse["ERROR"] = "-1";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Error: " + error;
              res.send(jsonResponse);
            }
          }
        );
    } catch (e) {
      console.log("Exception in get_infomation: " + e);
      jsonResponse["ERROR"] = "-1";
      jsonResponse["MESSAGE"] = "FAILED";
      jsonResponse["RESULT"] = "Exception";
      res.send(jsonResponse);
    } finally {
      res.status(200);
      console.log("################# End get_apinhanh ######################");
    }
});

//listen-order-status
app.post("/listen-order-status", function(req, res) {
  console.log(
    "################# START listen-order-status ######################"
  );
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }

        var bindvars = {
          p1: req.body.id,
          p2: req.body.status,
          p3: req.body.reason,
          p4: req.body.carrierId,
          p5: req.body.carrierServiceId,
          p6: req.body.sendCarrierDateTime,
          p7: req.body.weight,
          p8: req.body.carrierWeight,
          p9: req.body.customerShipFee,
          p10: req.body.shipFee,
          p11: req.body.overWeightShipFee,
          p12: req.body.returnFee,
          p13: req.body.codFee,
          p14: req.body.totalProductMoney,
          p15: req.body.discount,
          p16: req.body.moneyTransfer,
          p17: req.body.moneyDeposit,
          p18: req.body.paymentForSender,
          p19: req.body.deliveryDate,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.edit_order_product2(:p1, :p2, :p3, :p4, :p5, :p6, :p7, :p8, :p9, :p10, :p11, :p12, :p13, :p14, :p15, :p16, :p17, :p18, :p19); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["code"] = "0003";
                    jsonResponse["data"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["code"] = "0004";
                    jsonResponse["data"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in listen-order-status: " + e);
    jsonResponse["code"] = "-1";
    jsonResponse["data"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End listen-order-status ######################"
    );
  }
});

//listen-product
app.post("/listen-product", function(req, res) {
  console.log(
    "################# START listen-product ######################"
  );
  var jsonResponse = {};
  try {
    var jsonObj;
    var jsonData;
    var jsonChecksum;
    var name ='';
    var status_trend='';
    var status = '';
    var image_cover='';
    var price ='';
    var id_product_category ='';
    var contentweb = '';
    var id_warehouse='';
    var contentfb='';
		var form =  new formidable.IncomingForm();
  			form.parse(req, function (err, fields, files) {
	  			var rs = {};
		  		if(err){
            console.log(err);
            jsonResponse["ERROR"] = "0003";
            jsonResponse["MESSAGE"] = "FAILED";
            jsonResponse["RESULT"] = "Gọi API lỗi";
            console.log(jsonResponse);
            res.send(jsonResponse);
				  }else{
            jsonData = JSON.parse(JSON.stringify(fields));
            jsonObj = JSON.parse(jsonData.data);
            jsonChecksum = jsonData.checksum;
            console.log("44444444444"+jsonChecksum);
     				for(var i = 0 ; i < Object.keys(jsonObj); i++){
  						if(i == 0){
                name  =  encodeURIComponent(jsonObj[i].name);
                status_trend = jsonObj[i].showNew;
                status = jsonObj[i].status;
                image_cover=encodeURIComponent(jsonObj[i].image);
                price=jsonObj[i].price;
                id_product_category = jsonObj[i].categoryId;
                contentweb =jsonObj[i].content;
                id_warehouse=jsonObj[i].idNhanh;
                contentfb=jsonObj[i].description;
			  			}else{
                name = name +"#"+ encodeURIComponent(jsonObj[i].name);
                status_trend=status_trend +"#"+ jsonObj[i].showNew;
                status = status + "#"+jsonObj[i].status
                image_cover=image_cover+"#"+encodeURIComponent(jsonObj[i].image);
                price=price+"#"+jsonObj[i].price;
                id_product_category = id_product_category +"#"+jsonObj[i].categoryId;
                contentweb = contentweb + "#" +jsonObj[i].content;
                id_warehouse = id_warehouse+ "#"+jsonObj[i].idNhanh;
                contentfb=contentfb+"#"+jsonObj[i].description;
              }
            }
            var numRows = 100000;
            oracledb.fetchAsString = [oracledb.CLOB];
            oracledb.getConnection(
              {
                user: dbConfig.user,
                password: dbConfig.password,
                connectString: dbConfig.connectString
              },
              function(err, connection) {
                if (err) {
                  console.error(err);
                  jsonResponse["ERROR"] = "0003";
                  jsonResponse["MESSAGE"] = "FAILED";
                  jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                  return;
                }
                var bindvars = {
                  p1: name,
                  p2: status,
                  p3: status_trend,
                  p4: image_cover,
                  p5: price,
                  p6: contentweb,
                  p7: id_product_category,
                  p8: contentfb,
                  p9: id_warehouse,
                  cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
                };
                console.log(bindvars);
                connection.execute(
                  "BEGIN :cursor := APPS.edit_order_product2(:p1, :p2, :p3, :p4, :p5, :p6, :p7, :p8, :p9); END;",
                  bindvars,
                  { outFormat: oracledb.OBJECT },
                  function(err, result) {
                    if (err) {
                      console.error(err);
                      //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                      doRelease(connection);
                      jsonResponse["ERROR"] = "0003";
                      jsonResponse["MESSAGE"] = "FAILED";
                      jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
                      console.log(jsonResponse);
                      res.send(jsonResponse);
                      return;
                    } else {
                      result.outBinds.cursor.getRows(
                        numRows,
                        function(err, rows) {
                          if (err) {
                            console.log(err);
                            jsonResponse["ERROR"] = "0003";
                            jsonResponse["MESSAGE"] = "FAILED";
                            jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                          } else if (rows == null || rows.length === 0) {
                            jsonResponse["ERROR"] = "0004";
                            jsonResponse["MESSAGE"] = "FAILED";
                            jsonResponse["RESULT"] = "Không có dữ liệu";
                          } else {
                            jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                          }
                          console.log(jsonResponse);
                          doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                          doRelease(connection);
                          res.send(jsonResponse);
                        }
                      );
                    }
                  }
                );
              }
            );
          }
        }
      ); //end formible
  } catch (e) {
    console.log("Exception in listen-product: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End listen-product ######################"
    );
  }
});

//listen-inventory
app.post("/listen-inventory", function(req, res) {
  console.log(
    "################# START listen-inventory ######################"
  );
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          p1: req.body.storeId,
          p2: req.body.data,
          p3: req.body.checksum,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.edit_order_product2(:p1, :p2, :p3); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                1,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  console.log(jsonResponse);
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in listen-inventory: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End listen-inventory ######################"
    );
  }
});

//get_product_by_listid
app.post("/get_product_by_listid", function(req, res) {
  console.log(
    "################# START get_product_by_listid ######################"
  );
  var jsonResponse = {};
  try {
	var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
  			  res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        var bindvars = {
          p1: req.body.USERNAME,
          p2: req.body.IDSHOP,
          p3: req.body.LISTID,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.get_product_by_listid(:p1, :p2, :p3); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_product = [];
          					for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      jsonpush["ID"] = rows[i].ID;
                      jsonpush["IMAGE_COVER"] = rows[i].IMAGE_COVER;
                      jsonpush["PRODUCT_NAME"] = rows[i].PRODUCT_NAME;
                      jsonpush["PRICE"] = rows[i].PRICE;
                      jsonpush["IMG1"] = rows[i].IMG1;
                      jsonpush["IMG2"] = rows[i].IMG2;
                      jsonpush["IMG3"] = rows[i].IMG3;
                      jsonpush["ID_PRODUCT_PROPERTIES"] = rows[i].ID_PRODUCT_PROPERTIES;
                      jsonpush["PROPERTIES_NAME"] = rows[i].PROPERTIES_NAME;
                      jsonpush["PROPERTIES"] = rows[i].PROPERTIES;
                      jsonpush["CODE_PRODUCT"] = rows[i].CODE_PRODUCT;
                      jsonpush["DESCRIPTION"] = rows[i].DESCRIPTION;
                      jsonpush["SUB_ID_PARENT"] = rows[i].SUB_ID_PARENT;
                      jsonpush["DESCRIPTION_HTML"] = rows[i].DESCRIPTION_HTML;
                      jsonpush["LINK_AFFILIATE"] = rows[i].LINK_AFFILIATE;
                      jsonpush["COMMISSION"] = rows[i].COMMISSION;
                      jsonpush["CONTENT_WEB"] = rows[i].CONTENT_WEB;
                      jsonpush["CONTENT_FB"] = rows[i].CONTENT_FB;
                      jsonpush["MEDIA_FB"] = rows[i].MEDIA_FB;
                      jsonpush["VIDEO_FB"] = rows[i].VIDEO_FB;
                      jsonpush["STATUS_TREND"] = rows[i].STATUS_TREND;
                      jsonpush["COMISSION_PRODUCT"] = rows[i].COMISSION_PRODUCT;
					            jsonpush["START_PROMOTION"] = rows[i].START_PROMOTION;
                      jsonpush["END_PROMOTION"] = rows[i].END_PROMOTION;
                      jsonpush["PRICE_PROMOTION"] = rows[i].PRICE_PROMOTION;
                      jsonpush["PRICE_WHOLESALE"] = rows[i].PRICE_WHOLESALE;
                      jsonpush["WARRANTY"] = rows[i].WARRANTY;
                      jsonpush["PRICE_IMPORT"] = rows[i].PRICE_IMPORT;
					            jsonpush["HHMAX"] = rows[i].HHMAX;
                      jsonpush["TRAINING"] = rows[i].TRAINING;
					            jsonpush["IMG_THUMBNAIL"] = rows[i].IMG_THUMBNAIL;
					  
                      sub_product.push(jsonpush);
                    }
                    jsonResponse["ERROR"] = newObj.ERROR;
                    jsonResponse["MESSAGE"] = newObj.MESSAGE;
                    jsonResponse["RESULT"] = newObj.RESULT;
                    jsonResponse["INFO"] = sub_product;
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in get_product_by_listid: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End get_product_by_listid ######################"
    );
  }
});

//count_view
app.post("/count_view", function(req, res) {
  console.log(
    "################# START count_view ######################"
  );
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 1;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          p1: req.body.CODE_PRODUCT,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.count_view(:p1); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  console.log(jsonResponse);
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in count_view: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End count_view ######################"
    );
  }
});

/*tinh phi ghn*/
app.post('/sendGhn', async (req, res) => {
  console.log("################# START GET GHN ######################");
  var jsonResponse = {};
	console.log(req.body);
	try{
		var numRows = 100;
		oracledb.fetchAsString = [oracledb.CLOB];
		oracledb.getConnection(
		  {
			user: dbConfig.user,
			password: dbConfig.password,
			connectString: dbConfig.connectString
		  },
		  function(err, connection) {
			if (err) {
			  console.error(err);
			  jsonResponse["ERROR"] = "0003";
			  jsonResponse["MESSAGE"] = "FAILED";
			  jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
			  console.log(jsonResponse);
			  res.send(jsonResponse);
			  return;
			}
			var code_product = typeof req.body.LISTID !== "undefined" ? req.body.LISTID : "";
			if(code_product.length === 0 ){
			  jsonResponse["ERROR"] = "0003";
			  jsonResponse["MESSAGE"] = "FAILED";
			  jsonResponse["RESULT"] = "Số cân nặng không hợp lệ";
			  console.log(jsonResponse);
			  res.send(jsonResponse);
			} else	{
				var bindvars = {
					p1: req.body.USERNAME,
					p2: req.body.IDSHOP,
					p3: req.body.LISTID,
					p4: req.body.TODISTRICTID,
					cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
				};
				connection.execute(
					"BEGIN :cursor := INIT.get_product_ghn(:p1, :p2, :p3, :p4); END;",
					bindvars,
				{ outFormat: oracledb.OBJECT },
				function(err, result) {
					if (err) {
						console.error(err);
						doRelease(connection);
						jsonResponse["ERROR"] = "0003";
						jsonResponse["MESSAGE"] = "FAILED";
						jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
						console.log(jsonResponse);
						res.send(jsonResponse);
				  		return;
					} else {
					  	result.outBinds.cursor.getRows(numRows, function(err, rows) {
							if (err) {
								console.error(err);
							  jsonResponse["ERROR"] = "0003";
							  jsonResponse["MESSAGE"] = "FAILED";
							  jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
							  console.log(jsonResponse);
							  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
							  doRelease(connection);
							  res.send(jsonResponse);
          					} else if (rows == null || rows.length === 0) {
							  jsonResponse["ERROR"] = "0004";
							  jsonResponse["MESSAGE"] = "FAILED";
							  jsonResponse["RESULT"] = "Không có dữ liệu";
							  console.log(jsonResponse);
							  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
							  doRelease(connection);
							  res.send(jsonResponse);
							} else {
							  var total_weight=0;
							  var toaddress=0, toprovince = '';
							  var fromaddress=0;
							  var shiip = "";
							  var quantity = [];
							  var listid = req.body.LISTID;
							  var ids = [];
							  if(typeof listid === 'undefined') listid = "";
								ids = listid.split(",");
							  if(typeof req.body.LISTQUANTITY === 'undefined' || req.body.LISTQUANTITY.length === 0) {
								  for(var i=0; i<ids.length; i++){
									  quantity.push(1);
								  }
							  }else{
								  quantity = req.body.LISTQUANTITY.split(",");
							  }
							  
							  for (var i = 0; i < rows.length; i++) {
								  let id = rows[i].ID;
								  let weight = parseFloat(rows[i].WEIGHT);
								  for (var k=0; k<ids.length; k++){
									  if(id === ids[k]){
										  total_weight += quantity[k]*weight;
										  break;
									  }
								  }
							  }
								shiip = rows[0].SHIIP;
								toaddress = rows[0].TOADDRESS;
								fromaddress = rows[0].FROMADDRESS;
								toprovince = rows[0].TOPROVINCE;
								doClose(connection, result.outBinds.cursor); // always close the RESULTSet
								doRelease(connection);

								//lay goi dich vu
								if(typeof shiip === 'undefined' || shiip ===  null || shiip.length === 0) shiip = 'GHN';
								if(shiip === 'GHTK'){
									let dataReq = {
										"pick_address_id": dbConfig.ghtk.igo.pick_address_id,
										"pick_province": "Hà Nội",
										"pick_district": "Quận Hoàng Mai",
										"province": toprovince,
										"district": toaddress,
										"address": "",
										"weight": total_weight,
										"transport": "road"
									};
									console.log(dataReq);
									request(
										{
											url: 'https://services.giaohangtietkiem.vn/services/shipment/fee',
											method: 'POST',
											headers: {
												"Content-Type": "application/json",
												"Token": dbConfig.ghtk.igo.token
											},
											body: JSON.stringify(dataReq)
										}, function (error, res1, body){
											if(error || res1.statusCode !== 200){
												if(error) console.error(error);
												else console.log(res1.statusCode);
												jsonResponse["ERROR"] = "-1";
												jsonResponse["MESSAGE"] = "FAILED";
												jsonResponse["RESULT"] = "Liên kết GHN thất bại";
											}else{
												let dataRes = JSON.parse(body.trim());
												if(typeof dataRes["success"] !== 'undefined' && dataRes["success"] === true){
													let rs = { data: {}};
													rs["data"]["CalculatedFee"] = dataRes.fee.fee;
													rs["data"]["delivery"] = dataRes.fee.delivery;
													jsonResponse["ERROR"] = "0000";
													jsonResponse["MESSAGE"] = "TRUE";
													jsonResponse["RESULT"] = rs;
												}else{
													jsonResponse["ERROR"] = "-1";
													jsonResponse["MESSAGE"] = "FAILED " + dataRes["message"];
													jsonResponse["RESULT"] = "Liên kết giao hàng thất bại";
												}
												console.log(jsonResponse);
												res.send(jsonResponse);
											}
										}
									);
								}else{
									fromaddress = parseInt(fromaddress);
									toaddress = parseInt(toaddress);
									data1 = {
										"shop_id": dbConfig.ghn.igo.shop_id,
										"from_district": fromaddress,
										"to_district": toaddress,
									};
									console.log(data1);
									request(
										{
											url: 'https://online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/available-services',
											method: 'POST',
											headers: {
												"Content-Type": "application/json",
												"token": dbConfig.ghn.igo.token
											},
											body: JSON.stringify(data1)
										},function (error, res1, body) {
											var serviceid = 53320;
											if (!error && res1.statusCode === 200) {
												console.log("Available services: " + body);
												var resultsms = JSON.parse(body.trim());
												if(resultsms.message.indexOf("Success") >-1){
												  serviceid = resultsms.data[0].service_id;
												}
											}
											data1 = {
											  "service_id": serviceid,
											  "from_district_id": fromaddress,
											  "to_district_id": toaddress,
											  "to_ward_code": 0,
											  "height": 20,
											  "length": 20,
											  "weight": total_weight,
											  "width": 50,
											  "insurance_value": 1000003,
											  "coupon": null
											};
											console.log(data1);

											request(
												{
												  url: 'https://online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/fee',
												  method: 'POST',
												  headers: {
													"content-type": "application/json",  // <--Very important!!!
													"Token": dbConfig.ghn.igo.token
												  },
												  body: JSON.stringify(data1)
												}, function (error, res1, body) {
													if (!error && res1.statusCode == 200) {
														var resultsms = JSON.parse(body.trim());
														resultsms["data"]["CalculatedFee"] = resultsms.data.total;
														if(resultsms.message.indexOf("Success") > -1){
														  jsonResponse["ERROR"] = "0000";
														  jsonResponse["MESSAGE"] = "TRUE";
														  jsonResponse["RESULT"] = resultsms//JSON.stringify(resultsms);
														}else{
														  jsonResponse["ERROR"] = "-1";
														  jsonResponse["MESSAGE"] = "FAILED";
														  jsonResponse["RESULT"] = "Liên kết GHN thất bại";
														}
													} else {
														console.error(error);
														jsonResponse["ERROR"] = "-1";
														jsonResponse["MESSAGE"] = "FAILED";
														jsonResponse["RESULT"] = "Liên kết GHN thất bại";
													}
													console.log(jsonResponse);
													res.send(jsonResponse);
												}
											);		
										}
									);
								}
							}
						} 
						);
					}
				}
			);
  		}
		}
		);
	}catch(e){
		console.log("Exception in sendCode: " + e);
		jsonResponse["ERROR"] = "-1";
		jsonResponse["MESSAGE"] = "FAILED";
		jsonResponse["RESULT"] = "Exception";
		res.send(jsonResponse);
	}finally{
		res.status(200);
		console.log("################# END GET GHN ######################");
	}
});

app.post("/updateShipment", function(req, res){
	console.log("################# START updateShipment ######################");
	var jsonResponse = {};
	try{
		console.log(req.body);
		jsonResponse = {
			"success": true,
			"message": "Cập nhật thành công"
		}
		console.log(jsonResponse);
		res.send(jsonResponse);
	}catch(e){
		console.error(e);
		jsonResponse = {
			"success": false,
			"message": "Cập nhật lỗi"
		}
		res.send(jsonResponse);
	}finally{
		res.status(200);
		console.log("################# END updateShipment ######################");
	}
});

//get_product_detail
app.post("/get_product_detail", function(req, res) {
  console.log(
    "################# START get_product_detail ######################"
  );
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          p1: req.body.USERNAME,
          p2: req.body.IDSHOP,
    		  p3: req.body.IDPRODUCT,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.get_product_detail(:p1, :p2, :p3); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                 		console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_product = [];
                    for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      jsonpush["ID"] = rows[i].ID;
          					  jsonpush["ID_PRODUCT"] = rows[i].ID;
                      jsonpush["IMAGE_COVER"] = rows[i].IMAGE_COVER;
                      jsonpush["PRODUCT_NAME"] = rows[i].PRODUCT_NAME;
                      jsonpush["PRICE"] = rows[i].PRICE;
                      jsonpush["IMG1"] = rows[i].IMG1;
                      jsonpush["IMG2"] = rows[i].IMG2;
                      jsonpush["IMG3"] = rows[i].IMG3;
                      jsonpush["ID_PRODUCT_PROPERTIES"] = rows[i].ID_PRODUCT_PROPERTIES;
                      jsonpush["PROPERTIES_NAME"] = rows[i].PROPERTIES_NAME;
                      jsonpush["PROPERTIES"] = rows[i].PROPERTIES;
                      jsonpush["CODE_PRODUCT"] = rows[i].CODE_PRODUCT;
                      jsonpush["DESCRIPTION"] = rows[i].DESCRIPTION;
                      jsonpush["SUB_ID"] = rows[i].SUB_ID_PARENT;
                      jsonpush["DESCRIPTION_HTML"] = rows[i].DESCRIPTION_HTML;
                      jsonpush["LINK_AFFILIATE"] = rows[i].LINK_AFFILIATE;
                      jsonpush["COMMISSION"] = rows[i].COMMISSION;
                      jsonpush["CONTENT_WEB"] = rows[i].CONTENT_WEB;
                      jsonpush["CONTENT_FB"] = rows[i].CONTENT_FB;
                      jsonpush["MEDIA_FB"] = rows[i].MEDIA_FB;
                      jsonpush["VIDEO_FB"] = rows[i].VIDEO_FB;
                      jsonpush["STATUS_TREND"] = rows[i].STATUS_TREND;
                      jsonpush["COMISSION_PRODUCT"] = rows[i].COMISSION_PRODUCT;
					            jsonpush["START_PROMOTION"] = rows[i].START_PROMOTION;
                      jsonpush["END_PROMOTION"] = rows[i].END_PROMOTION;
                      jsonpush["PRICE_PROMOTION"] = rows[i].PRICE_PROMOTION;
                      jsonpush["PRICE_WHOLESALE"] = rows[i].PRICE_WHOLESALE;
                      jsonpush["WARRANTY"] = rows[i].WARRANTY;
                      jsonpush["PRICE_IMPORT"] = rows[i].PRICE_IMPORT;
					            jsonpush["HHMAX"] = rows[i].HHMAX;
                      jsonpush["TRAINING"] = rows[i].TRAINING;
					            jsonpush["IMG_THUMBNAIL"] = rows[i].IMG_THUMBNAIL;

                      sub_product.push(jsonpush);
                    }
                    jsonResponse["ERROR"] = newObj.ERROR;
                    jsonResponse["MESSAGE"] = newObj.MESSAGE;
                    jsonResponse["RESULT"] = newObj.RESULT;
                    jsonResponse["INFO"] = sub_product;
                  }
        					doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in get_product_detail: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End get_product_detail ######################"
    );
  }
});

app.post("/get_bank_info", checkToken, function(req, res) {
  console.log("################# START get_bank_info ######################");
  var jsonResponse = {};
  try {
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          p1: req.body.IDSHOP,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := APPS.get_bank_info(:p1); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
            } else {
              result.outBinds.cursor.getRows(1, function(err, rows) {
                  if (err) {
                 	console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Lấy thông tin tài khoản ngân hàng lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
					jsonResponse["ERROR"] = "0000";
                    jsonResponse["MESSAGE"] = "SUCCESS";
                    jsonResponse["RESULT"] = "Lấy thông tin tài khoản ngân hàng của Shop thành công";
					jsonResponse["INFO"] = {};
					var info = {};
					info["SHOP_NAME"] = rows[0].SHOP_NAME;
					info["STK"] = rows[0].STK;
					info["TENTK"] = rows[0].TENTK;
					info["TENNH"] = rows[0].TEN_NH;
					info["CHINHANHNH"] = rows[0].CHINHANH_NH;
					jsonResponse["INFO"] = info;
                  }
				  console.log(jsonResponse);
        		  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in get_bank_info: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End get_bank_info ######################");
  }
});

app.post("/get_bank_info_v2", checkToken, function(req, res) {
  console.log("################# START get_bank_info_v2 ######################");
  var jsonResponse = {};
  try {
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          p1: req.body.IDSHOP,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := API_APPS.get_bank_info_v2(:p1); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
            } else {
              result.outBinds.cursor.getRows(100, function(err, rows) {
                  if (err) {
                 	console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Lấy thông tin tài khoản ngân hàng lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
					jsonResponse["ERROR"] = "0000";
                    jsonResponse["MESSAGE"] = "SUCCESS";
                    jsonResponse["RESULT"] = "Lấy thông tin tài khoản ngân hàng của Shop thành công";
					
					var infos = [];
					for (var i = 0; i < rows.length; i++) {
						var info = {};
						info["SHOP_NAME"] = rows[0].SHOP_NAME;
						info["STK"] = rows[0].STK;
						info["TENTK"] = rows[0].TENTK;
						info["TENNH"] = rows[0].TEN_NH;
						info["CHINHANHNH"] = rows[0].CHINHANH_NH;
						infos.push(info);
					}
					jsonResponse["INFO"] = infos;
                  }
				  console.log(jsonResponse);
        		  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in get_bank_info_v2: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End get_bank_info_v2 ######################");
  }
});

app.post("/get_advertisement", checkToken, function(req, res) {
  console.log("################# START get_advertisement ######################");
  var jsonResponse = {};
  try {
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var token = jwt.decode(req.headers.authorization.split(' ')[1], {complete: true});
        var bindvars = {
          p1: req.body.IDSHOP,
          p2: token.payload.username,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := CRUD.get_advertisement(:p1, :p2); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
            } else {
              result.outBinds.cursor.getRows(1, function(err, rows) {
                  if (err) {
                 	console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Lấy thông tin quảng cáo lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
					jsonResponse["ERROR"] = "0000";
                    jsonResponse["MESSAGE"] = "SUCCESS";
                    jsonResponse["RESULT"] = "Lấy thông tin quảng cáo thành công";
					jsonResponse["INFO"] = {};
					var info = {};
					info["LINK_ADS"] = rows[0].LINK_ADS;
					info["TYPE"] = rows[0].TYPE;
					jsonResponse["INFO"] = info;
                  }
				  console.log(jsonResponse);
        		  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in get_advertisement: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End get_advertisement ######################");
  }
});

app.post("/get_advertisement2", function(req, res) {
  console.log(
    "################# START get_advertisement2 ######################"
  );
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var bindvars = {
          p1: req.body.IDSHOP,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        
		connection.execute(
          "BEGIN :cursor := API_APPS.get_advertisement(:p1); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
            } else {
              result.outBinds.cursor.getRows(20, function(err, rows) {
                  if (err) {
                 	console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Lấy thông tin quảng cáo lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
					jsonResponse["ERROR"] = "0000";
                    jsonResponse["MESSAGE"] = "SUCCESS";
                    jsonResponse["RESULT"] = "Lấy thông tin quảng cáo thành công";
					jsonResponse["INFO"] = {};

					var infos = [];
					for (var i = 0; i < rows.length; i++) {
						var info = {};
						info["LINK_ADS"] = rows[i].LINK_ADS;
						info["TYPE"] = rows[i].TYPE;
						info["ADS_TYPE"] = rows[i].ADS_TYPE;
						info["ADS_WIDTH"] = rows[i].ADS_WIDTH;
						info["ADS_HEIGHT"] = rows[i].ADS_HEIGHT;
						infos.push(info);
					}
					jsonResponse["INFO"] = infos;
                  }
				  console.log(jsonResponse);
        		  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in get_advertisement2: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log(
      "################# End get_advertisement2 ######################"
    );
  }
});

app.post("/sendCode", function(req, res) {
	console.log("################# START sendCode (gen otp) ######################");
	var jsonResponse = {};
	try {
		var msisdn = typeof req.body.MSISDN !== "undefined" ? req.body.MSISDN : "";
        if (msisdn.length > 0) msisdn = validateMsisdn(msisdn);
        if(msisdn.length === 0 ){
			jsonResponse["ERROR"] = "0003";
			jsonResponse["MESSAGE"] = "FAILED";
			jsonResponse["RESULT"] = "Số điện thoại không hợp lệ";
			console.log(jsonResponse);
			res.send(jsonResponse);
		}else{
			var genOtp = true;
			if(htOTP.containsKey(msisdn)){
				var otp = htOTP.get(msisdn);
				var currTime = Number(new Date().getTime());
				if(currTime - otp.START_TIME < 3*60*1000){
					jsonResponse["ERROR"] = "0003";
					jsonResponse["MESSAGE"] = "FAILED";
					jsonResponse["RESULT"] = "Mã xác thực đã được gửi tới " + msisdn + " trong 03 phút gần đây. Vui lòng chờ thực hiện lại sau " + (3*60 - Math.floor((currTime - otp.START_TIME)/1000)) + " giây.";
					console.log(jsonResponse);
					genOtp = false;
					res.send(jsonResponse);
				}
			}
			if(genOtp){
				var otpCode = Math.floor(Math.random() * (999999 - 100000 + 1) + 100000);
				var dataReq = '<RQST><USERNAME>f5sell</USERNAME><PASSWORD>avxvzy</PASSWORD><TYPE>2</TYPE><BRANDNAME>NEOJSC</BRANDNAME><UNICODE>0</UNICODE>' +
									'<MOBILE>'+msisdn+'</MOBILE>' +
									'<CONTENT>Mã xác thực của bạn là: '+otpCode+'</CONTENT>' +
									'<MSGID>'+req.body.IDSHOP + '_' + new Date().getTime() +'</MSGID>' +
								'</RQST>';
                request(
					{
                        url: 'http://g3g4.vn/smsws/api/insertSms.jsp',
                        method: 'POST',
                        headers: { "content-type": "application/xml" },
                        body: dataReq,
                        query: dataReq
                    }, function (error, res1, body) {
						if(error || res1.statusCode !== 200){
							jsonResponse["ERROR"] = "0003";
							jsonResponse["MESSAGE"] = "FAILED";
							jsonResponse["RESULT"] = "Gửi mã xác thực không thành công";
						}else{
							var resultsms = body.trim();
							if(resultsms.indexOf("Success") > -1){
								var otp = {
									"CODE": otpCode,
									"START_TIME": Number(new Date().getTime()),
									"USED": 0
								};
								console.log(otp);
								htOTP.put(msisdn, otp);
								jsonResponse["ERROR"] = "0000";
								jsonResponse["MESSAGE"] = "SUCCESS";
								jsonResponse["RESULT"] = "Gửi mã xác thực thành công";
							}else{
								jsonResponse["ERROR"] = "0003";
								jsonResponse["MESSAGE"] = "FAILED";
								jsonResponse["RESULT"] = "Gửi mã xác thực không thành công";
							}
						}
						console.log(jsonResponse);
						res.send(jsonResponse);
                    }
				);
			}
		}
	} catch (e) {
		console.log("Exception in sendCode: " + e);
		jsonResponse["ERROR"] = "-1";
		jsonResponse["MESSAGE"] = "FAILED";
		jsonResponse["RESULT"] = "Exception";
		res.send(jsonResponse);
	} finally {
		res.status(200);
		console.log("################# End sendCode ######################");
	}
});

app.post("/active", function(req, res) {
	console.log("################# START active (check otp) ######################");
	var jsonResponse = {};
	try {
		var msisdn = typeof req.body.MSISDN !== "undefined" ? req.body.MSISDN : "";
		var otpCode = typeof req.body.ICODE !== 'undefined' ? req.body.ICODE : "";
        if (msisdn.length > 0) msisdn = validateMsisdn(msisdn);
        if(msisdn.length === 0 ){
			jsonResponse["ERROR"] = "0003";
			jsonResponse["MESSAGE"] = "FAILED";
			jsonResponse["RESULT"] = "Số điện thoại không hợp lệ";
		}else{
			if(htOTP.containsKey(msisdn)){
				var otp = htOTP.get(msisdn);
				console.log(otpCode + "---" + otp.CODE);
				if(otpCode == otp.CODE){
					var currTime = Number(new Date().getTime());
					if(currTime - otp.START_TIME > 3*60*1000 || otp.USED === 1){
						jsonResponse["ERROR"] = "0003";
						jsonResponse["MESSAGE"] = "FAILED";
						jsonResponse["RESULT"] = "Mã xác thực đã hết hiệu lực hoặc đã được sử dụng.";						
					}else{
						jsonResponse["ERROR"] = "0000";
						jsonResponse["MESSAGE"] = "SUCCESS";
						jsonResponse["RESULT"] = "Mã xác thực chính xác.";
						otp.USED = 1;
						htOTP.put(msisdn, otp);
					}
				}else{
					jsonResponse["ERROR"] = "0003";
					jsonResponse["MESSAGE"] = "FAILED";
					var retry = typeof otp["RETRY"] === 'undefined' ? 0 : otp["RETRY"];
					if(retry < 3){
						jsonResponse["RESULT"] = "Mã xác thực không đúng.";
						otp["RETRY"] = retry + 1;
						htOTP.put(msisdn, otp);
					}else jsonResponse["RESULT"] = "Mã xác thực sai " + retry + " lần liên tiếp. Vui lòng thử lại sau";  
				}
			}else{
				jsonResponse["ERROR"] = "0003";
				jsonResponse["MESSAGE"] = "FAILED";
				jsonResponse["RESULT"] = "Chưa phát sinh mã xác thực tới " + msisdn;
			}
		}
	} catch (e) {
		console.log("Exception in active: " + e);
		jsonResponse["ERROR"] = "-1";
		jsonResponse["MESSAGE"] = "FAILED";
		jsonResponse["RESULT"] = "Exception";
	} finally {
		res.status(200);
		console.log(jsonResponse);
		res.send(jsonResponse);
		console.log("################# End active ######################");
	}
});

app.post("/update_status_user", checkToken, function(req, res) {
  console.log("################# START update_status_user ######################" );
  console.log(req.body);
  var jsonResponse = {};
  try {
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Hệ thống lỗi, vui lòng thử lại sau";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.STATUS,
          p3: req.body.USER_ID,
          ret: { type: oracledb.STRING, dir: oracledb.BIND_OUT}
        };
        connection.execute(
          "BEGIN :ret := APPS.update_status_user(:p1, :p2, :p3); END;",
          bindvars,
          {autoCommit: true},
          function(err, result) {
            if (err) {
              console.error(err);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Cập nhật thất bại, vui lòng thử lại sau";
            } else {
              var ret = result.outBinds.ret;
			  if (ret == null || typeof ret === 'undefined' || ret.length === 0 || isNaN(ret) || parseInt(ret) === 0){
				  jsonResponse["ERROR"] = "0003";
				  jsonResponse["MESSAGE"] = "FAILED";
				  if(ret.length > 0 && isNaN(ret)) jsonResponse["RESULT"] = ret;
				  else jsonResponse["RESULT"] = "Cập nhật thất bại, vui lòng thử lại sau";
			  }else{
				  jsonResponse["ERROR"] = "0000";
				  jsonResponse["MESSAGE"] = "SUCCESS";
				  jsonResponse["RESULT"] = "Cập nhật thành công";
			  }
            }
			doRelease(connection);
			console.log(jsonResponse);
            res.send(jsonResponse);
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in update_status_user: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End update_status_user ######################");
  }
});

app.post("/edit_info_ctv3", checkToken, async function(req, res) {
  console.log("################# START edit_info_ctv3 ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 10;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      async function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });

		//Upload file
		var jsonResponseFile = {};
		var jsonData = {};
		var form = new formidable.IncomingForm(); //Khởi tạo form
		form.uploadDir = dbConfig.uploadDir + "temp/";
		form.encoding = 'utf-8';
		form.multiples = true;
		form.maxFileSize = dbConfig.uploadAPIMaxSize;

		jsonResponseFile = await new Promise(function (resolve, reject) {
			form.parse(req, function (err, fields, files) {
				var rs = {};
				if(err){
					rs["ERROR"] = "0003";
					rs["MESSAGE"] = "FAILED";
					rs["RESULT"] = "Lỗi Upload: "+err;
					reject(rs);
					return;
				}
				console.log("TOANND =========================" + fields.data);
				jsonData = JSON.parse(fields.data);
				
				//if(files.size !== undefined && files.size != 0) {	
					if(typeof files === 'undefined'){
						rs["ERROR"] = "0002";
						rs["MESSAGE"] = "FAILED";
						rs["RESULT"] = "Dữ liệu không hợp lệ (chưa có file upload)";
					} else{
						try{
							var uploadDir = dbConfig.uploadDir + "userinfo/" + token.payload.username + "/";
							
							if (!fs.existsSync(uploadDir)){
								fs.mkdirSync(uploadDir, { recursive: true });
							}
							var arrFiles = [], arrUrls = [];
							if(typeof files.file !== 'undefined') arrFiles = files.file;
							else arrFiles.push(files.file);
							console.log("Uploading " + arrFiles.length + " files ...");

							if(arrFiles.length > 0) {
								for(var i=0; i < arrFiles.length; i++){
									if(arrFiles[i] !== undefined) {
										var path = arrFiles[i].path;
										var uok = true;
										if(i<10){
											try{
												var extFile = arrFiles[i].name.substring(arrFiles[i].name.lastIndexOf("\.")+1);
												
												var fileName = crypto.randomBytes(7).toString('hex');
												var newpath = uploadDir + fileName + "." + extFile;
												/*while (true) {
													newpath = uploadDir + fileName + "." + extFile;
													if(fs.existsSync(newpath)){
														fileName = crypto.randomBytes(7).toString('hex');
													} else {
														break;
													}
												}*/
												fs.renameSync(path, newpath);
												arrUrls.push(dbConfig.uploadPublicUrl + "userinfo/" + token.payload.username + "/" + fileName + "." + extFile);
											}catch(e){ console.error(e); uok = false;}
										} else uok = false;
										if(!uok){
											try {
												fs.unlinkSync(path)
											} catch(err) {console.error(err)}
										}
									}
								}
								if (arrUrls.length > 0){
									rs["ERROR"] = "0000";
									rs["MESSAGE"] = "SUCCESS";
									rs["RESULT"] = "Upload thành công";
									rs["URL"] = arrUrls;
								} else {
									rs["ERROR"] = "0000";
									rs["MESSAGE"] = "FAILED";
									rs["RESULT"] = "Có lỗi trong quá trình xử lý lưu file";
									rs["URL"] = [];
								}
							} else {
								rs["ERROR"] = "0000";
								rs["MESSAGE"] = "SUCCESS";
								rs["RESULT"] = "Không có file để tải";
								rs["URL"] = [];
							}
						}catch(e){
							console.error(e);
							rs["ERROR"] = "0003";
							rs["MESSAGE"] = "FAILED";
							rs["RESULT"] = "Có lỗi trong quá trình xử lý lưu file";
						}
					}
				// } else {
					// rs["ERROR"] = "0000";
					// rs["MESSAGE"] = "SUCCESS";
					// rs["RESULT"] = "Không có file để tải";
					// rs["URL"] = [];
				// }
				resolve(rs);
			});
		});
		
		console.log("TOANND ==== UPLOAD FILE ERROR = : " + JSON.stringify(jsonResponseFile));
		console.log("TOANND ==== DATA INSERT = : " + JSON.stringify(jsonData));
		if(jsonResponseFile["ERROR"] == "0000") {		
			var imgeCCCDBefore = jsonResponseFile["URL"].length >= 1 ? jsonResponseFile["URL"][0] : "";
			var imgeCCCDAfter = jsonResponseFile["URL"].length >= 2 ? jsonResponseFile["URL"][1] : "";
			//Update user
			var bindvars = {
			  p1: token.payload.username,
			  p2: jsonData["NAME"],
			  p3: jsonData["DOB"],
			  p4: jsonData["GENDER"],
			  p5: jsonData["EMAIL"],
			  p6: jsonData["CITY_NAME"],
			  p7: jsonData["DISTRICT_NAME"],
			  p8: jsonData["WARD_NAME"],
			  p9: jsonData["ADDRESS"],
			  p10: jsonData["CCCD"],
			  p11: imgeCCCDBefore,
			  p12: imgeCCCDAfter,
			  p13: token.payload.idshop,
			  cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
			};
			console.log("TOANND ==== bindvars = : " + bindvars);
			connection.execute(
			  "BEGIN :cursor := API_APPS.edit_info_ctv(:p1, :p2, :p3, :p4, :p5,:p6, :p7, :p8, :p9, :p10, :p11, :p12, :p13); END;",
			  bindvars,
			  { outFormat: oracledb.OBJECT },
			  function(err, result) {
				if (err) {
				  console.error(err);
				  doRelease(connection);
				  jsonResponse["ERROR"] = "0003";
				  jsonResponse["MESSAGE"] = "FAILED";
				  jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
				  console.log(jsonResponse);
				  res.send(jsonResponse);
				  return;
				} else {
				  result.outBinds.cursor.getRows(
					numRows,
					function(err, rows) {
					  if (err) {
						console.log(err);
						jsonResponse["ERROR"] = "0003";
						jsonResponse["MESSAGE"] = "FAILED";
						jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
					  } else if (rows == null || rows.length === 0) {
						jsonResponse["ERROR"] = "0004";
						jsonResponse["MESSAGE"] = "FAILED";
						jsonResponse["RESULT"] = "Không có dữ liệu";
					  } else {
						jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
					  }
					  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
					  doRelease(connection);
					  console.log(jsonResponse);
					  res.send(jsonResponse);
					}
				  );
				}
			  }
			);
		}
		else {
			console.log(jsonResponseFile);
			res.send(jsonResponseFile);
		}
      }
    );
  } catch (e) {
    console.log("Exception in edit_info_ctv3: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End edit_info_ctv3 ######################");
  }
});

//*********************************************************************************
//						UPDATE BANK INFO
//*********************************************************************************
app.post("/update_user_bankinfo", checkToken, function(req, res) {
  console.log("################# START update_user_bankinfo ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 10;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.STK,
          p3: req.body.TENTK,
          p4: req.body.TENNH,
          p5: req.body.CHINHANHNH,
          p6: token.payload.idshop,

          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := API_APPS.update_user_bankinfo(:p1, :p2, :p3, :p4, :p5,:p6); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API cập nhật ngân hàng lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in update_user_bankinfo: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End update_user_bankinfo ######################");
  }
});

//*********************************************************************************
//						UPLOAD FILE
//*********************************************************************************
app.post('/upload', async (req, res) => {
	console.log("################# START /upload ######################");
	var jsonResponse = {};
	try{
		var form =  new formidable.IncomingForm(); //Khởi tạo form
		//var form = new formidable({ multiples: true });
		form.uploadDir = dbConfig.uploadDir + "temp/";
		form.encoding = 'utf-8';
		form.multiples = true;
		form.maxFileSize = dbConfig.uploadMaxSize;
				
		jsonResponse = await new Promise(function (resolve, reject) {
			form.parse(req, function (err, fields, files) {
				var rs = {};
				if(err){
					rs["ERROR"] = "0003";
					rs["MESSAGE"] = "FAILED";
					rs["RESULT"] = "Lỗi Upload: "+err;
					reject(rs);
					return;
				}
				console.log(fields);
				if(typeof fields.SHOP_NAME === 'undefined' || typeof fields.USERNAME === 'undefined' || fields.USERNAME.length == 0){
					rs["ERROR"] = "0002";
					rs["MESSAGE"] = "FAILED";
					rs["RESULT"] = "Dữ liệu không hợp lệ";
				}else if(typeof files === 'undefined'){
					rs["ERROR"] = "0002";
					rs["MESSAGE"] = "FAILED";
					rs["RESULT"] = "Dữ liệu không hợp lệ (chưa có file upload)";
				}else{
					try{
						var uploadDir = dbConfig.uploadDir + "userinfo/" + fields.USERNAME + "/";
						
						if (!fs.existsSync(uploadDir)){
							fs.mkdirSync(uploadDir, { recursive: true });
						}
						var arrFiles = [], arrUrls = [];
						if(typeof files.file.length !== 'undefined') arrFiles = files.file;
						else arrFiles.push(files.file);
						console.log("Uploading " + arrFiles.length + " files ...");

						for(var i=0; i<arrFiles.length; i++){
							var path = arrFiles[i].path;
							var uok = true;
							if(i<10){
								try{
									var extFile = arrFiles[i].name.substring(arrFiles[i].name.lastIndexOf("\.")+1);
									
									var fileName = crypto.randomBytes(7).toString('hex');
									var newpath = uploadDir + fileName + "." + extFile;
									/*while (true) {
										newpath = uploadDir + fileName + "." + extFile;
										if(fs.existsSync(newpath)){
											fileName = crypto.randomBytes(7).toString('hex');
										} else {
											break;
										}
									}*/
									fs.renameSync(path, newpath);
									arrUrls.push(dbConfig.uploadUrl + "userinfo/" + fields.USERNAME + "/" + fileName + "." + extFile);
								}catch(e){ console.error(e); uok = false;}
							}else uok = false;
							if(!uok){
								try {
									fs.unlinkSync(path)
								} catch(err) {console.error(err)}
							}
						}
						if (arrUrls.length > 0){
							rs["ERROR"] = "0000";
							rs["MESSAGE"] = "SUCCESS";
							rs["RESULT"] = "Upload thành công";
							rs["URL"] = arrUrls;
						}else{
							rs["ERROR"] = "0003";
							rs["MESSAGE"] = "FAILED";
							rs["RESULT"] = "Có lỗi trong quá trình xử lý lưu file";
						}
					}catch(e){
						console.error(e);
						rs["ERROR"] = "0003";
						rs["MESSAGE"] = "FAILED";
						rs["RESULT"] = "Có lỗi trong quá trình xử lý lưu file";
					}
				}
				resolve(rs);
			});
		});
	}catch(e){
		console.log("Exception in upload file: " + e);
		jsonResponse["ERROR"] = -1;
		jsonResponse["MESSAGE"] = "FAILED";
		jsonResponse["RESULT"] = "Hệ thống lỗi";
	}finally{
		console.log(jsonResponse);
		res.status(200).send(jsonResponse);
		console.log("################# End /upload ######################");
	}
});

//*********************************************************************************
//							CAC API CHUC NANG "RAO VAT"
//*********************************************************************************
app.post("/marketplace/get_product_type", checkToken, function(req, res) {
  console.log("################# START /marketplace/get_product_type ######################");
  var jsonResponse = {};
  try {
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Lỗi hệ thống, vui lòng thử lại sau!";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var token = jwt.decode(req.headers.authorization.split(' ')[1], {complete: true});
        var bindvars = {
          p1: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := PK_MARKETPLACE.get_product_type(:p1); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Lỗi hệ thống, xin vui lòng thử lại sau!";
              console.log(jsonResponse);
              res.send(jsonResponse);
            } else {
              result.outBinds.cursor.getRows(100, function(err, rows) {
                  if (err) {
                 	console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Lỗi lấy danh sách loại hàng hóa";
                  } else {
					jsonResponse["ERROR"] = "0000";
                    jsonResponse["MESSAGE"] = "SUCCESS";
                    jsonResponse["RESULT"] = "Danh sách loại hàng hóa";
					jsonResponse["INFO"] = [];
					
					for(var i=0; i<rows.length; i++){
						var info = {};
						info["ID"] = rows[i].ID;
						info["NAME"] = rows[i].NAME;
						jsonResponse["INFO"].push(info);
					}
                  }
        		  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      } 
    );
  } catch (e) {
    console.log("Exception in /marketplace/get_product_type: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End /marketplace/get_product_type ######################");
  }
});

app.post("/marketplace/get_marketplaces", checkToken, function(req, res) {
  console.log("################# START /marketplace/get_marketplaces ######################");
  var jsonResponse = {};
  try {
	  console.log(req.body);
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Lỗi hệ thống, vui lòng thử lại sau!";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var token = jwt.decode(req.headers.authorization.split(' ')[1], {complete: true});
		console.log("username: " + token.payload.username + " idshop: " + token.payload.idshop);
		var status = "";
		if (req.body.TYPE == "buy" || req.body.TYPE == "sell") {
			status = "1";
		}else{
			status = "0,1";
		}
        var bindvars = {
          p1: token.payload.idshop,
		  p2: token.payload.username,
		  p3: req.body.TYPE,
		  p4: req.body.PRODUCT_TYPE_ID,
		  p5: status,
		  p6: req.body.PAGE,
		  p7: req.body.NUMOFPAGE,
		  p8: req.body.SEARCH,
		  p9: req.body.ID,
		  p10: req.body.START_TIME,
		  p11: req.body.END_TIME,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := PK_MARKETPLACE.get_marketplaces(:p1, :p2, :p3, :p4, :p5, :p6, :p7, :p8, :p9, :p10, :p11); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Lỗi hệ thống, xin vui lòng thử lại sau!";
              console.log(jsonResponse);
              res.send(jsonResponse);
            } else {
				var numRows = 10;
				if (typeof req.body.NUMOFPAGE === 'number') numRows = parseInt(req.body.NUMOFPAGE);
              result.outBinds.cursor.getRows(numRows, function(err, rows) {
                  if (err) {
                 	console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Lỗi lấy danh sách bài viết";
                  } else {
					jsonResponse["ERROR"] = "0000";
                    jsonResponse["MESSAGE"] = "SUCCESS";
                    jsonResponse["RESULT"] = "Danh sách bài viết";
					jsonResponse["INFO"] = [];
					
					for(var i=0; i<rows.length; i++){ 
						var info = {};
						info["ID"] = rows[i].ID;
						info["TYPE"] = rows[i].TYPE;
						if(info["TYPE"] == "buy") info["TYPE_NAME"] = "Cần mua"; else info["TYPE_NAME"] = "Cần bán";
						info["PRODUCT_TYPE_ID"] = rows[i].PRODUCT_TYPE_ID;
						info["PRODUCT_TYPE_NAME"] = rows[i].PRODUCT_TYPE_NAME;
						info["STATUS"] = rows[i].STATUS;
						info["DESCRIPTION"] = rows[i].DESCRIPTION;
						info["IMG1"] = "";
						info["IMG2"] = "";
						info["IMG3"] = "";
						
						var imgs = (rows[i].IMAGES == null ? "" : rows[i].IMAGES).split(";");
						if(imgs.length > 0) info["IMG1"] = imgs[0];
						if(imgs.length > 1) info["IMG2"] = imgs[1];
						if(imgs.length > 2) info["IMG3"] = imgs[2];
						info["USERNAME"] = rows[i].USERNAME;
						info["FULL_NAME"] = rows[i].FULL_NAME;
						info["AVATAR"] = rows[i].AVATAR;
						info["SHOW_MOBILE"] = rows[i].SHOW_MOBILE;
						info["MOBILE"] = rows[i].MOBILE;
						info["UPDATED_TIME"] = rows[i].UPDATED_TIME;
						info["VIEWS"] = rows[i].VIEWS;
						info["LIKES"] = rows[i].LIKES;
						info["COMMENTS"] = rows[i].COMMENTS;
						info["IS_LIKED"] = rows[i].IS_LIKED;
						jsonResponse["INFO"].push(info);
					}
                  }
        		  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      } 
    );
  } catch (e) {
    console.log("Exception in /marketplace/get_marketplaces: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End /marketplace/get_marketplaces ######################");
  }
});

app.post("/marketplace/update_marketplace", checkToken, function(req, res) {
  console.log("################# START /marketplace/update_marketplace ######################" );
  console.log(req.body);
  var jsonResponse = {};
  try {
	  if(typeof req.body.ACTION === 'undefined' || (req.body.ACTION !== 'I' && req.body.ACTION !== 'U')){
		  jsonResponse["RESULT"] = "Action không hợp lệ";
	  }else if(typeof req.body.TYPE === 'undefined' || (req.body.TYPE !== 'buy' && req.body.TYPE !== 'sell')){
		  jsonResponse["RESULT"] = "Loại bài đăng không hợp lệ";
	  }else if(typeof req.body.DESCRIPTION === 'undefined' || req.body.DESCRIPTION.length === 0){
		  jsonResponse["RESULT"] = "Chưa có nội dung bài đăng";
	  }else if(isNaN(req.body.PRODUCT_TYPE_ID)){
		  jsonResponse["RESULT"] = "Loại hàng hóa không hợp lệ";
	  }else if(req.body.ACTION === 'U' && isNaN(req.body.ID)){
		  jsonResponse["RESULT"] = "ID bài viết không hợp lệ";
	  }
	  if (typeof jsonResponse["RESULT"] !== 'undefined'){
		  jsonResponse["ERROR"] = "0003";
		  jsonResponse["MESSAGE"] = "FAILED";
		  console.log(jsonResponse);
		  res.send(jsonResponse);
	  }else{
		var images = "";
		if(typeof req.body.IMG1 !== 'undefined' && req.body.IMG1.length > 0) images += ';' + req.body.IMG1;
		if(typeof req.body.IMG2 !== 'undefined' && req.body.IMG2.length > 0) images += ';' + req.body.IMG2;
		if(typeof req.body.IMG3 !== 'undefined' && req.body.IMG3.length > 0) images += ';' + req.body.IMG3;
		if(images.length > 0) images = images.substring(1);
		
		oracledb.fetchAsString = [oracledb.CLOB];
		oracledb.getConnection(
		  {
			user: dbConfig.user,
			password: dbConfig.password,
			connectString: dbConfig.connectString
		  },
		  function(err, connection) {
			if (err) {
			  console.error(err);
			  jsonResponse["ERROR"] = "0003";
			  jsonResponse["MESSAGE"] = "FAILED";
			  jsonResponse["RESULT"] = "Hệ thống lỗi, vui lòng thử lại sau";
			  console.log(jsonResponse);
			  res.send(jsonResponse);
			  return;
			}
			//bind with parameters
			var token = jwt.decode(req.headers.authorization.split(" ")[1], { complete: true });
			var show_mobile = 0;
			try {show_mobile = parseInt(req.body.SHOW_MOBILE);} catch(e){}
			if(show_mobile !== 1) show_mobile = 0;
			
			var bindvars = {
			  p1: req.body.ID,
			  p2: req.body.TYPE,
			  p3: req.body.PRODUCT_TYPE_ID,
			  p4: token.payload.idshop,
			  p5: token.payload.username,
			  p6: req.body.STATUS,
			  p7: req.body.DESCRIPTION,
			  p8: images,
			  p9: show_mobile,
			  p10: req.body.ACTION,
			  ret: { type: oracledb.STRING, dir: oracledb.BIND_OUT}
			};
			connection.execute(
			  "BEGIN :ret := PK_MARKETPLACE.update_marketplace(:p1, :p2, :p3, :p4, :p5, :p6, :p7, :p8, :p9, :p10); END;",
			  bindvars,
			  {autoCommit: true},
			  function(err, result) {
				if (err) {
				  console.error(err);
				  jsonResponse["ERROR"] = "0003";
				  jsonResponse["MESSAGE"] = "FAILED";
				  jsonResponse["RESULT"] = "Cập nhật thất bại, vui lòng thử lại sau";
				} else {
				  var ret = result.outBinds.ret;
				  if (ret == null || typeof ret === 'undefined' || ret.length === 0 || isNaN(ret) || parseInt(ret) === 0){
					  jsonResponse["ERROR"] = "0003";
					  jsonResponse["MESSAGE"] = "FAILED";
					  if(ret.length > 0 && isNaN(ret)) jsonResponse["RESULT"] = ret;
					  else jsonResponse["RESULT"] = "Cập nhật thất bại, vui lòng thử lại sau";
				  }else{
					  jsonResponse["ERROR"] = "0000";
					  jsonResponse["MESSAGE"] = "SUCCESS";
					  jsonResponse["RESULT"] = "Cập nhật thành công";
				  }
				}
				doRelease(connection);
				console.log(jsonResponse);
				res.send(jsonResponse);
			  }
			); //
		  }
		);  
	  }
  } catch (e) {
    console.log("Exception in /marketplace/update_marketplace: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End /marketplace/update_marketplace ######################");
  }
});

app.post("/marketplace/delete_marketplace", checkToken, function(req, res) {
  console.log("################# START /marketplace/delete_marketplace ######################" );
  console.log(req.body);
  var jsonResponse = {};
  try {
	  if(isNaN(req.body.ID)){
		  jsonResponse["ERROR"] = "0003";
		  jsonResponse["MESSAGE"] = "FAILED";
		  jsonResponse["RESULT"] = "ID bài viết không hợp lệ";
		  console.log(jsonResponse);
		  res.send(jsonResponse);
	  }else{
		oracledb.getConnection(
		  {
			user: dbConfig.user,
			password: dbConfig.password,
			connectString: dbConfig.connectString
		  },
		  function(err, connection) {
			if (err) {
			  console.error(err);
			  jsonResponse["ERROR"] = "0003";
			  jsonResponse["MESSAGE"] = "FAILED";
			  jsonResponse["RESULT"] = "Hệ thống lỗi, vui lòng thử lại sau";
			  console.log(jsonResponse);
			  res.send(jsonResponse);
			  return;
			}
			//bind with parameters
			var token = jwt.decode(req.headers.authorization.split(" ")[1], { complete: true });
			var bindvars = {
			  p1: req.body.ID,
			  p2: token.payload.idshop,
			  p3: token.payload.username,
			  ret: { type: oracledb.STRING, dir: oracledb.BIND_OUT}
			};
			connection.execute(
			  "BEGIN :ret := PK_MARKETPLACE.update_marketplace(:p1, null, 0, :p2, :p3, -1, null, null, 0, 'D'); END;",
			  bindvars,
			  {autoCommit: true},
			  function(err, result) {
				if (err) {
				  console.error(err);
				  jsonResponse["ERROR"] = "0003";
				  jsonResponse["MESSAGE"] = "FAILED";
				  jsonResponse["RESULT"] = "Xóa thất bại, vui lòng thử lại sau";
				} else {
				  var ret = result.outBinds.ret;
				  if (ret == null || typeof ret === 'undefined' || ret.length === 0 || isNaN(ret) || parseInt(ret) === 0){
					  jsonResponse["ERROR"] = "0003";
					  jsonResponse["MESSAGE"] = "FAILED";
					  if(ret.length > 0 && isNaN(ret)) jsonResponse["RESULT"] = ret;
					  else jsonResponse["RESULT"] = "Xóa thất bại, vui lòng thử lại sau";
				  }else{
					  jsonResponse["ERROR"] = "0000";
					  jsonResponse["MESSAGE"] = "SUCCESS";
					  jsonResponse["RESULT"] = "Xóa bài thành công";
				  }
				}
				doRelease(connection);
				console.log(jsonResponse);
				res.send(jsonResponse);
			  }
			); //
		  }
		);  
	  }
  } catch (e) {
    console.log("Exception in /marketplace/delete_marketplace: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End /marketplace/delete_marketplace ######################");
  }
});

app.post("/marketplace/update_like", checkToken, function(req, res) {
  console.log("################# START /marketplace/update_like ######################" );
  console.log(req.body);
  var jsonResponse = {};
  try {
	  if(isNaN(req.body.ID)){
		  jsonResponse["ERROR"] = "0003";
		  jsonResponse["MESSAGE"] = "FAILED";
		  jsonResponse["RESULT"] = "ID bài viết không hợp lệ";
		  console.log(jsonResponse);
		  res.send(jsonResponse);
	  }else{
		oracledb.getConnection(
		  {
			user: dbConfig.user,
			password: dbConfig.password,
			connectString: dbConfig.connectString
		  },
		  function(err, connection) {
			if (err) {
			  console.error(err);
			  jsonResponse["ERROR"] = "0003";
			  jsonResponse["MESSAGE"] = "FAILED";
			  jsonResponse["RESULT"] = "Hệ thống lỗi, vui lòng thử lại sau";
			  console.log(jsonResponse);
			  res.send(jsonResponse);
			  return;
			}
			//bind with parameters
			var token = jwt.decode(req.headers.authorization.split(" ")[1], { complete: true });
			var bindvars = {
			  p1: req.body.ID,
			  p2: token.payload.username,
			  ret: { type: oracledb.STRING, dir: oracledb.BIND_OUT}
			};
			connection.execute(
			  "BEGIN :ret := PK_MARKETPLACE.insert_likes(:p1, :p2); END;",
			  bindvars,
			  {autoCommit: true},
			  function(err, result) {
				if (err) {
				  console.error(err);
				  jsonResponse["ERROR"] = "0003";
				  jsonResponse["MESSAGE"] = "FAILED";
				  jsonResponse["RESULT"] = "Cập nhật thất bại, vui lòng thử lại sau";
				} else {
				  var ret = result.outBinds.ret;
				  if (ret == null || typeof ret === 'undefined' || ret.length === 0 || isNaN(ret) || parseInt(ret) === 0){
					  jsonResponse["ERROR"] = "0003";
					  jsonResponse["MESSAGE"] = "FAILED";
					  if(ret.length > 0 && isNaN(ret)) jsonResponse["RESULT"] = ret;
					  else jsonResponse["RESULT"] = "Cập nhật thất bại, vui lòng thử lại sau";
				  }else{
					  jsonResponse["ERROR"] = "0000";
					  jsonResponse["MESSAGE"] = "SUCCESS";
					  jsonResponse["RESULT"] = "Like thành công";
				  }
				}
				doRelease(connection);
				console.log(jsonResponse);
				res.send(jsonResponse);
			  }
			); //
		  }
		);  
	  }
  } catch (e) {
    console.log("Exception in /marketplace/update_like: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End /marketplace/update_like ######################");
  }
});

app.post("/marketplace/get_comments", checkToken, function(req, res) {
  console.log("################# START /marketplace/get_comments ######################");
  var jsonResponse = {};
  try {
	  console.log(req.body);
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Lỗi hệ thống, vui lòng thử lại sau!";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        var token = jwt.decode(req.headers.authorization.split(' ')[1], {complete: true});
		var bindvars = {
          p1: (typeof req.body.ID === 'undefined' ? '' : req.body.ID),
		  p2: req.body.MARKETPLACE_ID,
		  p3: token.payload.username,
		  p4: req.body.PAGE,
		  p5: req.body.NUMOFPAGE,
		  cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := PK_MARKETPLACE.get_comments(:p1, :p2, :p3, :p4, :p5); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Lỗi hệ thống, xin vui lòng thử lại sau!";
              console.log(jsonResponse);
              res.send(jsonResponse);
            } else {
				var numRows = 10;
				if (!isNaN(req.body.NUMOFPAGE)) numRows = parseInt(req.body.NUMOFPAGE);
              result.outBinds.cursor.getRows(numRows, function(err, rows) {
                  if (err) {
                 	console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Lỗi lấy bình luận bài viết";
                  } else {
					jsonResponse["ERROR"] = "0000";
                    jsonResponse["MESSAGE"] = "SUCCESS";
                    jsonResponse["RESULT"] = "Danh sách bình luận";
					jsonResponse["INFO"] = [];
					
					for(var i=0; i<rows.length; i++){
						var info = {};
						info["ID"] = rows[i].ID;
						info["LEVEL"] = rows[i].LEVEL;
						info["CONTENT"] = rows[i].CONTENT;
						info["PARENT_ID"] = rows[i].PARENT_ID;
						info["USERNAME"] = rows[i].USERNAME;
						info["FULL_NAME"] = rows[i].FULL_NAME;
						info["AVATAR"] = rows[i].AVATAR;
						info["UPDATED_TIME"] = rows[i].UPDATED_TIME;
						jsonResponse["INFO"].push(info);
					}
                  }
        		  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      } 
    );
  } catch (e) {
    console.log("Exception in /marketplace/get_comments: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End /marketplace/get_comments ######################");
  }
});

app.post("/marketplace/update_comment", checkToken, function(req, res) {
  console.log("################# START /marketplace/update_comment ######################" );
  console.log(req.body);
  var jsonResponse = {};
  try {
	  if(typeof req.body.ACTION === 'undefined' || (req.body.ACTION !== 'I' && req.body.ACTION !== 'U')){
		  jsonResponse["RESULT"] = "Action không hợp lệ";
	  }else if(typeof req.body.CONTENT === 'undefined' || req.body.CONTENT.length === 0){
		  jsonResponse["RESULT"] = "Chưa có nội dung comment";
	  }else if(isNaN(req.body.MARKETPLACE_ID)){
		  jsonResponse["RESULT"] = "ID bài viết không hợp lệ";
	  }else if(req.body.ACTION === 'U' && isNaN(req.body.ID)){
		  jsonResponse["RESULT"] = "ID comment không hợp lệ";
	  }
	  if (typeof jsonResponse["RESULT"] !== 'undefined'){
		  jsonResponse["ERROR"] = "0003";
		  jsonResponse["MESSAGE"] = "FAILED";
		  console.log(jsonResponse);
		  res.send(jsonResponse);
	  }else{
		oracledb.getConnection(
		  {
			user: dbConfig.user,
			password: dbConfig.password,
			connectString: dbConfig.connectString
		  },
		  function(err, connection) {
			if (err) {
			  console.error(err);
			  jsonResponse["ERROR"] = "0003";
			  jsonResponse["MESSAGE"] = "FAILED";
			  jsonResponse["RESULT"] = "Hệ thống lỗi, vui lòng thử lại sau";
			  console.log(jsonResponse);
			  res.send(jsonResponse);
			  return;
			}
			//bind with parameters
			var token = jwt.decode(req.headers.authorization.split(" ")[1], { complete: true });
			var bindvars = {
			  p1: req.body.ID,
			  p2: req.body.MARKETPLACE_ID,
			  p3: req.body.ACTION,
			  p4: req.body.CONTENT,
			  p5: req.body.PARENT_ID,
			  p6: token.payload.username,
			  p7: token.payload.idshop,
			  ret: { type: oracledb.STRING, dir: oracledb.BIND_OUT}
			};
			connection.execute(
			  "BEGIN :ret := PK_MARKETPLACE.update_comment(:p1, :p2, :p3, :p4, :p5, :p6, :p7); END;",
			  bindvars,
			  {autoCommit: true},
			  function(err, result) {
				if (err) {
				  console.error(err);
				  jsonResponse["ERROR"] = "0003";
				  jsonResponse["MESSAGE"] = "FAILED";
				  jsonResponse["RESULT"] = "Cập nhật thất bại, vui lòng thử lại sau";
				} else {
				  var ret = result.outBinds.ret;
				  if (ret == null || typeof ret === 'undefined' || ret.length === 0 || isNaN(ret) || parseInt(ret) === 0){
					  jsonResponse["ERROR"] = "0003";
					  jsonResponse["MESSAGE"] = "FAILED";
					  if(ret.length > 0 && isNaN(ret)) jsonResponse["RESULT"] = ret;
					  else jsonResponse["RESULT"] = "Cập nhật thất bại, vui lòng thử lại sau";
				  }else{
					  jsonResponse["ERROR"] = "0000";
					  jsonResponse["MESSAGE"] = "SUCCESS";
					  jsonResponse["RESULT"] = "Gửi bình luận thành công";
				  }
				}
				doRelease(connection);
				console.log(jsonResponse);
				res.send(jsonResponse);
			  }
			); //
		  }
		);  
	  }
  } catch (e) {
    console.log("Exception in /marketplace/update_comment: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End /marketplace/update_comment ######################");
  }
});

app.post("/marketplace/delete_comment", checkToken, function(req, res) {
  console.log("################# START /marketplace/delete_comment ######################" );
  console.log(req.body);
  var jsonResponse = {};
  try {
	  if(isNaN(req.body.ID)){
		  jsonResponse["ERROR"] = "0003";
		  jsonResponse["MESSAGE"] = "FAILED";
		  jsonResponse["RESULT"] = "ID không hợp lệ";
		  console.log(jsonResponse);
		  res.send(jsonResponse);
	  }else{
		oracledb.getConnection(
		  {
			user: dbConfig.user,
			password: dbConfig.password,
			connectString: dbConfig.connectString
		  },
		  function(err, connection) {
			if (err) {
			  console.error(err);
			  jsonResponse["ERROR"] = "0003";
			  jsonResponse["MESSAGE"] = "FAILED";
			  jsonResponse["RESULT"] = "Hệ thống lỗi, vui lòng thử lại sau";
			  console.log(jsonResponse);
			  res.send(jsonResponse);
			  return;
			}
			//bind with parameters
			var token = jwt.decode(req.headers.authorization.split(" ")[1], { complete: true });
			var bindvars = {
			  p1: req.body.ID,
			  p2: token.payload.username,
			  p3: token.payload.idshop,
			  ret: { type: oracledb.STRING, dir: oracledb.BIND_OUT}
			};
			connection.execute(
			  "BEGIN :ret := PK_MARKETPLACE.update_comment(:p1, 0, 'D', null, 0, :p2, :p3); END;",
			  bindvars,
			  {autoCommit: true},
			  function(err, result) {
				if (err) {
				  console.error(err);
				  jsonResponse["ERROR"] = "0003";
				  jsonResponse["MESSAGE"] = "FAILED";
				  jsonResponse["RESULT"] = "Xóa thất bại, vui lòng thử lại sau";
				} else {
				  var ret = result.outBinds.ret;
				  if (ret == null || typeof ret === 'undefined' || ret.length === 0 || isNaN(ret) || parseInt(ret) === 0){
					  jsonResponse["ERROR"] = "0003";
					  jsonResponse["MESSAGE"] = "FAILED";
					  if(ret.length > 0 && isNaN(ret)) jsonResponse["RESULT"] = ret;
					  else jsonResponse["RESULT"] = "Xóa thất bại, vui lòng thử lại sau";
				  }else{
					  jsonResponse["ERROR"] = "0000";
					  jsonResponse["MESSAGE"] = "SUCCESS";
					  jsonResponse["RESULT"] = "Xóa thành công";
				  }
				}
				doRelease(connection);
				console.log(jsonResponse);
				res.send(jsonResponse);
			  }
			); //
		  }
		);  
	  }
  } catch (e) {
    console.log("Exception in /marketplace/delete_comment: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End /marketplace/delete_comment ######################");
  }
});

//#################### API Get STORE INFO ##############################
app.post("/get_list_store", checkToken, function(req, res) {
  console.log("################# START get_list_store ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 100;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        //console.log(token.payload.username);
		
        var bindvars = {
          p1: token.payload.username,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := API_APPS.get_list_store_info(:p1); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    var sub_ = [];
                    for (var i = 0; i < rows.length; i++) {
                      var jsonpush = {};
                      jsonpush["ID"] = rows[i].ID;
                      jsonpush["NAME"] = rows[i].NAME;
                      jsonpush["CITY_ID"] = rows[i].CITY_ID;
                      jsonpush["DISTRICT_ID"] = rows[i].DISTRICT_ID;
					  jsonpush["WARD_ID"] = rows[i].WARD_ID;
					  jsonpush["CITY_NAME"] = rows[i].CITY_NAME;
					  jsonpush["DISTRICT_NAME"] = rows[i].DISTRICT_NAME;
					  jsonpush["WARD_NAME"] = rows[i].WARD_NAME;
					  jsonpush["ADDRESS"] = rows[i].ADDRESS;
                      sub_.push(jsonpush);
                    }
                    jsonResponse["ERROR"] = "0000";
                    jsonResponse["MESSAGE"] = "SUCCESS";
                    jsonResponse["RESULT"] = "Lấy dữ liệu cửa hàng thành công";
                    jsonResponse["INFO"] = sub_;
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        ); //
      }
    );
  } catch (e) {
    console.log("Exception in get_list_store: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End get_list_store ######################");
  }
});

// get_list_ctv2
app.post("/get_list_ctv2", checkToken, function(req, res) {
  console.log("################# START get_list_ctv2 ######################");
  var jsonResponse = {};
  try {
    var numRows = 1000;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
        //bind with parameters
        var token = jwt.decode(req.headers.authorization.split(" ")[1], {
          complete: true
        });
        var bindvars = {
          p1: token.payload.username,
          p2: req.body.INVITE_CODE,
          p3: req.body.SEARCH,
          p4: req.body.ID_CITY,
          p5: req.body.I_PAGE,
          p6: req.body.NUMOFPAGE,
          p7: token.payload.idshop,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
		console.log(bindvars);
        connection.execute(
          "BEGIN :cursor := API_APPS.get_list_ctv(:p1, :p2, :p3, :p4, :p5, :p6, :p7); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error(err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lấy danh sách lỗi";
                    console.log(jsonResponse);
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                    console.log(jsonResponse);
                  } else {
                    var newObj = rows.reduce((a, b) => Object.assign(a, b), {});
                    if (newObj.ERROR == "0000") {
                      jsonResponse["ERROR"] = newObj.ERROR;
                      jsonResponse["MESSAGE"] = newObj.MESSAGE;
                      jsonResponse["RESULT"] = newObj.RESULT;
                      jsonResponse["INFO"] = rows;
                    } else {
                      jsonResponse = newObj;
                      console.log(jsonResponse);
                    }
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in get_list_ctv: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# end get_list_ctv ######################");
  }
});

//get_app_config
app.post("/get_app_config", function(req, res) {
  console.log("################# START get_app_config ######################");
  var jsonResponse = {};
  try {
    var jsonRequest = JSON.parse(JSON.stringify(req.body));
    console.log(jsonRequest);
    var numRows = 1;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.getConnection(
      {
        user: dbConfig.user,
        password: dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, connection) {
        if (err) {
          console.error(err);
          jsonResponse["ERROR"] = "0003";
          jsonResponse["MESSAGE"] = "FAILED";
          jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
          console.log(jsonResponse);
          res.send(jsonResponse);
          return;
        }
       
        var bindvars = {
          p1: req.body.KEY_CONFIG,
          cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        };
        connection.execute(
          "BEGIN :cursor := API_APPS.get_app_config(:p1); END;",
          bindvars,
          { outFormat: oracledb.OBJECT },
          function(err, result) {
            if (err) {
              console.error("ass" + err);
              //doClose(connection, result.outBinds.cursor); // always close the RESULTSet
              doRelease(connection);
              jsonResponse["ERROR"] = "0003";
              jsonResponse["MESSAGE"] = "FAILED";
              jsonResponse["RESULT"] = "Gọi API lỗi: kết nối db";
              console.log(jsonResponse);
              res.send(jsonResponse);
              return;
            } else {
              result.outBinds.cursor.getRows(
                numRows,
                function(err, rows) {
                  if (err) {
                    console.log(err);
                    doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                    jsonResponse["ERROR"] = "0003";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Gọi API lỗi";
                  } else if (rows == null || rows.length === 0) {
                    jsonResponse["ERROR"] = "0004";
                    jsonResponse["MESSAGE"] = "FAILED";
                    jsonResponse["RESULT"] = "Không có dữ liệu";
                  } else {
                    jsonResponse = rows.reduce((a, b) => Object.assign(a, b), {});
                  }
                  doClose(connection, result.outBinds.cursor); // always close the RESULTSet
                  doRelease(connection);
                  console.log(jsonResponse);
                  res.send(jsonResponse);
                }
              );
            }
          }
        );
      }
    );
  } catch (e) {
    console.log("Exception in get_app_config: " + e);
    jsonResponse["ERROR"] = "-1";
    jsonResponse["MESSAGE"] = "FAILED";
    jsonResponse["RESULT"] = "Exception";
    res.send(jsonResponse);
  } finally {
    res.status(200);
    console.log("################# End get_app_config ######################");
  }
});

//#################### API checking ###################################
app.post("/*", checkToken, function(req, res) {
  console.log("################# START API ######################");
  var jsonResponse = {};
  jsonResponse["ERROR"] = "0003";
  jsonResponse["MESSAGE"] = "FAILED";
  jsonResponse["RESULT"] = "Gọi API lỗi, kiểm tra lại tên API";

  console.log(jsonResponse);
  res.send(jsonResponse);

  console.log("################# END API ######################");
});

function doRelease(connection) {
  try{
    connection.close(function(err) {
      if (err) console.error(err);
    });
  }catch(e){console.log(e);}
}

function doClose(connection, resultSet) {
  try{
    resultSet.close(function(err) {
      if (err) {
        console.error(err);
      }
    });
  }catch(e){console.log(e);}
}
