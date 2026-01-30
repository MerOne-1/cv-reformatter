import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  endpoint: process.env.B2_ENDPOINT,
  region: process.env.B2_REGION || 'eu-central-003',
  credentials: {
    accessKeyId: process.env.B2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.B2_BUCKET_NAME || 'ConversionCVs';

async function createFolder(folderName: string) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: `${folderName}/.keep`,
    Body: '',
    ContentType: 'text/plain',
  });

  await s3Client.send(command);
  console.log(`✓ Dossier créé: ${folderName}/`);
}

async function main() {
  console.log('Configuration B2:');
  console.log(`  Endpoint: ${process.env.B2_ENDPOINT}`);
  console.log(`  Bucket: ${BUCKET_NAME}`);
  console.log('');

  try {
    await createFolder('cv-raw');
    await createFolder('cv-final');
    console.log('\n✅ Dossiers créés avec succès!');
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();
