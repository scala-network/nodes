'use strict';

const http = require('http'),
    httpProxy = require('http-proxy'),
    cluster = require('cluster'),
    fs = require('fs'),
    url = require('url'), 
    port = 11812,
    threads = 2;

var log = console.log;
console.log = function () {
    var first_parameter = arguments[0];
    var other_parameters = Array.prototype.slice.call(arguments, 1);

    function formatConsoleDate (date) {
        // var hour = date.getHours();
        // var minutes = date.getMinutes();
        // var seconds = date.getSeconds();
        // var milliseconds = date.getMilliseconds();
        var datestamp = date.toISOString().split(".")[0];
        return '[' +
               datestamp +
               // ((hour < 10) ? '0' + hour: hour) +
               // ':' +
               // ((minutes < 10) ? '0' + minutes: minutes) +
               // ':' +
               // ((seconds < 10) ? '0' + seconds: seconds) +
               // '.' +
               // ('00' + milliseconds).slice(-3) +
               '] ';
    }
    const wid = cluster.isPrimary ? "" : `[WID: ${process.env.workerId}] `;
    log.apply(console, [formatConsoleDate(new Date()) + wid + first_parameter].concat(other_parameters));
};

const requestService = urlString => {

    return new Promise(resolve => {

        const parsedUrl = url.parse("http://"+urlString+"/getinfo");

          const request = http.get({
              hostname: parsedUrl.hostname,
              path: parsedUrl.path,
              port: parsedUrl.port,
              method: "GET"
          }, res => {
              let body = '';

              if (res.status >= 400) {
                  resolve(null);
                  return;
              }

              res.on('data', chunk => body += chunk.toString());

              res.on('end', () => resolve(body));
          });

          request.on('error', e => {
              resolve(null);
          });

          request.end();
    });
};




if (cluster.isPrimary) {

  for (let i = 0; i < (threads+1); i++) {
      const env = {workerId: i};
      const worker = cluster.fork(env);
      worker.process.env = env;
      worker.on('message', msg => {
        
          Object.values(cluster.workers).forEach(w => {
              if(w.process.env.workerId <= 0) {
                return;
              } 
              w.send(msg);
          });
      });
  }

  let closeFirst = false;
  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker %s closing`,worker.process.env.workerId);
    if(closeFirst === false) {
      closeFirst = true;
      Object.values(cluster.workers).forEach(w => {
            w.send({shutdown:true});
        });
    }
    
  });


  return;
} 
let avaliableTargets = [];
let originalTargets = [];
switch(parseInt(process.env.workerId)) {
  case 0:
    console.log("Loading nodes");
    let ti = null;
    const checkNode = () => {
        let rawdata = fs.readFileSync('nodes.json');
        
        const nodes = JSON.parse(rawdata).nodes;

        const promises = nodes.map(requestService);

        Promise.all(promises).then(responses => {
            let nodeHeights = {};
            for(let i = 0; i< nodes.length;i++) {
                const node = nodes[i];
                const response = responses[i];
                if(!response) {
                  console.log("Node check : %s (error)", node);
                } else {
                  const height = JSON.parse(response).height;
                  if(!nodeHeights[height]) {
                    nodeHeights[height] = [];
                  }
                  nodeHeights[height].push(node);
                  console.log("Node check : %s (height:%s)",node,height);
                }
            }
            const heights = Object.keys(nodeHeights);

            let majoritiHeight = 0;
            let majoritiNodes = 0;
            for(let i in heights) {
              if(nodeHeights[heights[i]].length > majoritiNodes) {
                  majoritiHeight = parseInt(heights[i]);
                  majoritiNodes = nodeHeights[heights[i]].length;
              }
            }
            let targets = [];
            for(let i=0;i<2;i++) {
                const hh = majoritiHeight+1
                const hl = majoritiHeight-1

                if(nodeHeights[`${hl}`]) {
                  targets = [...targets,...nodeHeights[`${hl}`]];
                }
                if(nodeHeights[`${hh}`]) {
                  targets = [...targets,...nodeHeights[`${hh}`]];
                }
            }
            targets = [...targets,...nodeHeights[`${majoritiHeight}`]];
            process.send({nodes :targets});
            if(ti) {
              ti.refresh();
            } else {
              ti = setTimeout(checkNode,5000);
              
            }
        });
    };
    checkNode();
  break;
  default:
    let noTargetsAvaliable = false;

  process.on('message', function(msg) {

      if (msg.nodes) {
          originalTargets = avaliableTargets;
          avaliableTargets = msg.nodes;
          if(originalTargets.length !== avaliableTargets.length) {
            console.log("We have nodes update (%s to %s) ", originalTargets.length, avaliableTargets.length)
          }
      } else {
          process.exit(0);
      }
  });

  const init = () => {
      const proxy = httpProxy.createProxyServer({});
      proxy.on('proxyReq', (proxyReq, req) => {
              if (req.body && req.complete) {
                  const bodyData = JSON.stringify(req.body);
                  // incase if content-type is application/x-www-form-urlencoded -> we need to change to application/json
                  proxyReq.setHeader('Content-Type','application/json');
                  proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                  // stream the content
                  proxyReq.write(bodyData);
              }
          });
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

          const idx = Math.floor(Math.random() * (avaliableTargets.length-1));
          const target = avaliableTargets[idx];
          
          // if (req.url === '/select') {
          //     res.writeHead(200, {'Content-Type': 'text/json'});            
          //     res.end(JSON.stringify({node:target}));
          //     return;
          // }

          console.log("Request %s : %s", target, req.url);
            proxy.web(req, res, {target:"http://"+target});
        });

        server.on("error", err=>console.log(err));

        console.log("listening on port %s", port)
        server.listen(port,"0.0.0.0");
  }
  const check = setInterval(() => {

    if(avaliableTargets.length <= 0) {
      return;
    }

   
    clearInterval(check);
    init();
    

  },500);
  
  break;
}

process.stdin.resume();

