//
// Copyright (c) 2020 Cisco Systems
// Licensed under the MIT License 
//

const xapi = require('xapi');


// Wait for ENV variables to be accesible
xapi.on('env-ready', async (ready) => {

   const pong = await getenv('PING');

   xapi.command('UserInterface Message Prompt Display', {
      Title: 'ENV',
      Text: `$PING = ${pong}`,
      Duration: 10
   });
   
});


//
// ENV library
//   - getenv() function
//

// Configure if the communications should be encrypted
const encrypted = false;
const CRYPTO_SECRET = 'secret'; // WARNING: if you modify this secret make sure to also change it in the getenv() function

// Asks the 'Environment' macro to send the value of an environment variable
const ENV_TIMEOUT = 500; // delay for the environment macro to respond

// getenv() function (minified)
function getenv(e){const n=decipher(CRYPTO_SECRET),o=cipher(CRYPTO_SECRET);return new Promise((t,r)=>{let i={};i.stop=xapi.event.on("Message Send Text",function(o){let r;encrypted&&(o=n(o));try{r=JSON.parse(o)}catch(e){return console.error(`cannot JSON parse "MessageSent" event: ${o}: it's ok, simply ignoring this event`),void(encrypted&&console.warn('CHECK the Crypto secret match in the "environment" and macros embedding the "getenv" function'))}let a=r;if(a.operation&&"get_response"==a.operation)return console.debug(`received value: "${a.value}" for env variable: "${a.env}"`),e!=a.env?void console.debug(`received incorrect variable, ${a.env} instead of ${e}, ignoring...`):(i.stop&&(console.debug(`unsubscribe from "Message Send" events, for variable: ${e}`),i.stop(),delete i.stop),void t(a.value));console.debug(`ignoring "Message Sent" event, not a get_response: ${o}`)});let a={operation:"get",env:e},s=JSON.stringify(a);encrypted&&(s=o(s)),xapi.command("Message Send",{Text:s}).then(()=>{setTimeout(()=>{i.stop&&(console.debug(`unsubscribe from Message send for: ${e}`),i.stop(),delete i.stop);let n=new Error("Environment Timeout");return n.code="TIMEOUT",r(n)},ENV_TIMEOUT)})})}function timeout(e){return new Promise(n=>setTimeout(n,e))}async function checkEnvironmentIsReady(){try{return"PONG"==await getenv("PING")?(console.debug("PING => PONG: good to proceed..."),console.debug('"Environment" macro is operational'),!0):(console.debug('Environment" macro is NOT operational: unexpected value'),!1)}catch(e){return"TIMEOUT"==e.code?(console.debug('Environment" macro is NOT operational: timeout'),!1):(console.debug('"Environment" macro is NOT operational: unexpected error'),!1)}}xapi.on("ready",async()=>{let e=0;for(;e<4;){if(await checkEnvironmentIsReady())return void xapi.emit("env-ready",!0);await timeout(e*e*500),e++}console.debug('no response from the "Environment" macro after 4 tentatives, is it running?'),xapi.emit("env-ready",!1)});const cipher=e=>{const n=e=>e.split("").map(e=>e.charCodeAt(0)),o=e=>("0"+Number(e).toString(16)).substr(-2),t=o=>n(e).reduce((e,n)=>e^n,o);return e=>e.split("").map(n).map(t).map(o).join("")},decipher=e=>{const n=n=>(e=>e.split("").map(e=>e.charCodeAt(0)))(e).reduce((e,n)=>e^n,n);return e=>e.match(/.{1,2}/g).map(e=>parseInt(e,16)).map(n).map(e=>String.fromCharCode(e)).join("")};
