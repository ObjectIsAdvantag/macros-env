//
// Copyright (c) 2020 Cisco Systems
// Licensed under the MIT License 
//

/**
 * a Macro to support ENV Variables 
 * 
 * Quick start:
 *    - customize the DEFAULT_ENV below to set/update the default list of ENV variables
 *    - define if the environment is volatile or persisted: modifications of variables survive macro restarts if persisted
 *    - deploy the macro
 * 
 */

//
// Configure the macro for your needs
//

// 1. Customize the local environment for your device by adding variables/values below
const DEFAULT_ENV = {
   DEVICE_SECRET : 1234,

   // Webex Teams for ChatOps 
   //TEAMS_TOKEN   : 'BOT_TOKEN',
   //TEAMS_SPACE   : 'Y2lzY29zcGFyazovL3VzL1JPT00vZWVjODFhNzAtM2YwMS0xMWVhLTk5Y2QtZDc1ODAyZjMwZDU1'
}

// 2. Configure if the environment should be storing a volatile or persist environment variables into the inactive ENV macro
//  - true for transient variables (any change will not survive Macro restart)
//  - false for persisted variables (changes are persisted into a MACRO_DB_NAME file of a macro)
let volatile = true;
const MACRO_DB_NAME = 'ENV'; // name of the macro where variables are persisted (if enabled)

// 3. Configure if the communications should be encrypted
const encrypted = false;
const CRYPTO_SECRET = 'secret'; // WARNING: if you modify this secret make sure to also change the secret in the getenv() functions of your macros

// 4. Configure if communications between macros should be traced
const TRACE_MESSAGES = false;


//
// Macro
//

// Start macro
require('xapi').on('ready', async (xapi) => {
   // Add a snifer for debugging purpose
   if (TRACE_MESSAGES) {
      addMessageSnifer(xapi);
   }

   // Initialize environment
   await initEnvironment(xapi);

   // Initiliaze macro
   init(xapi);
});


let ENV;
function logEnvironment(logger) {
   logger(`ENV: ${JSON.stringify(ENV)}`);
}
const PING = 'PING';
const PONG = 'PONG';
async function initEnvironment(xapi) {

   // Volatile mode
   if (volatile) {
      // List of variables for the local environment
      console.info('starting in volatile mode: environment variables are not persisted');
      ENV = DEFAULT_ENV;
      ENV[PING] = PONG;
      logEnvironment(console.debug);
      return;
   }

   // Persistent mode
   console.info('starting in persistent mode: environment variables are stored in the "ENV" macro.');
   let data;
   try {
      data = await read(xapi, true);
   }
   catch (err) {
      if (err.message == 'DB_READ_ERROR') {
         console.log("cannot access ENV");
      }
      else {
         console.info(`unexpected read error while accessing DB: ${JSON.stringify(err.message)}`)
      }
   }

   // if ENV is empty, create a new storage with default ENV
   if (!data || (!data.PING)) {
      console.info('No existing ENV, creating default...');
      ENV = DEFAULT_ENV;
      ENV[PING] = PONG;
      try {
         await write(xapi, ENV);
      }
      catch (err) {
         console.debug(`write error while creating DB: ${JSON.stringify(err.message)}`)
         console.info('Changing to non-persistent mode.');
         volatile = true;
      }
   }
   else {
      ENV = data;
   }
   logEnvironment(console.debug)
}

// For debugging purpose
function addMessageSnifer(xapi) {
   console.debug('snifer: logging Message Send Text to debug stream')
   xapi.event.on("Message Send Text", function (text) {
      console.debug(`snifer: ${text}`);
   });
}

