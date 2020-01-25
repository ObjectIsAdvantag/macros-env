//
// Copyright (c) 2020 Cisco Systems
// Licensed under the MIT License 
//

/*
 * Code snippet to read variables from ENV
 * 
 * Pre-req:
 *    - 'environment' macro is installed on the device
 *
 */

const xapi = require('xapi');

// Wait for ENV variables to be accesible
xapi.on('env-ready', async (ready) => {

   // Did ENV timed-out ?
   if (!ready) {
      console.warn('ENV is not responding. Is the "environment" macro installed and active?');

      // ACTION: decide if you should abort, or can leave with it using default values for your ENV variables
      console.error('cannot load ENV, aborting...');
      return;
   }

   // Read variables from ENV
   let secret = '';
   try {
      secret = await getenv('DEVICE_SECRET');
      console.debug(`DEVICE_SECRET loaded from ENV`);
   }
   catch (err) {
      console.debug(`error while loading env variables: ${err.message}`);
      console.error(`cannot load environment variables: DEVICE_SECRET, aborting...`);
      return;
   }

   // 
   // ACTION: Add your code logic below
   //
   console.log(`echo \$DEVICE_SECRET = ${secret}`);
   xapi.command('UserInterface Message Prompt Display', {
      Title: 'ENV',
      Text: `secret: ${secret}`,
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
