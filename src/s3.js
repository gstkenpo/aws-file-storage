const { S3Client, ListObjectsCommand, PutObjectCommand, GetObjectCommand} = require("@aws-sdk/client-s3"); // CommonJS import
const { Upload } = require('@aws-sdk/lib-storage');
const fs = require('fs')
const path = require( 'path' );
const {getPaintPw, encrypt, decrypt, base64Hash} = require('./crypto.js')
const { Readable, pipeline, PassThrough } = require('stream'); // Import Readable from stream module
const zlib = require('zlib');
const { promisify } = require('util');
const msgpack = require('@msgpack/msgpack')
//const pipeline = promisify(stream.pipeline);
const propertiesReader = require('properties-reader');
const awsConfig = propertiesReader('AWS.property')
const config = propertiesReader('config.property')



const client = new S3Client({ region: awsConfig.get('s3.region') });

// Function to read all files in a directory recursively
const getAllFiles = (dirPath, arrayOfFiles) => {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(file => {
    if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
      arrayOfFiles = getAllFiles(path.join(dirPath, file), arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, file));
    }
  });

  return arrayOfFiles;
};

const uploadFile = async(bucketName, s3Path, localFilePath, based64EncodedEncryptedPath) => {
    const fileContent = fs.readFileSync(localFilePath);
    const compressedData = zlib.gzipSync(fileContent);
    const encObject = msgpack.decode(encrypt(compressedData, paintPw))
    encObject.relativePath = based64EncodedEncryptedPath
    const encObjectBinary = msgpack.encode(encObject);

    const putObjectCommandInput = {
        Bucket: bucketName, // required
        StorageClass: awsConfig.get('s3.bucket.storeageClass'),
        Key: s3Path, // required
        Body: encObjectBinary
    }

    const command = new PutObjectCommand(putObjectCommandInput);
    const response = await client.send(command);
    console.log(response);
  };
  

// Main function to upload all files in a directory to S3
const uploadDirectory = async (localDirPath, bucketName, s3DirPath) => {
    const allFiles = getAllFiles(localDirPath);
  
    for (const filePath of allFiles) {
      const relativeFilePath = path.relative(localDirPath, filePath);
      const based64EncodedEncryptedPath = encrypt(relativeFilePath, paintPw);
      const hashedrelatedFilePath = base64Hash(relativeFilePath)
      //console.log('hash: ', hashedrelatedFilePath)
      const s3FilePath = path.join(s3DirPath, hashedrelatedFilePath/*relativeFilePath*/).replace(/\\/g, '/'); // Replace backslashes with forward slashes for S3
  
      try {
        await uploadFile(bucketName, s3FilePath, filePath, based64EncodedEncryptedPath);
        console.log(`Successfully uploaded ${filePath} to ${bucketName}/${s3FilePath}`);
      } catch (error) {
        console.error(`Error uploading ${filePath}: `, error);
      }
    }
  };

// Main function to download all files from an S3 bucket
const downloadDirectory = async (bucketName, s3DirPath, localDirPath) => {
    const listObjectsCommandInput = { // list object
        Bucket: bucketName, // required
        Prefix: s3DirPath
      };
    const command = new ListObjectsCommand(listObjectsCommandInput);
    const listedObjects = await client.send(command);
  
    for (const s3Object of listedObjects.Contents) {
      const encodedFilePath = s3Object.Key.replace(s3DirPath, '').replace(/^\/+/, '');
      //const localFilePath = path.join(localDirPath, encodedFilePath);
  
      try {
        const localFilePath = await downloadFile(bucketName, s3Object.Key, localDirPath);
        console.log(`Successfully downloaded ${s3Object.Key} to ${localFilePath}`);
      } catch (error) {
        console.error(`Error downloading ${s3Object.Key}: `, error);
      }
    }
  };

// Function to download a file from S3
const downloadFile = async (bucketName, s3Key, localDirPath) => {
    const getObjectsCommandInput = { // list object
        Bucket: bucketName, // required
        Key: s3Key
      };
  
    const command = new GetObjectCommand(getObjectsCommandInput);
    const {Body} = await client.send(command);
    let dataBuffer;
        
    if (Body instanceof Readable) {
      dataBuffer = await streamToBuffer(Body);
    } else if (Buffer.isBuffer(Body)) {
        dataBuffer = Body;
    } else {
        throw new Error("Unexpected Body type. Expected a stream or a buffer.");
    }
    const encryptedRelatedPath = msgpack.decode(dataBuffer).relativePath;
    const relatedPath = decrypt(encryptedRelatedPath, paintPw).toString('utf-8');
    const localFilePath = path.join(localDirPath,relatedPath)
    // Ensure that the directory exists
    ensureDirectoryExistence(localFilePath);
  
    // Write the file to the local filesystem
    fs.writeFileSync(localFilePath, zlib.gunzipSync(decrypt(dataBuffer, paintPw)));
    return localFilePath;
  };

// Function to ensure that a directory exists
const ensureDirectoryExistence = (filePath) => {
    const dirName = path.dirname(filePath);
    if (fs.existsSync(dirName)) {
      return true;
    }
    ensureDirectoryExistence(dirName);
    fs.mkdirSync(dirName);
  };

const streamToBuffer = async (stream) => {
  return new Promise((resolve, reject) => {
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
  });
};

const localUploadDirectory = config.get('bk.path.upload');
const localDowloadDirectory = config.get('bk.path.download');
const s3BucketName = awsConfig.get('s3.bucket.name');
const s3Directory = 'test';
const paintPw = getPaintPw();
fs.readFileSync('key.txt', 'utf8');

const test = async() => {

  
  try {
    await uploadDirectory(localUploadDirectory, s3BucketName, s3Directory)
    console.log('All files have been uploaded successfully.')
  } catch (error) {
    console.error('Error uploading files:', error)
  }

  
  try {
    await downloadDirectory(s3BucketName, s3Directory, localDowloadDirectory)
    console.log('All files have been download successfully.');
  } catch (error) {
    console.error('Error downloading files:', error);
  }
}

module.exports = {
  uploadDirectory,
  downloadDirectory,
  test
}