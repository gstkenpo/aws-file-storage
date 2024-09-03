//Checking the crypto module
const crypto = require('crypto');
const fs = require('node:fs');
const authTagLength = 16; // Poly1305 authentication tag length
const ALGORITHM_KEY_SIZE = 32;
const PBKDF2_NAME = "sha3-512";
const PBKDF2_SALT_SIZE = 16;
const PBKDF2_ITERATIONS = 32767;
const zlib = require('zlib')
const msgpack = require('@msgpack/msgpack')
//get key text
const getPaintPw = () => {
   return fs.readFileSync('key.txt', 'utf8');
}
/*
the key is generated as followed
hash paintPw with SHA512 to get full hash, this full hash will used to generate key for chacha20
this full hash will be hashed by SHA512 and used to generate key for AES
as different salt is used for pbkdf1, the key security is guarantee 
 */
const encrypt = (paintObject, paintPw) => {
   const chachaIv = crypto.randomBytes(12);
   const aesIv = crypto.randomBytes(16);
   const sha3Hash = crypto.createHash('sha3-512');
   let fullHash = sha3Hash.update(paintPw).digest();
   const chacha20Salt = crypto.randomBytes(PBKDF2_SALT_SIZE);
   const chacha20Key = crypto.pbkdf2Sync(fullHash, chacha20Salt, PBKDF2_ITERATIONS, ALGORITHM_KEY_SIZE, PBKDF2_NAME);
   let chacha20Chiper = crypto.createCipheriv('chacha20-poly1305', chacha20Key, chachaIv, {authTagLength})
   let encrypted = chacha20Chiper.update(Buffer.from(paintObject));
   encrypted = Buffer.concat([encrypted, chacha20Chiper.final()]);
   const chacha20AuthTag = chacha20Chiper.getAuthTag();

   const sha3Hash2 = crypto.createHash('sha3-512');
   fullHash = sha3Hash2.update(fullHash).digest();
   const aesSalt = crypto.randomBytes(PBKDF2_SALT_SIZE);
   const aesKey = crypto.pbkdf2Sync(fullHash, aesSalt, PBKDF2_ITERATIONS, ALGORITHM_KEY_SIZE, PBKDF2_NAME);
   //console.log('aesKey: '+aesKey.toString('base64'))
   let aesChiper = crypto.createCipheriv('aes-256-gcm', Buffer.from(aesKey), aesIv, {authTagLength})
   const chacha20EncObject = { iv: chachaIv, salt: chacha20Salt, encryptedData: encrypted, authTag: chacha20AuthTag};
   let serializedObject = msgpack.encode(chacha20EncObject);
   let secEncrypted = aesChiper.update(serializedObject);
   secEncrypted = Buffer.concat([secEncrypted, aesChiper.final()]);
   const aesAuthTag = aesChiper.getAuthTag();
   //console.log('aesSalt: '+aesSalt.toString('base64'))
   return msgpack.encode({ iv: aesIv, salt: aesSalt, encryptedData: secEncrypted, authTag: aesAuthTag})
}

// Decrypting text
const decrypt = (encObjectBase64, paintPw) => {
   const encObject = msgpack.decode(encObjectBase64);
   const sha3Hash = crypto.createHash('sha3-512');
   const sha3Hash2 = crypto.createHash('sha3-512');
   let fullHash = sha3Hash.update(paintPw).digest();
   const fullHash2 = sha3Hash2.update(fullHash).digest();
   const aesSalt = Buffer.from(encObject.salt)
   //console.log('aesSalt: '+aesSalt.toString('base64'))
   const aesKey = crypto.pbkdf2Sync(fullHash2, aesSalt, PBKDF2_ITERATIONS, ALGORITHM_KEY_SIZE, PBKDF2_NAME);
   //console.log('aesKey: '+aesKey.toString('base64'))
   let iv = Buffer.from(encObject.iv);
   const aesAuthTag = Buffer.from(encObject.authTag); 
   let encryptedData = Buffer.from(encObject.encryptedData);
   let aesDecipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv, {authTagLength}).setAuthTag(aesAuthTag);
   let chacha20EncObject = aesDecipher.update(encryptedData);
   chacha20EncObject = msgpack.decode((Buffer.concat([chacha20EncObject, aesDecipher.final()])));

   iv = Buffer.from(chacha20EncObject.iv);
   const chacha20Salt = Buffer.from(chacha20EncObject.salt);
   const chacha20Key = crypto.pbkdf2Sync(fullHash, chacha20Salt, PBKDF2_ITERATIONS, ALGORITHM_KEY_SIZE, PBKDF2_NAME);
   const chacha20AuthTag = Buffer.from(chacha20EncObject.authTag); 
   let chacha20Decipher = crypto.createDecipheriv('chacha20-poly1305', chacha20Key, iv, {authTagLength}).setAuthTag(chacha20AuthTag);
   let decrypted = chacha20Decipher.update(Buffer.from(chacha20EncObject.encryptedData));
   decrypted = Buffer.concat([decrypted, chacha20Decipher.final()]);
   return decrypted;
}

const base64Hash = (paintext) => {
   const sha3Hash = crypto.createHash('sha3-256');
   return sha3Hash.update(paintext).digest('base64url');
}

const test = () => {
   const filePath = '';//put in testing path
   const paintPw = getPaintPw();
   const fileData = fs.readFileSync(filePath);
   const compressedData = zlib.gzipSync(fileData);
   const encryptedData = encrypt(compressedData, paintPw);
   const outputFilePath = `${filePath}.enc.gz`;
   fs.writeFileSync(outputFilePath, Buffer.from(encryptedData));
   const fileData1 = fs.readFileSync(outputFilePath);
   const decryptData = decrypt(fileData1, paintPw);
   const unzipData = zlib.gunzipSync(decryptData)
   const outputFilePath1 = `${filePath}.unenc`;
   fs.writeFileSync(outputFilePath1, unzipData);
}

module.exports = {
   getPaintPw,
   encrypt,
   decrypt,
   base64Hash,
   test
}