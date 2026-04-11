const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const stream = require("stream");

// Adapters
const { Upload } = require("@aws-sdk/lib-storage");
const { S3Client } = require("@aws-sdk/client-s3");
const ftp = require("basic-ftp");
const Client = require("ssh2-sftp-client");

async function performBackup(job, onProgress) {
  return new Promise((resolve, reject) => {
    try {
      const { name, backup_type, dest_type, dest_config } = job;
      const sourcePaths = JSON.parse(job.source_paths);
      
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
      const archiveName = `${name}-${backup_type}-${dateStr}.tar.gz`;
      
      const config = dest_config ? JSON.parse(dest_config) : {};

      // Prepare tar arguments
      let tarArgs = ['-czf', '-']; // output to stdout
      
      if (backup_type === 'incremental') {
        const snapDir = path.join(__dirname, 'snapshots');
        if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir);
        const snapFile = path.join(snapDir, `${name}.snar`);
        tarArgs.push(`--listed-incremental=${snapFile}`);
      }

      tarArgs = tarArgs.concat(sourcePaths);
      
      onProgress({ logs: `Starting ${backup_type} tar archive process...`, percentage: 10 });
      const tarProcess = spawn('tar', tarArgs);
      
      tarProcess.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) onProgress({ logs: `TAR: ${msg}`, percentage: null });
      });

      streamToDestination(tarProcess.stdout, dest_type, config, archiveName, onProgress)
        .then(resolve)
        .catch(reject);

      tarProcess.on('exit', (code) => {
        if (code !== 0 && code !== 1) { // tar exits 1 sometimes for harmless warnings
          reject(new Error(`Tar ended with code ${code}`));
        }
      });
      
    } catch(err) {
      reject(err);
    }
  });
}

async function streamToDestination(readableStream, type, config, filename, onProgress) {
  if (type === 's3' || !type) {
    const s3 = new S3Client({
      region: config.region || 'us-east-1',
      credentials: {
        accessKeyId: config.accessKeyId || process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });
    
    const passThrough = new stream.PassThrough();
    readableStream.pipe(passThrough);

    const upload = new Upload({
      client: s3,
      params: {
        Bucket: config.bucket || process.env.S3_BUCKET || 'backups',
        Key: `backups/${filename}`,
        Body: passThrough,
      },
    });

    upload.on("httpUploadProgress", (progress) => {
      let bytesMb = (progress.loaded / (1024 * 1024)).toFixed(2);
      onProgress({ logs: `Uploading S3... ${bytesMb} MB transferred`, percentage: null });
    });

    return upload.done();
  } 
  else if (type === 'ftp') {
    const client = new ftp.Client();
    try {
      await client.access({
        host: config.host,
        user: config.user,
        password: config.password,
        secure: config.secure || false
      });
      onProgress({ logs: `FTP Connected. Uploading...`, percentage: null });
      
      // Ensure backups dir exists (basic-ftp)
      try { await client.ensureDir("backups"); } catch(e) {}
      
      await client.uploadFrom(readableStream, filename);
      return true;
    } finally {
      client.close();
    }
  }
  else if (type === 'sftp') {
    const sftp = new Client();
    await sftp.connect({
      host: config.host,
      port: config.port || 22,
      username: config.user,
      password: config.password,
    });
    onProgress({ logs: `SFTP Connected. Uploading...`, percentage: null });
    
    // Ensure dir
    try { await sftp.mkdir('/backups', true); } catch(e) {}

    await sftp.put(readableStream, `/backups/${filename}`);
    await sftp.end();
    return true;
  }
  else {
    throw new Error(`Unsupported destination type: ${type}`);
  }
}

module.exports = { performBackup };
