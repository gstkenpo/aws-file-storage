# aws-file-storage

how to run:
npm start

here is the design functionality needed to implement

phase 1
1. support double encprytion, CBC+CHACHA20 for data key and data
2. support validation: use poly1305 + GCM for validation
3. find a better KDM
4. validate it works for file
5. use different key, IV and salt for different file
    5.1 need to create a list of key mapping to file
    5.2 need to mask the file name as well

phase 2
1. need to validate we can push file to S3
2. need to validate we retrieve the data from s3
3. need to support manaul update command. auto sync data to aws

phase 3
1. support more cheap cloud storage. eg baidu cloud storage
https://intl.cloud.baidu.com/doc/BOS/s/Hjwvyri9y-en