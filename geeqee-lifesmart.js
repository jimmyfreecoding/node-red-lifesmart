/**
 * Copyright JS Foundation and other contributors, http://js.foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

const dgram = require("dgram");
const os = require("os");
module.exports = function(RED) {
    "use strict";

    var os = require('os');
    var dgram = require('dgram');
    var udpInputPortsInUse = {};
    var lifesmartIDObj = {};



    // The Input Node
    function Lifesmartin(n) {
        RED.nodes.createNode(this,n);
        this.group = n.group;
        this.port = n.port ;
        this.datatype = n.datatype;
        this.iface = n.iface || null;
        this.multicast = n.multicast;
        this.ipv = n.ipv || "udp4";
        var node = this;

        if (node.iface && node.iface.indexOf(".") === -1) {
            try {
                if ((os.networkInterfaces())[node.iface][0].hasOwnProperty("scopeid")) {
                    if (node.ipv === "udp4") {
                        node.iface = (os.networkInterfaces())[node.iface][1].address;
                    } else {
                        node.iface = (os.networkInterfaces())[node.iface][0].address;
                    }
                }
                else {
                    if (node.ipv === "udp4") {
                        node.iface = (os.networkInterfaces())[node.iface][0].address;
                    } else {
                        node.iface = (os.networkInterfaces())[node.iface][1].address;
                    }
                }
            }
            catch(e) {
                node.warn(RED._("udp.errors.ifnotfound",{iface:node.iface}));
                node.iface = null;
            }
        }

        var opts = {type:node.ipv, reuseAddr:true};
        if (process.version.indexOf("v0.10") === 0) { opts = node.ipv; }
        var server;

        if (!udpInputPortsInUse.hasOwnProperty(node.port)) {
            server = dgram.createSocket(opts);  // default to udp4
            server.bind(node.port, function() {
                if (node.multicast == "true") {
                    server.setBroadcast(true);
                    server.setMulticastLoopback(false);
                    try {
                        server.setMulticastTTL(128);
                        server.addMembership(node.group,node.iface);
                        if (node.iface) { node.status({text:n.iface+" : "+node.iface}); }
                        node.log(RED._("udp.status.mc-group",{group:node.group}));
                    } catch (e) {
                        if (e.errno == "EINVAL") {
                            node.error(RED._("udp.errors.bad-mcaddress"));
                        } else if (e.errno == "ENODEV") {
                            node.error(RED._("udp.errors.interface"));
                        } else {
                            node.error(RED._("udp.errors.error",{error:e.errno}));
                        }
                    }
                }
            });
            udpInputPortsInUse[node.port] = server;
        }
        else {
            node.log(RED._("udp.errors.alreadyused",{port:node.port}));
            server = udpInputPortsInUse[node.port];  // re-use existing
            if (node.iface) { node.status({text:n.iface+" : "+node.iface}); }
        }

        server.on("error", function (err) {
            if ((err.code == "EACCES") && (node.port < 1024)) {
                node.error(RED._("udp.errors.access-error"));
            } else {
                node.error(RED._("udp.errors.error",{error:err.code}));
            }
            server.close();
        });

        server.on('message', function (message, remote) {
            var msg;
            if (node.datatype =="base64") {
                msg = { payload:message.toString('base64'), fromip:remote.address+':'+remote.port, ip:remote.address, port:remote.port };
            } else if (node.datatype =="utf8") {
                msg = { payload:message.toString('utf8'), fromip:remote.address+':'+remote.port, ip:remote.address, port:remote.port };
            } else {
                msg = { payload:message, fromip:remote.address+':'+remote.port, ip:remote.address, port:remote.port };
            }

            let result = msg.payload;
            node.log("===============message==================");
            node.log(result);
            if(result.indexOf("JL") == 0){
                result = result.substring(10);
                if(isJSON(result)){
                    var requestObj = JSON.parse(result);
                    if(requestObj.id && lifesmartIDObj[requestObj.id]){
                        msg.ssid = lifesmartIDObj[requestObj.id];
                        if(msg.ssid == "lifesmart_device_search" && requestObj.msg && Array.isArray(requestObj.msg)){
                            //格式化数据
                            var deviceTypeObj = {
                                "SL_SW_ND": "switch",
                                "SL_SW_ND1": "switch",
                                "SL_SW_ND2": "switch",
                                "SL_SW_ND3": "switch",
                                "SL_CN_IF": "blind",
                                "SL_P": "blind",
                                "ZG#HE200_ZB": "humansensor",
                                "SL_SC_BM": "humansensor",
                                "SL_SC_CM": "humansensor",
                                "SL_OL_3C": "plugin",
                                "SL_OE_W": "plugin",
                                "SL_OL_W": "plugin",
                            };
                            var devices = requestObj.msg;
                            var newDevices = [];
                            for(var i = 0; i < devices.length; i++){
                                var deviceInfo = {};
                                deviceInfo.extends = {
                                    gateway:requestObj.agtid,
                                    devtype:devices[i].devtype,
                                    fulltype:devices[i].fulltype,
                                    me:devices[i].me
                                };
                                deviceInfo.factory = "yq";
                                deviceInfo.name = devices[i].name;
                                deviceInfo.id = requestObj.agtid+"_"+devices[i].me;
                                deviceInfo.type = deviceTypeObj[devices[i].devtype] || "unknown";
                                if(deviceInfo.type == "switch"){   //开关类型提供按键信息
                                    deviceInfo.keys = [];
                                    for (var key in devices[i].data) {
                                        if(key.indexOf("L") == 0){
                                            deviceInfo.keys.push({
                                                name:key
                                            })
                                        }
                                    }
                                }

                                newDevices.push(deviceInfo);
                            }
                            requestObj.msg = newDevices;
                            result = JSON.stringify(requestObj)
                        }
                        delete lifesmartIDObj[requestObj.id];
                    }
                }
                msg.payload = result;
            }else if(result.indexOf("LSID=") != -1 && result.indexOf("NAME=") != -1){
                msg.ssid = "lifesmart_gateway_search";
                var gateway = {};
                var resultArr = result.split("\n");
                for(var i = 0; i < resultArr.length; i++){
                    var itemArr = resultArr[i].split("=");
                    if(itemArr[0] == "LSID"){
                        gateway.id = itemArr[1];
                    }else if(itemArr[0] == "NAME"){
                        gateway.name = itemArr[1];
                    }
                }
                if(msg.ip){
                    gateway.ip = msg.ip;
                }
                if(msg.port){
                    gateway.port = msg.port;
                }
                gateway.factory = "yq";

                msg.payload = JSON.stringify(gateway);
            }
            node.send(msg);
        });

        server.on('listening', function () {
            var address = server.address();
            node.log(RED._("udp.status.listener-at",{host:node.iface||address.address,port:address.port}));

        });

        node.on("close", function() {
            try {
                if (node.multicast == "true") { server.dropMembership(node.group); }
                server.close();
                node.log(RED._("udp.status.listener-stopped"));
            } catch (err) {
                //node.error(err);
            }
            if (udpInputPortsInUse.hasOwnProperty(node.port)) {
                delete udpInputPortsInUse[node.port];
            }
            node.status({});
        });

    }
    // RED.httpAdmin.get('/udp-ports/:id', RED.auth.needsPermission('udp-ports.read'), function(req,res) {
    //     res.json(Object.keys(udpInputPortsInUse));
    // });
    RED.nodes.registerType("lifesmart in",Lifesmartin);

    // The Output Node
    function lifesmartout(n) {
        RED.nodes.createNode(this,n);
        //this.group = n.group;
        this.port = n.port;
        this.outport = n.outport||"";
        this.base64 = n.base64;
        this.addr = n.addr;
        this.iface = n.iface || null;
        this.multicast = n.multicast;
        this.ipv = n.ipv || "udp4";
        var node = this;

        if (node.iface && node.iface.indexOf(".") === -1) {
            try {
                if ((os.networkInterfaces())[node.iface][0].hasOwnProperty("scopeid")) {
                    if (node.ipv === "udp4") {
                        node.iface = (os.networkInterfaces())[node.iface][1].address;
                    } else {
                        node.iface = (os.networkInterfaces())[node.iface][0].address;
                    }
                }
                else {
                    if (node.ipv === "udp4") {
                        node.iface = (os.networkInterfaces())[node.iface][0].address;
                    } else {
                        node.iface = (os.networkInterfaces())[node.iface][1].address;
                    }
                }
            }
            catch(e) {
                node.warn(RED._("udp.errors.ifnotfound",{iface:node.iface}));
                node.iface = null;
            }
        }

        var opts = {type:node.ipv, reuseAddr:true};

        var sock;
        var p = this.outport || this.port || "0";
        node.tout = setTimeout(function() {
            if ((p != 0) && udpInputPortsInUse[p]) {
                sock = udpInputPortsInUse[p];
                if (node.multicast != "false") {
                    sock.setBroadcast(true);
                    sock.setMulticastLoopback(false);
                }
                node.log(RED._("udp.status.re-use",{outport:node.outport,host:node.addr,port:node.port}));
                if (node.iface) { node.status({text:n.iface+" : "+node.iface}); }
            }
            else {
                sock = dgram.createSocket(opts);  // default to udp4
                if (node.multicast != "false") {
                    sock.bind(node.outport, function() {    // have to bind before you can enable broadcast...
                        sock.setBroadcast(true);            // turn on broadcast
                        sock.setMulticastLoopback(false);   // turn off loopback
                        if (node.multicast == "multi") {
                            try {
                                sock.setMulticastTTL(128);
                                sock.addMembership(node.addr,node.iface);   // Add to the multicast group
                                if (node.iface) { node.status({text:n.iface+" : "+node.iface}); }
                                node.log(RED._("udp.status.mc-ready",{iface:node.iface,outport:node.outport,host:node.addr,port:node.port}));
                            } catch (e) {
                                if (e.errno == "EINVAL") {
                                    node.error(RED._("udp.errors.bad-mcaddress"));
                                } else if (e.errno == "ENODEV") {
                                    node.error(RED._("udp.errors.interface"));
                                } else {
                                    node.error(RED._("udp.errors.error",{error:e.errno}));
                                }
                            }
                        } else {
                            node.log(RED._("udp.status.bc-ready",{outport:node.outport,host:node.addr,port:node.port}));
                        }
                    });
                } else if ((node.outport !== "") && (!udpInputPortsInUse[node.outport])) {
                    sock.bind(node.outport);
                    node.log(RED._("udp.status.ready",{outport:node.outport,host:node.addr,port:node.port}));
                } else {
                    node.log(RED._("udp.status.ready-nolocal",{host:node.addr,port:node.port}));
                }
                sock.on("error", function(err) {
                    // Any async error will also get reported in the sock.send call.
                    // This handler is needed to ensure the error marked as handled to
                    // prevent it going to the global error handler and shutting node-red
                    // down.
                });
                udpInputPortsInUse[p] = sock;
            }

            node.on("input", function(msg, nodeSend, nodeDone) {
                var add = node.addr || msg.ip || "";
                var por = node.port || msg.port || 12348;
                var id = Math.round(Math.random()*999);
                if(typeof msg.ssid != "undefined" && msg.ssid){
                    lifesmartIDObj[id] = msg.ssid;
                }
                if (add === "") {
                    node.warn(RED._("udp.errors.ip-notset"));
                    nodeDone();
                } else if (por === 0) {
                    node.warn(RED._("udp.errors.port-notset"));
                    nodeDone();
                } else if (isNaN(por) || (por < 1) || (por > 65535)) {
                    node.warn(RED._("udp.errors.port-invalid"));
                    nodeDone();
                } else {
                    var message;
                    //根据不同的请求类型，组装不同指令
                    let action = msg.action
                    if(action == "control"){
                        let args = msg.args;
                        node.log("++++++++++++++++control++++++++++++++++++++"+add+":"+por);
                        node.log(JSON.stringify(args));
                        message = control_devices(args, id);
                        sock.send(message, 0, message.length, por, add, function(err, bytes) {
                            if (err) {
                                node.error("udp : "+err,msg);
                            }
                            message = null;
                            nodeDone();
                        });

                    }else if(action == "devices"){
                        message = get_devices("eps", id);
                        node.log("++++++++++++++++devices++++++++++++++++++++"+add+":"+por);
                        sock.send(message, 0, message.length, por, add, function(err, bytes) {
                            if (err) {
                                node.error("udp : "+err,msg);
                            }
                            message = null;
                            nodeDone();
                        });
                    }else if(action == "gateways"){
                        message = "Z-SEARCH * \r\n";
                        node.log("++++++++++++++++gateways++++++++++++++++++++"+add+":"+por);
                        sock.send(message, 0, message.length, por, add, function(err, bytes) {
                            if (err) {
                                node.error("udp : "+err,msg);
                            }
                            message = null;
                            nodeDone();
                        });
                    }
                }
            });
        }, 75);

        node.on("close", function() {
            if (node.tout) { clearTimeout(node.tout); }
            try {
                if (node.multicast == "multi") { sock.dropMembership(node.group); }
                sock.close();
                node.log(RED._("udp.status.output-stopped"));
            } catch (err) {
                //node.error(err);
            }
            if (udpInputPortsInUse.hasOwnProperty(p)) {
                delete udpInputPortsInUse[p];
            }
            node.status({});
        });
    }
    RED.nodes.registerType("lifesmart out",lifesmartout);


    function control_device(idx, me, type, val, id){
        var time = parseInt(new Date().getTime() / 1000);
        if(typeof id == "undefined" || !id){
            id = Math.round(Math.random()*999);
        }
        var signStr = "obj:ep,idx:"+idx+",me:"+me+",tag:geeqee,type:"+type+",val:"+val+",ts:"+time+",model:OD_LEAD_FUTURE,token:BMP4MZvU62t89avkyGDO7g";
        var sendStr = '{"id":'+id+',"args":{"idx":"'+idx+'","me":"'+me+'","tag":"geeqee","type":'+type+',"val":'+val+'},"obj":"ep","sys":{"ver":1,"ts":'+time+',"sign":"'+hex_md5(signStr)+'","model":"OD_LEAD_FUTURE"}}';
        sendStr = JSON.stringify(JSON.parse(sendStr));
        var sendStrLenHex =sendStr.length.toString(16).padStart(4,'0');  //不全四位字符： 00b9
        var headStr = "4A4C000000030000" + sendStrLenHex;
        var head = new Buffer(headStr, "hex");
        var sendStrBuffer = new Buffer(sendStr)
        var list = [head, sendStrBuffer];
        var newbuff = Buffer.concat(list);
        return newbuff;
    }

    function control_devices(args, id){
        var time = parseInt(new Date().getTime() / 1000);
        if(typeof id == "undefined" || !id){
            id = Math.round(Math.random()*999);
        }
        var signStr = "obj:eps,ts:"+time+",model:OD_LEAD_FUTURE,token:BMP4MZvU62t89avkyGDO7g";
        var sendStr = '{"id":'+id+',"obj":"eps","sys":{"ver":1,"ts":'+time+',"sign":"'+hex_md5(signStr)+'","model":"OD_LEAD_FUTURE"}}';
        var sendStrObj = JSON.parse(sendStr);
        sendStrObj.args = args;
        sendStr = JSON.stringify(sendStrObj);
        var sendStrLenHex =sendStr.length.toString(16).padStart(4,'0');  //不全四位字符： 00b9
        var headStr = "4A4C000000030000" + sendStrLenHex;
        var head = new Buffer(headStr, "hex");
        var sendStrBuffer = new Buffer(sendStr)
        var list = [head, sendStrBuffer];
        var newbuff = Buffer.concat(list);
        return newbuff;
    }

    //type支持 eps-设备  sence-场景
    function get_devices(type, id){
        var time = parseInt(new Date().getTime() / 1000);
        if(typeof id == "undefined" || !id){
            id = Math.round(Math.random()*999);
        }
        var signStr = "obj:eps,ts:"+time+",model:OD_LEAD_FUTURE,token:BMP4MZvU62t89avkyGDO7g";
        var sendStr = '{"id":'+id+',"args":[],"obj":"'+type+'","sys":{"ver":1,"ts":'+time+',"sign":"'+hex_md5(signStr)+'","model":"OD_LEAD_FUTURE"}}';
        sendStr = JSON.stringify(JSON.parse(sendStr));
        var sendStrLenHex =sendStr.length.toString(16).padStart(4,'0');  //不全四位字符： 00b9
        var headStr = "4A4C000000010000" + sendStrLenHex;
        var head = new Buffer(headStr, "hex");
        var sendStrBuffer = new Buffer(sendStr)
        var list = [head, sendStrBuffer];
        var newbuff = Buffer.concat(list);
        return newbuff;
    }

    function isJSON(str) {
        if (typeof str == 'string') {
            try {
                JSON.parse(str);
                return true;
            } catch(e) {
                return false;
            }
        }
    }



    var hexcase = 0;
    var b64pad = "";
    var chrsz = 8;
    let lmd5 = {};
    function core_md5(x, len) {
        /* append padding */
        x[len >> 5] |= 0x80 << ((len) % 32);
        x[(((len + 64) >>> 9) << 4) + 14] = len;

        var a = 1732584193;
        var b = -271733879;
        var c = -1732584194;
        var d = 271733878;

        for (var i = 0; i < x.length; i += 16) {
            var olda = a;
            var oldb = b;
            var oldc = c;
            var oldd = d;

            a = md5_ff(a, b, c, d, x[i + 0], 7, -680876936);
            d = md5_ff(d, a, b, c, x[i + 1], 12, -389564586);
            c = md5_ff(c, d, a, b, x[i + 2], 17, 606105819);
            b = md5_ff(b, c, d, a, x[i + 3], 22, -1044525330);
            a = md5_ff(a, b, c, d, x[i + 4], 7, -176418897);
            d = md5_ff(d, a, b, c, x[i + 5], 12, 1200080426);
            c = md5_ff(c, d, a, b, x[i + 6], 17, -1473231341);
            b = md5_ff(b, c, d, a, x[i + 7], 22, -45705983);
            a = md5_ff(a, b, c, d, x[i + 8], 7, 1770035416);
            d = md5_ff(d, a, b, c, x[i + 9], 12, -1958414417);
            c = md5_ff(c, d, a, b, x[i + 10], 17, -42063);
            b = md5_ff(b, c, d, a, x[i + 11], 22, -1990404162);
            a = md5_ff(a, b, c, d, x[i + 12], 7, 1804603682);
            d = md5_ff(d, a, b, c, x[i + 13], 12, -40341101);
            c = md5_ff(c, d, a, b, x[i + 14], 17, -1502002290);
            b = md5_ff(b, c, d, a, x[i + 15], 22, 1236535329);

            a = md5_gg(a, b, c, d, x[i + 1], 5, -165796510);
            d = md5_gg(d, a, b, c, x[i + 6], 9, -1069501632);
            c = md5_gg(c, d, a, b, x[i + 11], 14, 643717713);
            b = md5_gg(b, c, d, a, x[i + 0], 20, -373897302);
            a = md5_gg(a, b, c, d, x[i + 5], 5, -701558691);
            d = md5_gg(d, a, b, c, x[i + 10], 9, 38016083);
            c = md5_gg(c, d, a, b, x[i + 15], 14, -660478335);
            b = md5_gg(b, c, d, a, x[i + 4], 20, -405537848);
            a = md5_gg(a, b, c, d, x[i + 9], 5, 568446438);
            d = md5_gg(d, a, b, c, x[i + 14], 9, -1019803690);
            c = md5_gg(c, d, a, b, x[i + 3], 14, -187363961);
            b = md5_gg(b, c, d, a, x[i + 8], 20, 1163531501);
            a = md5_gg(a, b, c, d, x[i + 13], 5, -1444681467);
            d = md5_gg(d, a, b, c, x[i + 2], 9, -51403784);
            c = md5_gg(c, d, a, b, x[i + 7], 14, 1735328473);
            b = md5_gg(b, c, d, a, x[i + 12], 20, -1926607734);

            a = md5_hh(a, b, c, d, x[i + 5], 4, -378558);
            d = md5_hh(d, a, b, c, x[i + 8], 11, -2022574463);
            c = md5_hh(c, d, a, b, x[i + 11], 16, 1839030562);
            b = md5_hh(b, c, d, a, x[i + 14], 23, -35309556);
            a = md5_hh(a, b, c, d, x[i + 1], 4, -1530992060);
            d = md5_hh(d, a, b, c, x[i + 4], 11, 1272893353);
            c = md5_hh(c, d, a, b, x[i + 7], 16, -155497632);
            b = md5_hh(b, c, d, a, x[i + 10], 23, -1094730640);
            a = md5_hh(a, b, c, d, x[i + 13], 4, 681279174);
            d = md5_hh(d, a, b, c, x[i + 0], 11, -358537222);
            c = md5_hh(c, d, a, b, x[i + 3], 16, -722521979);
            b = md5_hh(b, c, d, a, x[i + 6], 23, 76029189);
            a = md5_hh(a, b, c, d, x[i + 9], 4, -640364487);
            d = md5_hh(d, a, b, c, x[i + 12], 11, -421815835);
            c = md5_hh(c, d, a, b, x[i + 15], 16, 530742520);
            b = md5_hh(b, c, d, a, x[i + 2], 23, -995338651);

            a = md5_ii(a, b, c, d, x[i + 0], 6, -198630844);
            d = md5_ii(d, a, b, c, x[i + 7], 10, 1126891415);
            c = md5_ii(c, d, a, b, x[i + 14], 15, -1416354905);
            b = md5_ii(b, c, d, a, x[i + 5], 21, -57434055);
            a = md5_ii(a, b, c, d, x[i + 12], 6, 1700485571);
            d = md5_ii(d, a, b, c, x[i + 3], 10, -1894986606);
            c = md5_ii(c, d, a, b, x[i + 10], 15, -1051523);
            b = md5_ii(b, c, d, a, x[i + 1], 21, -2054922799);
            a = md5_ii(a, b, c, d, x[i + 8], 6, 1873313359);
            d = md5_ii(d, a, b, c, x[i + 15], 10, -30611744);
            c = md5_ii(c, d, a, b, x[i + 6], 15, -1560198380);
            b = md5_ii(b, c, d, a, x[i + 13], 21, 1309151649);
            a = md5_ii(a, b, c, d, x[i + 4], 6, -145523070);
            d = md5_ii(d, a, b, c, x[i + 11], 10, -1120210379);
            c = md5_ii(c, d, a, b, x[i + 2], 15, 718787259);
            b = md5_ii(b, c, d, a, x[i + 9], 21, -343485551);

            a = safe_add(a, olda);
            b = safe_add(b, oldb);
            c = safe_add(c, oldc);
            d = safe_add(d, oldd);
        }
        return Array(a, b, c, d);

    }
    function md5_cmn(q, a, b, x, s, t) {
        return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s), b);
    }
    function md5_ff(a, b, c, d, x, s, t) {
        return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
    }
    function md5_gg(a, b, c, d, x, s, t) {
        return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
    }
    function md5_hh(a, b, c, d, x, s, t) {
        return md5_cmn(b ^ c ^ d, a, b, x, s, t);
    }
    function md5_ii(a, b, c, d, x, s, t) {
        return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
    }
    function core_hmac_md5(key, data) {
        var bkey = str2binl(key);
        if (bkey.length > 16) bkey = core_md5(bkey, key.length * chrsz);

        var ipad = Array(16), opad = Array(16);
        for (var i = 0; i < 16; i++) {
            ipad[i] = bkey[i] ^ 0x36363636;
            opad[i] = bkey[i] ^ 0x5C5C5C5C;
        }

        var hash = core_md5(ipad.concat(str2binl(data)), 512 + data.length * chrsz);
        return core_md5(opad.concat(hash), 512 + 128);
    }
    function safe_add(x, y) {
        var lsw = (x & 0xFFFF) + (y & 0xFFFF);
        var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
        return (msw << 16) | (lsw & 0xFFFF);
    }
    function bit_rol(num, cnt) {
        return (num << cnt) | (num >>> (32 - cnt));
    }
    function str2binl(str) {
        var bin = Array();
        var mask = (1 << chrsz) - 1;
        for (var i = 0; i < str.length * chrsz; i += chrsz)
            bin[i >> 5] |= (str.charCodeAt(i / chrsz) & mask) << (i % 32);
        return bin;
    }
    function binl2str(bin) {
        var str = "";
        var mask = (1 << chrsz) - 1;
        for (var i = 0; i < bin.length * 32; i += chrsz)
            str += String.fromCharCode((bin[i >> 5] >>> (i % 32)) & mask);
        return str;
    }
    function binl2hex(binarray) {
        var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
        var str = "";
        for (var i = 0; i < binarray.length * 4; i++) {
            str += hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8 + 4)) & 0xF) +
                hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8)) & 0xF);
        }
        return str;
    }
    function binl2b64(binarray) {
        var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        var str = "";
        for (var i = 0; i < binarray.length * 4; i += 3) {
            var triplet = (((binarray[i >> 2] >> 8 * (i % 4)) & 0xFF) << 16)
                | (((binarray[i + 1 >> 2] >> 8 * ((i + 1) % 4)) & 0xFF) << 8)
                | ((binarray[i + 2 >> 2] >> 8 * ((i + 2) % 4)) & 0xFF);
            for (var j = 0; j < 4; j++) {
                if (i * 8 + j * 6 > binarray.length * 32) str += b64pad;
                else str += tab.charAt((triplet >> 6 * (3 - j)) & 0x3F);
            }
        }
        return str;
    }
    function hex_md5(s) {
        return binl2hex(core_md5(str2binl(s), s.length * chrsz));
    }
}
