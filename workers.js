'use strict'
const urlparser = require('url');
const http = require('http');
const fs = require('fs');

const checkInterval = 30000; //Check every 30 seconds

let ti = null;

const requestService = urlString => {

    return new Promise((resolve, reject) => {

        const parsedUrl = urlparser.parse("http://"+urlString+"/getinfo");

        const request = http.get({
            hostname: parsedUrl.hostname,
            path: parsedUrl.path,
            port: parsedUrl.port,
            method: "GET"
        }, res => {
            let body = '';

            if (res.status >= 400) return reject(new Error("Error fetch info"));

            res.on('data', chunk => body += chunk.toString());

            res.on('end', () => {
              try{
                const json = JSON.parse(body);
                resolve({
                  height:json.height,
                  url:urlString
                });
              } catch(e) {
                reject(e);
              }
            });
        });

        // Implement timeout as we don't want to include slow servers
        request.on('socket',function(socket){
          socket.setTimeout(2000,() => request.abort());
        });

        request.on('error', reject);

        request.end();
    });
};
let lastCheck = {
  height:0,
  nodes:0
};
const checkNode = () => {
    let rawdata = fs.readFileSync('nodes.json');
    
    let allNodes = JSON.parse(rawdata).nodes;

    const promises = allNodes.map(requestService);

    Promise.allSettled(promises)
    // Filter only accepted response
    .then(responses => {
      const nodeCollections = {};
      responses.filter(response => {
          const {value, status} = response;
          if(status === 'rejected') {
            return false;
          }
          // console.log("Node check : %s (height:%s)",value.url,value.height);
          return true;
      }).map(filtered => {
        let {height, url} = filtered.value;
        if(!(height in nodeCollections)) nodeCollections[height] = [];
        nodeCollections[height].push(url);
        return;
      });

      return nodeCollections;
    })
    // Get majorities
    .then(collections => {

      let majority = {
        height:0,
        nodes:0
      };
      for(let [height, nodes] of Object.entries(collections)) {
        const numOfNodes = nodes.length;
        if(numOfNodes > majority.nodes) {
            majority.height = parseInt(height);
            majority.nodes = numOfNodes;
        }
      }

      /**
       * Allow buffer of height difference
       * If height is at 5 and set buffer to 2
       * Then we should allow 3,4,5,6,7
       **/

      let targets = [];
      const buffer = 2;
      const minBuffer = majority.height-buffer;
      const maxBuffer = majority.height+buffer;
      if(lastCheck.nodes !== majority.nodes || lastCheck.height !== majority.height) {
        console.log("Node check : %d/%d (height:%s)", allNodes.length, majority.nodes,majority.height);
        lastCheck = Object.assign({}, majority);
      }

      for(let i = minBuffer;i<maxBuffer;i++) {
          if(i in collections) {
            const nodes = collections[i];
            targets = [...targets,...nodes];
          }
      }

      process.send({type:'nodes:refresh',targets});
      
      if(ti) return ti.refresh();
      ti = setTimeout(checkNode, checkInterval);
    });
};


process.on('message', function(msg) {

    switch(msg.type) {
      case 'shutdown':
      process.exit();
      break;
      case 'nodes:request':
      clearTimeout(ti);
      ti = null;
      checkNode();
      break;
      default:
      break;
    }
});

console.log("Loading worker");

module.exports = checkNode;