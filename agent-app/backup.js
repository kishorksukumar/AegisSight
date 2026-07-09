const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const stream = require("stream");

// Adapters
const { Upload } = require("@aws-sdk/lib-storage");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const ftp = require("basic-ftp");
const Client = require("ssh2-sftp-client");

async function performBackup(job, onProgress) {
  return new Promise((resolve, reject) => {
    try {
      const { name, backup_type, dest_type, dest_config } = job;
      
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
      const isDb = (backup_type === 'mysql' || backup_type === 'postgres');
      const ext = isDb ? 'sql.gz' : 'tar.gz';
      const archiveName = `${name}-${backup_type}-${dateStr}.${ext}`;
      
      const config = dest_config ? JSON.parse(dest_config) : {};

      if (isDb) {
        const dbConfig = typeof job.source_paths === 'string' ? JSON.parse(job.source_paths) : job.source_paths;
        const host = dbConfig.host || 'localhost';
        const port = dbConfig.port || (backup_type === 'mysql' ? '3306' : '5432');
        const user = dbConfig.user || '';
        const password = dbConfig.password || '';
        const database = dbConfig.database || '';

        if (backup_type === 'mysql') {
          const args = ['-h', host, '-P', port, '-u', user];
          if (password) args.push(`-p${password}`);
          args.push(database);
          
          onProgress({ logs: `Starting MySQL dump for database: ${database}...`, percentage: 10 });
          
          const mysqldump = spawn('mysqldump', args);
          const gzip = spawn('gzip', ['-c']);
          
          mysqldump.stdout.pipe(gzip.stdin);
          
          mysqldump.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) onProgress({ logs: `MYSQLDUMP: ${msg}`, percentage: null });
          });
          
          gzip.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) onProgress({ logs: `GZIP: ${msg}`, percentage: null });
          });

          streamToDestination(gzip.stdout, dest_type, config, archiveName, onProgress)
            .then(() => resolve({ archiveName }))
            .catch(reject);

          mysqldump.on('exit', (code) => {
            if (code !== 0) {
              reject(new Error(`mysqldump exited with code ${code}`));
            }
          });
          
          gzip.on('exit', (code) => {
            if (code !== 0) {
              reject(new Error(`gzip exited with code ${code}`));
            }
          });
          return;
        } else if (backup_type === 'postgres') {
          const args = ['-h', host, '-p', port, '-U', user, '-F', 'p', database];
          onProgress({ logs: `Starting PostgreSQL dump for database: ${database}...`, percentage: 10 });
          
          const env = { ...process.env };
          if (password) env.PGPASSWORD = password;
          
          const pgdump = spawn('pg_dump', args, { env });
          const gzip = spawn('gzip', ['-c']);
          
          pgdump.stdout.pipe(gzip.stdin);
          
          pgdump.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) onProgress({ logs: `PGDUMP: ${msg}`, percentage: null });
          });
          
          gzip.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) onProgress({ logs: `GZIP: ${msg}`, percentage: null });
          });

          streamToDestination(gzip.stdout, dest_type, config, archiveName, onProgress)
            .then(() => resolve({ archiveName }))
            .catch(reject);

          pgdump.on('exit', (code) => {
            if (code !== 0) {
              reject(new Error(`pg_dump exited with code ${code}`));
            }
          });
          
          gzip.on('exit', (code) => {
            if (code !== 0) {
              reject(new Error(`gzip exited with code ${code}`));
            }
          });
          return;
        }
      }

      // Existing non-DB files/folders backup
      const sourcePaths = JSON.parse(job.source_paths);
      let tarArgs = ['-czf', '-']; // output to stdout
      
      if (backup_type === 'incremental') {
        const snapDir = path.join(__dirname, 'snapshots');
        if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir);
        const snapFile = path.join(snapDir, `${name}.snar`);
        tarArgs.push(`--listed-incremental=${snapFile}`);
      }

      let excludePaths = [];
      if (job.exclude_paths) {
        try {
          excludePaths = typeof job.exclude_paths === 'string' ? JSON.parse(job.exclude_paths) : job.exclude_paths;
        } catch (e) {}
      }

      if (Array.isArray(excludePaths)) {
        excludePaths.forEach(ex => {
          const trimmed = typeof ex === 'string' ? ex.trim() : '';
          if (trimmed.length > 0) {
            tarArgs.push(`--exclude=${trimmed}`);
          }
        });
      }

      if (!Array.isArray(sourcePaths) || sourcePaths.length === 0) {
        throw new Error('source_paths must be a non-empty array of strings');
      }
      
      const validPaths = sourcePaths.map(p => typeof p === 'string' ? p.trim() : '').filter(p => p.length > 0);
      if (validPaths.length === 0) {
        throw new Error('source_paths must contain at least one valid path string');
      }

      tarArgs.push('--');
      tarArgs = tarArgs.concat(validPaths);
      
      onProgress({ logs: `Starting ${backup_type} tar archive process...`, percentage: 10 });
      const tarProcess = spawn('tar', tarArgs);
      
      tarProcess.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) onProgress({ logs: `TAR: ${msg}`, percentage: null });
      });

      streamToDestination(tarProcess.stdout, dest_type, config, archiveName, onProgress)
        .then(() => resolve({ archiveName }))
        .catch(reject);

      tarProcess.on('exit', (code) => {
        if (code !== 0 && code !== 1) { 
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
    const s3Opts = {
      region: config.region || 'us-east-1',
      credentials: {
        accessKeyId: config.accessKeyId || process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    };
    if (config.endpoint) {
      let endpoint = config.endpoint.trim();
      if (!/^https?:\/\//i.test(endpoint)) {
        endpoint = `https://${endpoint}`;
      }
      s3Opts.endpoint = endpoint;
    }
    const s3 = new S3Client(s3Opts);
    
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

async function streamFromDestination(writableStream, type, config, filename, onProgress) {
  if (type === 's3' || !type) {
    const s3Opts = {
      region: config.region || 'us-east-1',
      credentials: {
        accessKeyId: config.accessKeyId || process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    };
    if (config.endpoint) {
      let endpoint = config.endpoint.trim();
      if (!/^https?:\/\//i.test(endpoint)) {
        endpoint = `https://${endpoint}`;
      }
      s3Opts.endpoint = endpoint;
    }
    const s3 = new S3Client(s3Opts);
    
    onProgress({ logs: `Connecting to S3 to download ${filename}...`, percentage: 10 });
    const response = await s3.send(new GetObjectCommand({
      Bucket: config.bucket || process.env.S3_BUCKET || 'backups',
      Key: `backups/${filename}`
    }));
    
    response.Body.pipe(writableStream);
    
    return new Promise((resolve, reject) => {
      writableStream.on('finish', resolve);
      writableStream.on('error', reject);
      response.Body.on('error', reject);
    });
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
      onProgress({ logs: `FTP Connected. Downloading...`, percentage: null });
      
      await client.cd("backups");
      await client.downloadTo(writableStream, filename);
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
    onProgress({ logs: `SFTP Connected. Downloading...`, percentage: null });
    
    await sftp.get(`/backups/${filename}`, writableStream);
    await sftp.end();
    return true;
  }
  else {
    throw new Error(`Unsupported destination type: ${type}`);
  }
}

async function performRestore(options, onProgress) {
  return new Promise((resolve, reject) => {
    try {
      const { archive_name, dest_type, dest_config, target_paths, restore_dir } = options;
      const config = dest_config ? JSON.parse(dest_config) : {};

      // Prepare tar arguments
      let tarArgs = ['-xzf', '-']; // read from stdin
      
      // If a specific restore directory is chosen, use it, else default to /
      const extractDir = restore_dir && restore_dir.trim() !== '' ? restore_dir : '/';
      
      if (extractDir !== '/') {
         if (!fs.existsSync(extractDir)) {
             fs.mkdirSync(extractDir, { recursive: true });
         }
      }
      tarArgs.push('-C', extractDir);

      if (target_paths && Array.isArray(target_paths) && target_paths.length > 0) {
        const validPaths = target_paths.map(p => typeof p === 'string' ? p.trim() : '').filter(p => p.length > 0);
        if (validPaths.length > 0) {
          tarArgs.push('--');
          tarArgs = tarArgs.concat(validPaths);
        }
      }

      onProgress({ logs: `Starting extraction to ${extractDir}...`, percentage: 10 });
      const tarProcess = spawn('tar', tarArgs);
      
      tarProcess.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) onProgress({ logs: `TAR: ${msg}`, percentage: null });
      });

      streamFromDestination(tarProcess.stdin, dest_type, config, archive_name, onProgress)
        .then(() => {
           // wait for exit event
        })
        .catch(err => {
           tarProcess.kill();
           reject(err);
        });

      tarProcess.on('exit', (code) => {
        if (code === 0 || code === 1) { 
          resolve({ success: true });
        } else {
          reject(new Error(`Tar ended with code ${code}`));
        }
      });
      
    } catch(err) {
      reject(err);
    }
  });
}

module.exports = { performBackup, performRestore };
