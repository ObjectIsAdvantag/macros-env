//
// Copyright (c) 2020 Cisco Systems
// Licensed under the MIT License 
//

const xapi = require('xapi');

async function init(ENV) {

   // Example
   let value = await ENV('DEVICE_SECRET');
   console.log(`echo \$DEVICE_SECRET = ${value}`);
}


// getenv() function (minified)
xapi.on("env-ready",async e=>{e?(await init(getenv),console.debug("init with environment completed")):console.warn("Environment macro is not responding! aborting...")});const encrypted=!1,CRYPTO_SECRET="secret",ENV_TIMEOUT=500;function getenv(e){const n=decipher(CRYPTO_SECRET),o=cipher(CRYPTO_SECRET);return new Promise((t,r)=>{let i={};i.stop=xapi.event.on("Message Send Text",function(o){let r;encrypted&&(o=n(o));try{r=JSON.parse(o)}catch(e){return console.error(`cannot JSON parse "MessageSent" event: ${o}: it's ok, simply ignoring this event`),void(encrypted&&console.warn('CHECK the Crypto secret match in the "environment" and macros embedding the "getenv" function'))}let a=r;if(a.operation&&"get_response"==a.operation)return console.debug(`received value: "${a.value}" for env variable: "${a.env}"`),e!=a.env?void console.debug(`received incorrect variable, ${a.env} instead of ${e}, ignoring...`):(i.stop&&(console.debug(`unsubscribe from "Message Send" events, for variable: ${e}`),i.stop(),delete i.stop),void t(a.value));console.debug(`ignoring "Message Sent" event, not a get_response: ${o}`)});let a={operation:"get",env:e},s=JSON.stringify(a);encrypted&&(s=o(s)),xapi.command("Message Send",{Text:s}).then(()=>{setTimeout(()=>{i.stop&&(console.debug(`unsubscribe from Message send for: ${e}`),i.stop(),delete i.stop);let n=new Error("Environment Timeout");return n.code="TIMEOUT",r(n)},ENV_TIMEOUT)})})}function timeout(e){return new Promise(n=>setTimeout(n,e))}async function checkEnvironmentIsReady(){try{return"PONG"==await getenv("PING")?(console.debug("PING => PONG: good to proceed..."),console.debug('"Environment" macro is operational'),!0):(console.debug('Environment" macro is NOT operational: unexpected value'),!1)}catch(e){return"TIMEOUT"==e.code?(console.debug('Environment" macro is NOT operational: timeout'),!1):(console.debug('"Environment" macro is NOT operational: unexpected error'),!1)}}xapi.on("ready",async()=>{let e=0;for(;e<4;){if(await checkEnvironmentIsReady())return void xapi.emit("env-ready",!0);await timeout(e*e*500),e++}console.debug('no response from the "Environment" macro after 4 tentatives, is it running?'),xapi.emit("env-ready",!1)});const cipher=e=>{const n=e=>e.split("").map(e=>e.charCodeAt(0)),o=e=>("0"+Number(e).toString(16)).substr(-2),t=o=>n(e).reduce((e,n)=>e^n,o);return e=>e.split("").map(n).map(t).map(o).join("")},decipher=e=>{const n=n=>(e=>e.split("").map(e=>e.charCodeAt(0)))(e).reduce((e,n)=>e^n,n);return e=>e.match(/.{1,2}/g).map(e=>parseInt(e,16)).map(n).map(e=>String.fromCharCode(e)).join("")};