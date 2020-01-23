# Environments for CE Macros

Enhance your macro runtime with ENV.

```javascript
const xapi = require('xapi');

async function init(ENV) {

   // Example
   let value = await ENV('DEVICE_ID');
   console.log(`echo \$DEVICE_ID = ${value}`);
}

// getenv() function
...
```

## Quickstart

1. Deploy the [environment](environment.js) macro to a device.

2. Activate the 'environment' macro.

   > a new 'ENV' macro is created which you do not need to activate.
   > this macro is used for the sole purpose of persisting the changes you could make to variables.

3. Copy the [getenv](getenv-minified.js) code snippet to the device, and activate it.

4. Check the logs in the Macro Editor, you should see:

   ```text
   08:22:00	[system]    Using XAPI transport: TSH
   08:22:00	[system]    Starting macros...
   08:22:00	environment Loading...
   08:22:00	getenv      Loading...
   08:22:02	getenv      Ready!
   08:22:02	environment Ready!
   08:22:02	environment'starting in persistent mode: environment variables are stored in the "ENV" macro.'
   08:22:03	getenv     'echo $DEVICE_ID = 4567'
   ```


5. Congrats, your ENV is working!

   You can now copy the [getenv](getenv-minified.js) code snippet to an existing macro,
   and invoke ENV() which is passed by `init(ENV)`.

   _Note that if a variable is not found in ENV, an empty value is returned._


## To go further

- **Customize the DEFAULT_ENV** with a predefined the list of ENV variables for your macros in [environment](environment.js):

```javascript
const DEFAULT_ENV = {
   'DEVICE_ID': 1234,
   'WEBEX_TOKEN': ABCDEFGHIJ
}
```

- **Configure your ENV to be volatile or persistent** by changing the value of volatile in in [environment](environment.js): 

```javascript
const volatile = false; // set to false for persisted ENV variables
```


- **Create a new variable, or update an existing variable** by sending a message on the LAN or from the cloud

```