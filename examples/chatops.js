//
// Copyright (c) 2020 Cisco Systems
// Licensed under the MIT License 
//

/*
 * Posts a message to a Webex Teams space
 * 
 * This macro leverages 2 libraries: ENV and Chatops
 * 
 * Pre-req:
 *    - environment macro is installed
 *    - HttpClient is configured
 *      > xConfiguration HttpClient Mode: On
 *      > xConfiguration HttpClient AllowInsecureHTTPS: True
 *
 */

const xapi = require('xapi');

// Wait for ENV
xapi.on('env-ready', async (ready) => {

   // Abort if ENV is not accessible
   if (!ready) {
      console.error('ENV is not responding. Is the "environment" macro installed and active? aborting...');
      return;
   }

   // Read ENV
   let chatops;
   try {
      const TEAMS_TOKEN = await getenv('TEAMS_TOKEN');
      const TEAMS_SPACE = await getenv('TEAMS_SPACE');
      if (!TEAMS_TOKEN || !TEAMS_SPACE) {
         console.debug(`error while loading env variables: ${err.message}`);
         console.error(`please check TEAMS_TOKEN and TEAMS_SPACE are specified, aborting...`);
         return;
      }
      console.info(`macro configured with spaceId: ${TEAMS_SPACE}`);
      chatops = new WebexTeamsChatOps(TEAMS_TOKEN, TEAMS_SPACE);
   }
   catch (err) {
      console.debug(`error while loading env variables: ${err.message}`);
      console.error(`cannot load environment variables: TEAMS_TOKEN and/or TEAMS_SPACE, aborting...`);
      return;
   }

   // Post message
   chatops.push('Hey, this is Steve');
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

function getenv(variable) {

   const decrypt = decipher(CRYPTO_SECRET);
   const encrypt = cipher(CRYPTO_SECRET);

   return new Promise((resolve, reject) => {

      let context = {}
      // Wait for response from 'Environment' macro
      context.stop = xapi.event.on("Message Send Text", function (msg) {

         let parsed;

         // Decrypt message
         if (encrypted) {
            msg = decrypt(msg);
         }

         try {
            parsed = JSON.parse(msg);
         }
         catch (err) {
            console.error(`cannot JSON parse "MessageSent" event: ${msg}: it's ok, simply ignoring this event`);
            if (encrypted) {
               console.warn('CHECK the Crypto secret match in the "environment" and macros embedding the "getenv" function');
            }
            return;
         }

         let data = parsed;
         if (data.operation && (data.operation == "get_response")) {
            console.debug(`received value: "${data.value}" for env variable: "${data.env}"`);

            // Check this is the variable we have requested
            if (variable != data.env) {
               console.debug(`received incorrect variable, ${data.env} instead of ${variable}, ignoring...`);
               return;
            }

            // If found, stop listening
            if (context.stop) {
               console.debug(`unsubscribe from "Message Send" events, for variable: ${variable}`);
               context.stop();
               delete context.stop;
            }

            resolve(data.value);

            return;
         }

         console.debug(`ignoring "Message Sent" event, not a get_response: ${msg}`);
      });

      // Send request to get the value for the variable
      let data = {
         'operation': 'get',
         'env': variable
      };

      let requestMsg = JSON.stringify(data);

      // Encrypt
      if (encrypted) {
         requestMsg = encrypt(requestMsg);
      }

      xapi.command('Message Send', { Text: requestMsg }).then(() => {

         // The Environment macro should respond before TIMEOUT
         setTimeout(() => {
            if (context.stop) {
               console.debug(`unsubscribe from Message send for: ${variable}`);
               context.stop();
               delete context.stop;
            }

            let error = new Error('Environment Timeout');
            error.code = "TIMEOUT";
            return reject(error);
         }, ENV_TIMEOUT);
      });

   });
}

// Introduce a new event 'env-ready' that fires when 'Environment' macro is ready:
// - xapi.on('env-ready')
//
xapi.on('ready', async () => {
   const ENV_RETRY_DELAY = 500;
   const NB_RETRIES = 4;
   let retries = 0;
   while (retries < NB_RETRIES) {
      if (await checkEnvironmentIsReady()) {
         xapi.emit('env-ready', true);
         return;
      }
      else {
         // Wait exponentially before retrying 
         // note: this elapsed time comes on top of the ENV_TIMEOUT for the 'getenv()' function 
         await timeout(retries * retries * ENV_RETRY_DELAY);
         retries++;
      }
   }

   console.debug(`no response from the "Environment" macro after ${NB_RETRIES} tentatives, is it running?`);
   xapi.emit('env-ready', false);
});
function timeout(ms) {
   return new Promise(resolve => setTimeout(resolve, ms));
}
async function checkEnvironmentIsReady() {
   try {
      let value = await getenv('PING');
      if ('PONG' == value) {
         console.debug('PING => PONG: good to proceed...')
         console.debug('"Environment" macro is operational');
         return true;
      }
      else {
         console.debug('Environment" macro is NOT operational: unexpected value');
         return false;
      }
   }
   catch (err) {
      if (err.code == 'TIMEOUT') {
         console.debug('Environment" macro is NOT operational: timeout');
         return false;
      }

      console.debug('"Environment" macro is NOT operational: unexpected error');
      return false;
   }
}

// Symetric crypto functions
// Extract from https://stackoverflow.com/questions/18279141/javascript-string-encryption-and-decryption
// Contributed by https://stackoverflow.com/users/2861702/jorgeblom
//
const cipher = salt => {
   const textToChars = text => text.split('').map(c => c.charCodeAt(0));
   const byteHex = n => ("0" + Number(n).toString(16)).substr(-2);
   const applySaltToChar = code => textToChars(salt).reduce((a, b) => a ^ b, code);

   return text => text.split('')
      .map(textToChars)
      .map(applySaltToChar)
      .map(byteHex)
      .join('');
}

const decipher = salt => {
   const textToChars = text => text.split('').map(c => c.charCodeAt(0));
   const applySaltToChar = code => textToChars(salt).reduce((a, b) => a ^ b, code);
   return encoded => encoded.match(/.{1,2}/g)
      .map(hex => parseInt(hex, 16))
      .map(applySaltToChar)
      .map(charCode => String.fromCharCode(charCode))
      .join('');
}


//
// ChatOps Library for Webex Teams
//   - chatops = new WebexTeamsChatOps(token, space);
//   - chatops.push(message);
//

function WebexTeamsChatOps(token, space) {
   this.token = token;
   this.space = space;
}

WebexTeamsChatOps.prototype.push = function (msg, cb) {

   // Post message
   let payload = {
      "markdown": msg,
      "roomId": this.space
   }
   xapi.command(
      'HttpClient Post',
      {
         Header: ["Content-Type: application/json", "Authorization: Bearer " + this.token],
         Url: "https://api.ciscospark.com/v1/messages",
         AllowInsecureHTTPS: "True",
         ResultBody: 'plaintext'
      },
      JSON.stringify(payload))
      .then((response) => {
         console.debug(`received response with status code: ${response.StatusCode}`);

         if (response.StatusCode == 200) {
            console.debug("message pushed to Webex Teams");

            // Retrieve message id
            let result = JSON.parse(response.Body);
            console.debug(`message id: ${result.id}`);
            if (cb) cb(null, result.id);
            return;
         }

         // This should not happen as Webex REST API always return 200 OK for POST requests
         console.debug("failed with status code: " + response.StatusCode);
         if (cb) cb("failed with status code: " + response.StatusCode, response.StatusCode);
      })
      .catch((err) => {
         console.debug(`POST failed with err: ${err.message}`);

         switch (err.message) {
            case 'Unknown command':
               // Can be caught at coding time
               console.debug("the HttpClient verb is not correct");
               break;

            case 'HttpClientPostResult':
            case 'HttpClientDeleteResult':
               console.debug(`failed with err status: ${err.data.status}`);
               if (err.data.status === 'Error') {

                  // Typically: hostname not found  
                  if (err.data.Message) {
                     console.debug("data message: " + err.data.Message);
                     break;
                  }

                  // Typically: the response status code is 4xx or 5xx
                  if (err.data.StatusCode) {
                     switch(err.data.StatusCode) {
                        case 401:
                           console.error('Cannot push to Webex Teams: incorrect access token for Webex Teams (401 Unauthorized)');
                           return;
                        default:
                           console.debug("status code: " + err.data.StatusCode);
                           console.error(`Cannot push to Webex Teams: status code ${err.data.StatusCode}`);
                           return;
                     }

                     // Note: err.data.Headers can also be retrieved, though not the body of the response (no ResponseBody attribute here)
                     break;
                  }
               }
         }

         if (cb) cb("Could not post message to Webex Teams", null);
      })
}
