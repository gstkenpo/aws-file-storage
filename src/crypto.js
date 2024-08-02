//Checking the crypto module
const crypto = require('crypto');
const fs = require('node:fs');
const authTagLength = 16; // Poly1305 authentication tag length
//get key text
function getPainPw(){
   return fs.readFileSync('key.txt', 'utf8');
}
function encrypt(text, painPw) {
   const chachaIv = crypto.randomBytes(12);
   const aesIv = crypto.randomBytes(16);
   const sha3Hash = crypto.createHash('sha3-512');
   const chacha20Key = sha3Hash.update(painPw).digest().subarray(32);
   let chacha20Chiper = crypto.createCipheriv('chacha20-poly1305', Buffer.from(chacha20Key), chachaIv, {authTagLength})
   let encrypted = chacha20Chiper.update(Buffer.from(text));
   encrypted = Buffer.concat([encrypted, chacha20Chiper.final()]);
   const chacha20AuthTag = chacha20Chiper.getAuthTag();
   

   const sha3Hash2 = crypto.createHash('sha3-512');
   const aesKey = sha3Hash2.update(chacha20Key).digest().subarray(32);
   let aesChiper = crypto.createCipheriv('aes-256-gcm', Buffer.from(aesKey), aesIv, {authTagLength})
   const chacha20EncObject = { iv: chachaIv, encryptedData: encrypted, authTag: chacha20AuthTag};
   let secEncrypted = aesChiper.update(Buffer.from(JSON.stringify(chacha20EncObject)));
   secEncrypted = Buffer.concat([secEncrypted, aesChiper.final()]);
   const aesAuthTag = aesChiper.getAuthTag();
   return JSON.stringify({ iv: aesIv, encryptedData: secEncrypted, authTag: aesAuthTag}).toString('base64')
}

// Decrypting text
function decrypt(encObjectBase64, painPw) {
   const encObject = JSON.parse(encObjectBase64.toString('utf8'));
   const sha3Hash = crypto.createHash('sha3-512');
   const chacha20Key = sha3Hash.update(painPw).digest().subarray(32);
   const sha3Hash2 = crypto.createHash('sha3-512');
   const aesKey = sha3Hash2.update(chacha20Key).digest().subarray(32);

   let iv = Buffer.from(encObject.iv);
   const aesAuthTag = Buffer.from(encObject.authTag); 
   let encryptedData = Buffer.from(encObject.encryptedData);
   let aesDecipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(aesKey), iv, {authTagLength}).setAuthTag(aesAuthTag);
   let chacha20EncObject = aesDecipher.update(encryptedData);
   chacha20EncObject = JSON.parse(Buffer.concat([chacha20EncObject, aesDecipher.final()]));

   iv = Buffer.from(chacha20EncObject.iv);
   const chacha20AuthTag = Buffer.from(chacha20EncObject.authTag); 
   let chacha20Decipher = crypto.createDecipheriv('chacha20-poly1305', Buffer.from(chacha20Key), iv, {authTagLength}).setAuthTag(chacha20AuthTag);
   let decrypted = chacha20Decipher.update(Buffer.from(chacha20EncObject.encryptedData));
   decrypted = Buffer.concat([decrypted, chacha20Decipher.final()]);
   return decrypted.toString();
}

// Text send to encrypt function
 
const painPw = getPainPw();
console.log("Key:", painPw);
const encObjectBase64 = encrypt('testing', painPw);
console.log(encObjectBase64);
console.log(decrypt(encObjectBase64, painPw))