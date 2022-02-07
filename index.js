'use strict';

const cluster = require('cluster');
const threads = 2;

const log = console.log;
console.log = function () {
    const first_parameter = arguments[0];
    const other_parameters = Array.prototype.slice.call(arguments, 1);

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


if (cluster.isPrimary) {

  for (let i = 0; i < (threads+1); i++) {
      const env = {workerId: i};
      const worker = cluster.fork(env);
      worker.process.env = env;
      worker.on('message', msg => {
          Object.values(cluster.workers).forEach(w => {
              switch(msg.type) {
                case 'nodes:refresh':
                  if(w.process.env.workerId > 0) w.send(msg);
                break;
                case 'nodes:request':
                  if(w.process.env.workerId === 0) w.send(msg);
                break;
                default:
                  w.send(msg);
                break;
              }
              
          });
      }).on('error', () => {
          console.log(`worker %s error`,worker.process.env.workerId);
      });
  }

  let closeFirst = false;
  cluster.on('exit', (worker, code, signal) => {
      if(closeFirst) return;
      closeFirst = true;
      console.log(`worker %s closing`,worker.process.env.workerId);
      Object.values(cluster.workers).forEach(w => w.send({type:'shutdown'}));
  });

  return;
} 


if(parseInt(process.env.workerId) === 0) return require('./workers.js')();
require('./nodes.js')();

process.stdin.resume();

