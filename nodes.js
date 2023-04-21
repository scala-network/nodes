const http = require('http');
const httpProxy = require('http-proxy');
const port = 11812;
const fs = require('fs');

let avaliableTargets = [];
let errorRequest = true;
const server = http.createServer(function(req, res) {
    if (req.url === '/favicon.ico') {
        res.writeHead(200, {'Content-Type': 'image/x-icon'});            
        res.end(fs.readFileSync("favicon.ico"));
        return;
    }
    if (req.url === '/lists') {
        res.writeHead(200, {'Content-Type': 'text/json'});
        res.end(JSON.stringify({nodes:avaliableTargets}));
        return;
    }
    if(avaliableTargets.length <= 0) {
        console.log("No targets avaliable");
        if(!errorRequest) {
            errorRequest = true;
            process.send({type:'nodes:request'});
        }
        res.writeHead(404, {'Content-Type': 'text/json'});
        res.end(JSON.stringify({nodes:avaliableTargets}));
        return;
    }

    let idx = Math.floor(Math.random() * (avaliableTargets.length-1));
    let target = avaliableTargets[idx];
    console.log(req.headers);
    console.log("Request %s : %s", target, req.url);
    res.writeHead(302, {
	    location: "http://"+ target + req.url,
    });
    return res.end();

    const proxy = httpProxy.createProxyServer({});
    proxy.on('error', err => {
        delete avaliableTargets[idx];
        if(!errorRequest) {
            console.log("Proxy Request Error " + idx);
            errorRequest = true;
            process.send({type:'nodes:request'});
        }

        if(avaliableTargets.length > 0) {
            idx = Math.floor(Math.random() * (avaliableTargets.length-1));
            target = avaliableTargets[idx];
            proxy.web(req, res, {target:"http://"+target});
        }
    });


    proxy.on('proxyReq', (proxyReq, httpReq) => {
        if (httpReq.body && httpReq.complete) {
            const bodyData = JSON.stringify(httpReq.body);
            // incase if content-type is application/x-www-form-urlencoded -> we need to change to application/json
            proxyReq.setHeader('Content-Type','application/json');
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
            // stream the content
            proxyReq.write(bodyData);
        }
    });

    proxy.web(req, res, {target:"http://"+target});
});

server.on("error", err => {
  console.log("Server Request Error");
  console.log(err);
});


const compare = function (a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;

  return a.filter(_a => b.indexOf(_a) >= 0).length !== a.length;
};
process.on('message', function(msg) {
    switch(msg.type) {
      case 'shutdown':
      process.exit();
      break;
      case 'nodes:refresh':
        setTimeout(() => {
		errorRequest = false;
	},1000);
        if (!('targets' in msg) || compare(msg.targets, avaliableTargets)) return;
        if(avaliableTargets.length !== msg.targets.length) {
            console.log("We have nodes update (%s to %s) ", avaliableTargets.length, msg.targets.length)
        }
        avaliableTargets = msg.targets;
      break;
      default:
      break;
    }
});

let ti = null;

module.exports = () => {
    // Check for avaliable targets
    setInterval(() => {
        errorRequest = false;
    }, 30000);
    console.log("listening on port %s", port)
    server.listen(port,"0.0.0.0");
}