function init(xapi) {
   xapi.event.on('Message Send Text', (msg) => {
      console.debug(`new "Message Send" Event with text: ${msg}`);

      // WORKAROUND: needed if message was sent from the cloud via POST https://api.ciscospark.com/v1/xapi/command/message.send
      msg = msg.replace(/\'/g, '"');

      // Decrypt
      if (encrypted) {
         msg = decrypt(msg);
      }

      let parsed;
      try {
         parsed = JSON.parse(msg);
      }
      catch (err) {
         console.info('cannot JSON parse the text in "Message Send" Event, ignoring...');
         if (encrypted) {
            console.warn('CHECK the Crypto secret match in the "environment" and macros embedding the "getenv" function');
         }
         return;
      }

      if (!parsed.env) {
         console.debug(`"Message Send" Event is not about ENV: ${msg}, ignoring`);
         return;
      }

      let data = parsed;
      console.debug(`"Message Sent" event concerns env variable: "${data.env}"`);

      // GET ENV
      if (data.operation && (data.operation == 'get')) {

         if (!data.env) {
            console.warn(`no ENV variable specified in: "${msg}", ignoring...`);
            return;
         }

         console.debug(`requested value for env variable: "${data.env}"`);
         let response = {
            'env': data.env,
            'operation': 'get_response',
            'value': '' // default to '' if variable is not found
         }
         let value = ENV[data.env];

         if (value) {
            response.value = value;
         }

         let responseMsg = JSON.stringify(response);

         // Encrypt
         if (encrypted) {
            responseMsg = encrypt(responseMsg);
         }

         // Publish value for ENV variable
         xapi.command('Message Send', { Text: responseMsg });
         return;
      }

      // RESPONSE provided => ignore
      if (data.operation && (data.operation == 'get_response')) {
         console.debug(`ignoring get_response type of "Message Sent" event: ${msg}`);
         return;
      }

      // SET ENV
      if (data.operation && (data.operation == 'set')) {

         // Consistency check
         if (data.env == PING) {
            console.log(`setting env variable: "${PING}" is not supported, aborting...`);
            return;
         }

         console.log(`setting value: "${data.value}" for env variable: "${data.env}"`);
         ENV[data.env] = data.value;

         // If persistent, write to local ENV storage 
         if (!volatile) {
            try {
               write(xapi, ENV);
            }
            catch (err) {
               console.warn(`could not write variable to ENV, err: ${err.message}`);
               return;
            }
         }
         return;
      }

      console.warn(`operation for "Message Sent" event is not supported: ${msg}, ignoring...`);
      return;
   });
}


//
// Database persistence into the ENV macro
//

const PREFIX = 'const json = ';

// Read database contents
async function read(xapi, ENVmayNotExist) {
   // Load contents
   let contents;
   try {
      let macro = await xapi.command('Macros Macro Get', { Name: MACRO_DB_NAME, Content: true })
      contents = macro.Macro[0].Content.substring(PREFIX.length);
   }
   catch (err) {
      if (!ENVmayNotExist) {
         // Log error is ENV should exist
         console.error(`cannot load contents from macro: ${MACRO_DB_NAME}`);
      }
      throw new Error("DB_READ_ERROR");
   }

   // Parse contents
   try {
      console.debug(`DB contains: ${contents}`);
      let data = JSON.parse(contents);
      console.debug('DB successfully parsed');
      return data;
   }
   catch (err) {
      console.error('DB is corrupted, cannot JSON parse the DB');
      throw new Error('DB_PARSE_ERROR');
   }
}

// Write database contents
async function write(xapi, data) {
   // Serialize data as JSON and append prefix
   let contents;
   try {
      contents = PREFIX + JSON.stringify(data);
   }
   catch (err) {
      console.debug('Contents cannot be serialized to JSON');
      throw new Error('DB_SERIALIZE_ERROR');
   }

   // Write
   try {
      let res = await xapi.command('Macros Macro Save', { Name: MACRO_DB_NAME, OverWrite: true, body: contents });
      return (res.status == 'OK');
   }
   catch (err) {
      if (err.message == 'Max number of macros reached.') {
         console.error('Max number of macros reached. Please free up some space.');
         throw new Error('DB_MACROS_LIMIT');
      }
      
      console.debug(`cannot write contents to macro: ${MACRO_DB_NAME}`);
      throw new Error('DB_WRITE_ERROR');
   }
}

// Simplistic symetric encryption based on a custom secret
//
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

const decrypt = decipher(CRYPTO_SECRET);
const encrypt = cipher(CRYPTO_SECRET);
