# Environment variables for CE macros

Enhance your macro runtime with ENV variables:
- ENV is shared across macros on the same device
- ENV can be volatile or persisted (by default)
- ENV can be modified over HTTP on the LAN 
- if cloud-registered, a device ENV can be modified over Webex /xapi endpoint)


```javascript
const xapi = require('xapi');

async function init(ENV) {

   // Example
   let value = await ENV('DEVICE_SECRET');
   console.log(`echo \$DEVICE_SECRET = ${value}`);
}

// getenv() function
...
```


## Quickstart

1. Deploy the [environment](environment.js) macro to a device.

2. Activate the 'environment' macro.

   > a new 'ENV' macro is created which you do not need to activate.
   > this macro is used for the sole purpose of persisting the changes you could make to ENV variables.

3. Copy the [getenv](getenv-minified.js) macro to the device, and activate it too.

4. Check the logs in the Macro Editor, you should see:

   ```text
   08:22:00	[system]    Using XAPI transport: TSH
   08:22:00	[system]    Starting macros...
   08:22:00	environment Loading...
   08:22:00	getenv      Loading...
   08:22:02	getenv      Ready!
   08:22:02	environment Ready!
   08:22:02	environment'starting in persistent mode: environment variables are stored in the "ENV" macro.'
   08:22:03	getenv     'echo $DEVICE_SECRET = 1234'
   ```


5. Congrats, your ENV is working!

   You can now copy the [getenv](getenv-minified.js) code snippet to an existing macro,
   and invoke ENV() which is passed by `init(ENV)`.

   _Note that if a variable is not found in ENV, an empty value is returned._


## To go further

- **Customize the DEFAULT_ENV** with a predefined the list of ENV variables for your macros in [environment](environment.js):

   ```javascript
   const DEFAULT_ENV = {
      'DEVICE_SECRET': 2345,
      'WEBEX_TOKEN': "ABCDEFGHIJ"
   }
   ```


- **Configure your ENV to be volatile or persistent** by changing the value of volatile in in [environment](environment.js): 

   ```javascript
   const volatile = false; // set to false for persisted ENV variables
   ```


- **Create or update an ENV variable** by sending a message on the LAN or from the cloud

   > Note: the commands below won't work if the communications via Message/Send/Text commands are encrypted (see below)

   ```shell
   # on the LAN: place your credentials
   curl --request POST '{{endpoint}}/putxml' \
        --header 'Content-Type: text/xml' \
        --header 'Authorization: Basic {{credentials}}' \
        --data-raw '<Command>
            <Message>
               <Send>
                  <Text>{'\''env'\'': '\''DEVICE_SECRET'\'', '\''operation'\'': '\''set'\'', '\''value'\'': 9876 }</Text>
               </Send>
            </Message>
         </Command>'
   ```


   ```shell
   # over the Cloud
   #  - replace the token with a Webex bot or admin token with the 'spark:xapi_commands' scope
   #  - paste the Webex identifier of your devices (from the Webex /devices API)
   curl --request POST 'https://api.ciscospark.com/v1/xapi/command/message.send' \
      --header 'Authorization: Bearer WEBEX_ACCESS_TOKEN' \
      --header 'Content-Type: application/json' \
      --data-raw '{
         "deviceId": "Y2lzY29FyazovL3VzL0RFVklDRS83MzYLTQ3OGEtOTMyNC0xZmZiNjNmMjQzNWU",
         "arguments": {
            "Text": "{'\''env'\'': '\''DEVICE_SECRET'\'', '\''operation'\'': '\''set'\'', '\''value'\'': 789}"
         }
      }'
   ```


## Security concerns

The communications between the macros reading the ENV, and the 'environment' macro managing the ENV are send in clear text, via xCommand 'Message Send Text'.

As 'Message Send' events can be listened by code with an 'Integrator' role, this represents a potential vulnerability if secrets were to be stored in the env.

We recommend to enhance the security of your deployment by using one or both of: encrypted communications and encryption at rest.

### Encrypted communications

The 'environment' macro and 'getenv()' function support encrypted communications.

Turn on the encrypted boolean both the 'environment' macro and 'getenv()' function to start seeing the message flying as encrypted.

A 'secret-based' and symetric encryption implementation is provided in the proposed implementation.
Feel free to replace / enhance with a crypto algorithm that better meets your needs.


### Encryption at rest

If secrets are to be stored, we recommend you encrypt these secrets before passing them to the environment.

Check the xapi-samples for examples of [symetric](https://github.com/CiscoDevNet/xapi-samples/blob/master/macros/15-cipher.js) and [asymetric](https://github.com/CiscoDevNet/xapi-samples/blob/master/macros/16-encrypt-rsa.js) algorithms compatible with CE's macro runtime.
