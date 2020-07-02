const util = require('util');
const fs = require("fs");

/**
 * Testing config
 */
const passportConfig = {
    "configurationEndpoint": "https://gluu.local.org/identity/restv1/passport/config",
    "failureRedirectUrl": "https://gluu.local.org/oxauth/auth/passport/passportlogin.htm",
    "logLevel": "info",
    "consoleLogOnly": false,
    "clientId": "1502.3fe76d0a-38dd-4f91-830b-e33fd70d778a",
    "keyPath": "/etc/certs/passport-rp.pem",
    "keyId": "fbc267ef-0705-4b3a-8c80-bf70e75cf08b_sig_rs512",
    "keyAlg": "RS512"
}
const passportConfigFile = "/tmp/passport_config.json";

/**
 * root level hooks
 */
before((done) => {
    fs.writeFileSync(passportConfigFile, JSON.stringify(passportConfig));
    process.env.passport_file = passportConfigFile;
     
    done();
});

after((done) => {
    fs.unlinkSync(passportConfigFile);
    done();
});