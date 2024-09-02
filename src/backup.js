const propertiesReader = require('properties-reader');
const fs = require('fs')
const awsConfig = propertiesReader('AWS.property')
const config = propertiesReader('config.property')
const {uploadDirectory} = require ('./s3.js')

const localUploadDirectory = config.get('bk.path.upload');
const localDowloadDirectory = config.get('bk.path.download');
const s3BucketName = awsConfig.get('s3.bucket.name');
const s3Directory = awsConfig.get('s3.directory');
fs.readFileSync('key.txt', 'utf8');

uploadDirectory(localUploadDirectory, s3BucketName, s3Directory).then(() => {
    console.log('All files have been uploaded successfully.');
    }).catch(error => {
    console.error('Error uploading files:', error);
});