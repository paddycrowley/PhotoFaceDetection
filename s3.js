const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const REGION = process.env.AWS_REGION;

const s3 = new S3Client({ region: REGION });

async function uploadBufferToS3(buffer, key, contentType, bucket) {
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType
  });

  await s3.send(cmd);
  return `https://${bucket}.s3.${REGION}.amazonaws.com/${encodeURIComponent(key)}`;
}

module.exports = { uploadBufferToS3 };
